"""
Service d'intégration Microsoft Outlook via OAuth 2.0 (MSAL) + Microsoft Graph API.

Responsabilités :
- Générer l'URL d'autorisation Microsoft
- Échanger le code OAuth contre des tokens (access + refresh)
- Rafraîchir automatiquement les tokens expirés
- Stocker/récupérer les tokens dans Supabase (table oauth_tokens)
- Appeler Microsoft Graph API pour récupérer mails et événements calendrier
- Convertir les données en texte indexable et les injecter dans le RAG
"""

import logging
import os
from datetime import datetime, timezone

import httpx
import msal

from services.rag_engine import (
    chunk_pages,
    delete_by_filename,
    generate_embeddings,
    insert_chunks,
)

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
SCOPES = ["Mail.Read", "Calendars.Read", "User.Read", "offline_access"]

OUTLOOK_MAIL_FILENAME = "outlook_mails"
OUTLOOK_CAL_FILENAME = "outlook_calendrier"


def _get_msal_app() -> msal.ConfidentialClientApplication:
    client_id = os.getenv("AZURE_CLIENT_ID")
    client_secret = os.getenv("AZURE_CLIENT_SECRET")
    tenant_id = os.getenv("AZURE_TENANT_ID", "common")

    if not client_id or not client_secret:
        raise ValueError("AZURE_CLIENT_ID et AZURE_CLIENT_SECRET sont requis pour l'intégration Outlook.")

    authority = f"https://login.microsoftonline.com/{tenant_id}"
    return msal.ConfidentialClientApplication(
        client_id=client_id,
        client_credential=client_secret,
        authority=authority,
    )


def _get_supabase():
    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante.")
    return create_client(url, key)


# ---------------------------------------------------------------------------
# OAuth Flow
# ---------------------------------------------------------------------------

def get_auth_url() -> str:
    """Génère l'URL de connexion Microsoft."""
    app = _get_msal_app()
    redirect_uri = os.getenv("AZURE_REDIRECT_URI", "http://localhost:8000/auth/outlook/callback")
    auth_url = app.get_authorization_request_url(
        scopes=SCOPES,
        redirect_uri=redirect_uri,
    )
    logger.info("URL d'authentification Outlook générée.")
    return auth_url


def exchange_code_for_tokens(code: str) -> dict:
    """Échange le code d'autorisation contre des tokens access + refresh."""
    app = _get_msal_app()
    redirect_uri = os.getenv("AZURE_REDIRECT_URI", "http://localhost:8000/auth/outlook/callback")
    result = app.acquire_token_by_authorization_code(
        code=code,
        scopes=SCOPES,
        redirect_uri=redirect_uri,
    )
    if "error" in result:
        raise ValueError(f"Erreur OAuth Microsoft : {result.get('error_description', result['error'])}")
    return result


def save_tokens(access_token: str, refresh_token: str | None, expires_in: int, email: str) -> None:
    """Stocke les tokens dans Supabase (upsert — un seul enregistrement Microsoft)."""
    client = _get_supabase()
    from datetime import timedelta
    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()

    existing = client.table("oauth_tokens").select("id").eq("provider", "microsoft").execute()
    record = {
        "provider": "microsoft",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_at": expires_at,
        "email": email,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if existing.data:
        client.table("oauth_tokens").update(record).eq("provider", "microsoft").execute()
    else:
        client.table("oauth_tokens").insert(record).execute()
    logger.info("Tokens Outlook sauvegardés pour %s.", email)


def get_valid_token() -> str:
    """
    Retourne un access token valide.
    Rafraîchit automatiquement si le token est expiré (via refresh_token).
    Lève ValueError si non connecté.
    """
    client = _get_supabase()
    result = client.table("oauth_tokens").select("*").eq("provider", "microsoft").execute()
    if not result.data:
        raise ValueError("Compte Outlook non connecté. Cliquez sur 'Connecter Outlook'.")

    row = result.data[0]
    expires_at = datetime.fromisoformat(row["expires_at"])
    now = datetime.now(timezone.utc)

    if expires_at > now:
        return row["access_token"]

    # Token expiré → refresh
    app = _get_msal_app()
    refresh_result = app.acquire_token_by_refresh_token(
        refresh_token=row["refresh_token"],
        scopes=SCOPES,
    )
    if "error" in refresh_result:
        raise ValueError("Token expiré et impossible de le renouveler. Reconnectez votre compte Outlook.")

    save_tokens(
        access_token=refresh_result["access_token"],
        refresh_token=refresh_result.get("refresh_token", row["refresh_token"]),
        expires_in=refresh_result.get("expires_in", 3600),
        email=row["email"],
    )
    return refresh_result["access_token"]


def get_outlook_status() -> dict:
    """Retourne le statut de connexion Outlook."""
    try:
        client = _get_supabase()
        result = client.table("oauth_tokens").select("email, updated_at").eq("provider", "microsoft").execute()
        if not result.data:
            return {"connected": False}
        row = result.data[0]
        return {
            "connected": True,
            "email": row.get("email"),
            "last_sync": row.get("updated_at"),
        }
    except Exception:
        return {"connected": False}


def disconnect_outlook() -> None:
    """Supprime les tokens Outlook de Supabase."""
    client = _get_supabase()
    client.table("oauth_tokens").delete().eq("provider", "microsoft").execute()
    logger.info("Compte Outlook déconnecté.")


# ---------------------------------------------------------------------------
# Microsoft Graph API
# ---------------------------------------------------------------------------

def fetch_recent_emails(token: str, count: int = 50) -> list[dict]:
    """Récupère les derniers mails via Graph API."""
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "$top": count,
        "$orderby": "receivedDateTime desc",
        "$select": "subject,from,receivedDateTime,bodyPreview,body",
    }
    r = httpx.get(f"{GRAPH_BASE}/me/messages", headers=headers, params=params, timeout=30)
    r.raise_for_status()
    return r.json().get("value", [])


