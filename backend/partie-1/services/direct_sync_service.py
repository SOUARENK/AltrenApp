"""
Service de synchronisation directe Email (IMAP) et Calendrier (URL ICS).

Supporte plusieurs comptes email et plusieurs calendriers.
Connexion persistante dans Supabase (table connections).
"""

import email as email_lib
import imaplib
import logging
import os
from datetime import datetime, timezone
from email import policy as email_policy

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore

try:
    from icalendar import Calendar
except ImportError:
    Calendar = None  # type: ignore

from services.rag_engine import (
    chunk_pages,
    delete_by_filename,
    generate_embeddings,
    insert_chunks,
)

logger = logging.getLogger(__name__)

EMAIL_FILENAME = "sync_emails"
CALENDAR_FILENAME = "sync_calendrier"

IMAP_SERVERS: dict[str, str] = {
    "outlook.com":    "imap-mail.outlook.com",
    "hotmail.com":    "imap-mail.outlook.com",
    "live.com":       "imap-mail.outlook.com",
    "live.fr":        "imap-mail.outlook.com",
    "msn.com":        "imap-mail.outlook.com",
    "gmail.com":      "imap.gmail.com",
    "googlemail.com": "imap.gmail.com",
    "yahoo.com":      "imap.mail.yahoo.com",
    "yahoo.fr":       "imap.mail.yahoo.com",
    "icloud.com":     "imap.mail.me.com",
    "me.com":         "imap.mail.me.com",
}


def _get_supabase():
    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("Variables Supabase manquantes.")
    return create_client(url, key)


def _get_imap_server(email_addr: str) -> str:
    domain = email_addr.split("@")[-1].lower()
    return IMAP_SERVERS.get(domain, f"imap.{domain}")


# ---------------------------------------------------------------------------
# Persistance — plusieurs connexions par type autorisées
# ---------------------------------------------------------------------------

