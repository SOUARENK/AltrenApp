"""
Service Microsoft Outlook — OAuth 2.0 (MSAL) + Microsoft Graph API.
Gère l'auth, les tokens, la lecture des mails/calendrier et leur indexation RAG.
"""

import logging
import os
from datetime import datetime, timedelta, timezone

import httpx
import msal

from services.rag_engine import chunk_pages, delete_by_filename, generate_embeddings, insert_chunks

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
        raise ValueError("AZURE_CLIENT_ID et AZURE_CLIENT_SECRET sont requis.")
    authority = f"https://login.microsoftonline.com/{tenant_id}"
    return msal.ConfidentialClientApplication(
        client_id=client_id, client_credential=client_secret, authority=authority
    )


def _get_supabase():
    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante.")
    return create_client(url, key)


# ── OAuth Flow ────────────────────────────────────────────────────────────────

def get_auth_url() -> str:
    app = _get_msal_app()
    redirect_uri = os.getenv("AZURE_REDIRECT_URI", "http://localhost:8000/auth/callback/microsoft")
    return app.get_authorization_request_url(scopes=SCOPES, redirect_uri=redirect_uri)


def exchange_code_for_tokens(code: str) -> dict:
    app = _get_msal_app()
    redirect_uri = os.getenv("AZURE_REDIRECT_URI", "http://localhost:8000/auth/callback/microsoft")
    result = app.acquire_token_by_authorization_code(code=code, scopes=SCOPES, redirect_uri=redirect_uri)
    if "error" in result:
        raise ValueError(f"Erreur OAuth Microsoft : {result.get('error_description', result['error'])}")
    return result


def save_tokens(access_token: str, refresh_token: str | None, expires_in: int, email: str) -> None:
    client = _get_supabase()
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
    client = _get_supabase()
    result = client.table("oauth_tokens").select("*").eq("provider", "microsoft").execute()
    if not result.data:
        raise ValueError("Compte Outlook non connecté.")
    row = result.data[0]
    expires_at = datetime.fromisoformat(row["expires_at"])
    if expires_at > datetime.now(timezone.utc):
        return row["access_token"]
    app = _get_msal_app()
    refresh_result = app.acquire_token_by_refresh_token(refresh_token=row["refresh_token"], scopes=SCOPES)
    if "error" in refresh_result:
        raise ValueError("Token expiré et impossible de le renouveler. Reconnectez votre compte.")
    save_tokens(
        access_token=refresh_result["access_token"],
        refresh_token=refresh_result.get("refresh_token", row["refresh_token"]),
        expires_in=refresh_result.get("expires_in", 3600),
        email=row["email"],
    )
    return refresh_result["access_token"]


def get_outlook_status() -> dict:
    try:
        client = _get_supabase()
        result = client.table("oauth_tokens").select("email, updated_at").eq("provider", "microsoft").execute()
        if not result.data:
            return {"connected": False}
        row = result.data[0]
        return {"connected": True, "email": row.get("email"), "last_sync": row.get("updated_at")}
    except Exception:
        return {"connected": False}


def disconnect_outlook() -> None:
    client = _get_supabase()
    client.table("oauth_tokens").delete().eq("provider", "microsoft").execute()
    logger.info("Compte Outlook déconnecté.")


# ── Microsoft Graph API ───────────────────────────────────────────────────────

def fetch_recent_emails(token: str, count: int = 50) -> list[dict]:
    headers = {"Authorization": f"Bearer {token}"}
    params = {"$top": count, "$orderby": "receivedDateTime desc",
               "$select": "subject,from,receivedDateTime,bodyPreview,body"}
    r = httpx.get(f"{GRAPH_BASE}/me/messages", headers=headers, params=params, timeout=30)
    r.raise_for_status()
    return r.json().get("value", [])


def fetch_calendar_events(token: str, days: int = 30) -> list[dict]:
    headers = {"Authorization": f"Bearer {token}", "Prefer": 'outlook.timezone="Europe/Paris"'}
    start = datetime.now(timezone.utc).isoformat()
    end = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
    params = {
        "startDateTime": start, "endDateTime": end, "$top": 100,
        "$select": "subject,organizer,start,end,location,bodyPreview,attendees",
        "$orderby": "start/dateTime asc",
    }
    r = httpx.get(f"{GRAPH_BASE}/me/calendarView", headers=headers, params=params, timeout=30)
    r.raise_for_status()
    return r.json().get("value", [])


def fetch_user_info(token: str) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    r = httpx.get(f"{GRAPH_BASE}/me", headers=headers,
                  params={"$select": "id,mail,userPrincipalName,displayName"}, timeout=10)
    r.raise_for_status()
    data = r.json()
    return {
        "id": data.get("id", ""),
        "email": data.get("mail") or data.get("userPrincipalName", ""),
        "name": data.get("displayName", ""),
    }


# ── Texte indexable ──────────────────────────────────────────────────────────

def email_to_text(email: dict) -> str:
    subject = email.get("subject", "(sans objet)")
    sender = email.get("from", {}).get("emailAddress", {})
    from_str = f"{sender.get('name', '')} <{sender.get('address', '')}>".strip(" <>")
    date = email.get("receivedDateTime", "")[:10]
    body = email.get("bodyPreview", "") or ""
    return f"Mail | De : {from_str} | Date : {date} | Sujet : {subject}\n{body}"


def event_to_text(event: dict) -> str:
    subject = event.get("subject", "(sans titre)")
    start = event.get("start", {}).get("dateTime", "")[:16].replace("T", " ")
    end = event.get("end", {}).get("dateTime", "")[:16].replace("T", " ")
    location = event.get("location", {}).get("displayName", "")
    organizer = event.get("organizer", {}).get("emailAddress", {}).get("name", "")
    body = event.get("bodyPreview", "") or ""
    parts = [f"Événement : {subject} | Début : {start} | Fin : {end}"]
    if location:
        parts.append(f"Lieu : {location}")
    if organizer:
        parts.append(f"Organisateur : {organizer}")
    if body:
        parts.append(body)
    return "\n".join(parts)


# ── Sync complète ─────────────────────────────────────────────────────────────

def sync_outlook_data() -> dict:
    token = get_valid_token()
    emails = fetch_recent_emails(token, count=50)
    events = fetch_calendar_events(token, days=30)
    logger.info("Outlook : %d mails et %d événements.", len(emails), len(events))

    delete_by_filename(OUTLOOK_MAIL_FILENAME)
    delete_by_filename(OUTLOOK_CAL_FILENAME)
    total_chunks = 0

    if emails:
        mail_pages = [{"page": i + 1, "text": email_to_text(e)} for i, e in enumerate(emails)]
        mail_chunks = chunk_pages(mail_pages, filename=OUTLOOK_MAIL_FILENAME)
        for chunk in mail_chunks:
            chunk["metadata"]["theme"] = "outlook_mail"
        total_chunks += insert_chunks(mail_chunks, generate_embeddings([c["content"] for c in mail_chunks]))

    if events:
        event_pages = [{"page": i + 1, "text": event_to_text(e)} for i, e in enumerate(events)]
        event_chunks = chunk_pages(event_pages, filename=OUTLOOK_CAL_FILENAME)
        for chunk in event_chunks:
            chunk["metadata"]["theme"] = "outlook_calendrier"
        total_chunks += insert_chunks(event_chunks, generate_embeddings([c["content"] for c in event_chunks]))

    logger.info("Sync Outlook terminée : %d chunks.", total_chunks)
    return {"mail_count": len(emails), "event_count": len(events), "chunks_inserted": total_chunks}