def fetch_calendar_events(token: str, days: int = 30) -> list[dict]:
    """Récupère les événements calendrier des N prochains jours via Graph API."""
    from datetime import timedelta
    headers = {
        "Authorization": f"Bearer {token}",
        "Prefer": 'outlook.timezone="Europe/Paris"',
    }
    start = datetime.now(timezone.utc).isoformat()
    end = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
    params = {
        "startDateTime": start,
        "endDateTime": end,
        "$top": 100,
        "$select": "subject,organizer,start,end,location,bodyPreview,attendees",
        "$orderby": "start/dateTime asc",
    }
    r = httpx.get(f"{GRAPH_BASE}/me/calendarView", headers=headers, params=params, timeout=30)
    r.raise_for_status()
    return r.json().get("value", [])


def fetch_user_email(token: str) -> str:
    """Récupère l'adresse email de l'utilisateur connecté."""
    headers = {"Authorization": f"Bearer {token}"}
    r = httpx.get(f"{GRAPH_BASE}/me", headers=headers, params={"$select": "mail,userPrincipalName"}, timeout=10)
    r.raise_for_status()
    data = r.json()
    return data.get("mail") or data.get("userPrincipalName", "inconnu")


# ---------------------------------------------------------------------------
# Conversion en texte indexable
# ---------------------------------------------------------------------------

def email_to_text(email: dict) -> str:
    """Convertit un mail Graph API en texte lisible pour le RAG."""
    subject = email.get("subject", "(sans objet)")
    sender = email.get("from", {}).get("emailAddress", {})
    from_str = f"{sender.get('name', '')} <{sender.get('address', '')}>".strip(" <>")
    date = email.get("receivedDateTime", "")[:10]
    body = email.get("bodyPreview", "") or ""
    return f"Mail | De : {from_str} | Date : {date} | Sujet : {subject}\n{body}"


def event_to_text(event: dict) -> str:
    """Convertit un événement calendrier en texte lisible pour le RAG."""
    subject = event.get("subject", "(sans titre)")
    start = event.get("start", {}).get("dateTime", "")[:16].replace("T", " ")
    end = event.get("end", {}).get("dateTime", "")[:16].replace("T", " ")
    location = event.get("location", {}).get("displayName", "")
    organizer = event.get("organizer", {}).get("emailAddress", {}).get("name", "")
    attendees = ", ".join(
        a.get("emailAddress", {}).get("name", "")
        for a in event.get("attendees", [])[:5]
    )
    body = event.get("bodyPreview", "") or ""
    parts = [f"Événement : {subject} | Début : {start} | Fin : {end}"]
    if location:
        parts.append(f"Lieu : {location}")
    if organizer:
        parts.append(f"Organisateur : {organizer}")
    if attendees:
        parts.append(f"Participants : {attendees}")
    if body:
        parts.append(body)
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Synchronisation complète
# ---------------------------------------------------------------------------

def sync_outlook_data() -> dict:
    """
    Synchronise mails + calendrier dans le RAG.

    Retourne {mail_count, event_count, chunks_inserted}.
    """
    token = get_valid_token()

    # Fetch
    emails = fetch_recent_emails(token, count=50)
    events = fetch_calendar_events(token, days=30)
    logger.info("Outlook : %d mails et %d événements récupérés.", len(emails), len(events))

    # Supprimer les anciennes données Outlook dans le RAG
    delete_by_filename(OUTLOOK_MAIL_FILENAME)
    delete_by_filename(OUTLOOK_CAL_FILENAME)

    total_chunks = 0

    # Indexer les mails
    if emails:
        mail_pages = [{"page": i + 1, "text": email_to_text(e)} for i, e in enumerate(emails)]
        mail_chunks = chunk_pages(mail_pages, filename=OUTLOOK_MAIL_FILENAME)
        for chunk in mail_chunks:
            chunk["metadata"]["theme"] = "outlook_mail"
        mail_embeddings = generate_embeddings([c["content"] for c in mail_chunks])
        total_chunks += insert_chunks(mail_chunks, mail_embeddings)

    # Indexer les événements calendrier
    if events:
        event_pages = [{"page": i + 1, "text": event_to_text(e)} for i, e in enumerate(events)]
        event_chunks = chunk_pages(event_pages, filename=OUTLOOK_CAL_FILENAME)
        for chunk in event_chunks:
            chunk["metadata"]["theme"] = "outlook_calendrier"
        event_embeddings = generate_embeddings([c["content"] for c in event_chunks])
        total_chunks += insert_chunks(event_chunks, event_embeddings)

    logger.info("Sync Outlook terminée : %d chunks insérés.", total_chunks)
    return {
        "mail_count": len(emails),
        "event_count": len(events),
        "chunks_inserted": total_chunks,
    }