def add_connection(type_: str, config: dict, label: str = "") -> dict:
    """Insère une nouvelle connexion (plusieurs par type autorisé)."""
    client = _get_supabase()
    record = {
        "type": type_,
        "config": config,
        "label": label,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = client.table("connections").insert(record).execute()
    return result.data[0] if result.data else {}


def _get_connections(type_: str) -> list[dict]:
    """Retourne toutes les connexions d'un type donné."""
    client = _get_supabase()
    result = client.table("connections").select("*").eq("type", type_).execute()
    return result.data or []


def _get_connection(type_: str) -> dict | None:
    """Compatibilité : retourne la première connexion du type (ou None)."""
    conns = _get_connections(type_)
    return conns[0] if conns else None


def _delete_connection_by_id(id_: str) -> None:
    client = _get_supabase()
    client.table("connections").delete().eq("id", id_).execute()


def _update_last_sync_by_id(id_: str) -> None:
    client = _get_supabase()
    client.table("connections").update(
        {"last_sync": datetime.now(timezone.utc).isoformat()}
    ).eq("id", id_).execute()


# ---------------------------------------------------------------------------
# Email via IMAP
# ---------------------------------------------------------------------------

def connect_email(email_addr: str, password: str, imap_server: str | None = None) -> dict:
    """
    Teste la connexion IMAP et sauvegarde les identifiants en base.

    Pour Outlook/Gmail avec 2FA, utilisez un mot de passe d'application :
    - Outlook : account.microsoft.com → Sécurité → Mot de passe d'application
    - Gmail   : myaccount.google.com  → Sécurité → Mots de passe des applications
    """
    server = imap_server or _get_imap_server(email_addr)
    try:
        with imaplib.IMAP4_SSL(server, 993) as mail:
            mail.login(email_addr, password)
            mail.select("INBOX")
    except imaplib.IMAP4.error as exc:
        msg = str(exc)
        domain = email_addr.split("@")[-1].lower()
        if any(d in domain for d in ("outlook", "hotmail", "live", "msn")):
            hint = (
                " Conseil Outlook : activez IMAP dans Paramètres → Courrier → Synchronisation, "
                "et utilisez un mot de passe d'application (account.microsoft.com/security)."
            )
        elif any(d in domain for d in ("gmail", "googlemail")):
            hint = (
                " Conseil Gmail : activez IMAP dans Paramètres → Transfert/POP/IMAP, "
                "et créez un mot de passe d'application (myaccount.google.com → Sécurité → 2FA)."
            )
        else:
            hint = " Vérifiez que IMAP est activé dans les paramètres de votre messagerie."
        raise ValueError(f"Connexion échouée ({server}) : {msg}.{hint}") from exc
    except OSError as exc:
        raise ValueError(f"Serveur IMAP inaccessible ({server}) : {exc}") from exc

    conn = add_connection(
        "imap_email",
        {"email": email_addr, "password": password, "server": server},
        label=email_addr,
    )
    logger.info("Email IMAP connecté : %s via %s", email_addr, server)
    return {"id": conn.get("id"), "connected": True, "email": email_addr, "server": server}


def _fetch_emails_imap(server: str, email_addr: str, password: str, count: int) -> list[str]:
    """Récupère les N derniers emails via IMAP."""
    emails_text: list[str] = []
    with imaplib.IMAP4_SSL(server, 993) as mail:
        mail.login(email_addr, password)
        mail.select("INBOX")
        _, msg_numbers = mail.search(None, "ALL")
        all_ids = msg_numbers[0].split()
        recent_ids = all_ids[-count:] if len(all_ids) > count else all_ids
        for mid in reversed(recent_ids):
            _, msg_data = mail.fetch(mid, "(RFC822)")
            for part in msg_data:
                if not isinstance(part, tuple):
                    continue
                msg = email_lib.message_from_bytes(part[1], policy=email_policy.default)
                subject = str(msg.get("subject", "(sans objet)"))
                from_ = str(msg.get("from", ""))
                date_ = str(msg.get("date", ""))
                body = ""
                if msg.is_multipart():
                    for p in msg.walk():
                        if p.get_content_type() == "text/plain":
                            try:
                                body = p.get_content()
                                break
                            except Exception:
                                pass
                else:
                    try:
                        body = msg.get_content()
                    except Exception:
                        pass
                body = body.strip()[:1000]
                emails_text.append(
                    f"Mail | De : {from_} | Date : {date_} | Sujet : {subject}\n{body}"
                )
    return emails_text


def sync_emails(count: int = 50) -> dict:
    """Récupère les emails de tous les comptes connectés et les indexe dans le RAG."""
    conns = _get_connections("imap_email")
    if not conns:
        raise ValueError("Aucun email connecté.")

    all_emails_text: list[str] = []
    for conn in conns:
        cfg = conn["config"]
        try:
            texts = _fetch_emails_imap(cfg["server"], cfg["email"], cfg["password"], count)
            all_emails_text.extend(texts)
            _update_last_sync_by_id(conn["id"])
        except Exception as exc:
            logger.warning("Sync email %s échoué : %s", cfg.get("email"), exc)

    if not all_emails_text:
        return {"count": 0, "chunks_inserted": 0}

    delete_by_filename(EMAIL_FILENAME)
    GROUP = 10
    pages = [
        {"page": i // GROUP + 1, "text": "\n\n---\n\n".join(all_emails_text[i: i + GROUP])}
        for i in range(0, len(all_emails_text), GROUP)
    ]
    chunks = chunk_pages(pages, filename=EMAIL_FILENAME)
    for chunk in chunks:
        chunk["metadata"]["theme"] = "sync_email"

    embeddings = generate_embeddings([c["content"] for c in chunks])
    inserted = insert_chunks(chunks, embeddings)
    logger.info("Sync email : %d mails → %d chunks.", len(all_emails_text), inserted)
    return {"count": len(all_emails_text), "chunks_inserted": inserted}


def disconnect_email(id_: str) -> None:
    _delete_connection_by_id(id_)
    if not _get_connections("imap_email"):
        delete_by_filename(EMAIL_FILENAME)
    logger.info("Email déconnecté : %s", id_)


# ---------------------------------------------------------------------------
# Calendrier via URL ICS
# ---------------------------------------------------------------------------

def connect_calendar(ics_url: str) -> dict:
    """Teste le fetch de l'URL ICS et sauvegarde."""
    if httpx is None or Calendar is None:
        raise ValueError("Packages manquants : exécutez 'pip install httpx icalendar'")
    try:
        r = httpx.get(ics_url, timeout=15, follow_redirects=True)
        r.raise_for_status()
        Calendar.from_ical(r.content)
    except httpx.HTTPStatusError as exc:
        raise ValueError(f"URL inaccessible (HTTP {exc.response.status_code}).") from exc
    except Exception as exc:
        raise ValueError(f"Fichier ICS invalide ou URL incorrecte : {exc}") from exc

    label = ics_url.split("/")[2] if ics_url.count("/") >= 2 else ics_url[:40]
    conn = add_connection("ics_calendar", {"url": ics_url}, label=label)
    logger.info("Calendrier ICS connecté : %s", ics_url[:60])
    return {"id": conn.get("id"), "connected": True}


def _fetch_calendar_events(ics_url: str) -> list[str]:
    """Récupère et parse les événements depuis une URL ICS."""
    r = httpx.get(ics_url, timeout=30, follow_redirects=True)
    r.raise_for_status()
    cal = Calendar.from_ical(r.content)

    events: list[str] = []
    for component in cal.walk():
        if component.name != "VEVENT":
            continue
        summary = str(component.get("summary", "(sans titre)"))
        dtstart = component.get("dtstart")
        dtend = component.get("dtend")
        location = str(component.get("location", ""))
        description = str(component.get("description", ""))

        def fmt_dt(dt_val) -> str:
            if not dt_val:
                return ""
            dt = dt_val.dt
            return dt.strftime("%d/%m/%Y %H:%M") if hasattr(dt, "hour") else dt.strftime("%d/%m/%Y")

        parts = [f"Événement : {summary}"]
        if s := fmt_dt(dtstart):
            parts.append(f"Début : {s}")
        if e := fmt_dt(dtend):
            parts.append(f"Fin : {e}")
        if location not in ("", "None"):
            parts.append(f"Lieu : {location}")
        if description not in ("", "None"):
            parts.append(description[:400])
        events.append("\n".join(parts))
    return events


def sync_calendar() -> dict:
    """Synchronise tous les calendriers connectés dans le RAG."""
    if httpx is None or Calendar is None:
        raise ValueError("Packages manquants : exécutez 'pip install httpx icalendar'")
    conns = _get_connections("ics_calendar")
    if not conns:
        raise ValueError("Aucun calendrier connecté.")

    all_events: list[str] = []
    for conn in conns:
        try:
            events = _fetch_calendar_events(conn["config"]["url"])
            all_events.extend(events)
            _update_last_sync_by_id(conn["id"])
        except Exception as exc:
            logger.warning("Sync calendrier %s échoué : %s", conn.get("id"), exc)

    if not all_events:
        return {"count": 0, "chunks_inserted": 0}

    delete_by_filename(CALENDAR_FILENAME)
    GROUP = 20
    pages = [
        {"page": i // GROUP + 1, "text": "\n\n---\n\n".join(all_events[i: i + GROUP])}
        for i in range(0, len(all_events), GROUP)
    ]
    chunks = chunk_pages(pages, filename=CALENDAR_FILENAME)
    for chunk in chunks:
        chunk["metadata"]["theme"] = "sync_calendrier"

    embeddings = generate_embeddings([c["content"] for c in chunks])
    inserted = insert_chunks(chunks, embeddings)
    logger.info("Sync calendrier : %d événements → %d chunks.", len(all_events), inserted)
    return {"count": len(all_events), "chunks_inserted": inserted}


def disconnect_calendar(id_: str) -> None:
    _delete_connection_by_id(id_)
    if not _get_connections("ics_calendar"):
        delete_by_filename(CALENDAR_FILENAME)
    logger.info("Calendrier déconnecté : %s", id_)


# ---------------------------------------------------------------------------
# Statut global — retourne des listes (plusieurs comptes par type)
# ---------------------------------------------------------------------------

def get_connections_status() -> dict:
    email_conns = _get_connections("imap_email")
    cal_conns = _get_connections("ics_calendar")
    return {
        "email": [
            {
                "id": c["id"],
                "connected": True,
                "address": c["config"]["email"],
                "last_sync": c.get("last_sync"),
            }
            for c in email_conns
        ],
        "calendar": [
            {
                "id": c["id"],
                "connected": True,
                "label": c.get("label") or "Calendrier",
                "last_sync": c.get("last_sync"),
            }
            for c in cal_conns
        ],
    }
