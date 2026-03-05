"""
Service email IMAP — connexion Outlook via IMAP (gratuit, sans Azure).
Utilise imaplib (stdlib Python) sur outlook.office365.com:993.
Pour les comptes avec 2FA : créer un mot de passe d'application sur
account.microsoft.com → Sécurité → Options de sécurité avancées.
"""

import email
import imaplib
import logging
import os
from datetime import datetime, timezone
from email.header import decode_header

logger = logging.getLogger(__name__)

IMAP_HOST = "outlook.office365.com"
IMAP_PORT = 993
OUTLOOK_MAIL_FILENAME = "outlook_mails"


def _get_supabase():
    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante.")
    return create_client(url, key)


def _decode_str(value: str) -> str:
    parts = decode_header(value or "")
    result = []
    for part, enc in parts:
        if isinstance(part, bytes):
            result.append(part.decode(enc or "utf-8", errors="replace"))
        else:
            result.append(str(part))
    return "".join(result)


# ── Connexion & credentials ───────────────────────────────────────────────────

def test_and_save(email_addr: str, password: str) -> None:
    """Vérifie la connexion IMAP puis sauvegarde les credentials dans Supabase."""
    imap = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    try:
        imap.login(email_addr, password)
        imap.logout()
    except imaplib.IMAP4.error as exc:
        raise ValueError(f"Connexion IMAP échouée : {exc}") from exc

    client = _get_supabase()
    record = {
        "provider": "imap",
        "access_token": password,
        "refresh_token": None,
        "expires_at": "9999-12-31T00:00:00+00:00",
        "email": email_addr,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    existing = client.table("oauth_tokens").select("id").eq("provider", "imap").execute()
    if existing.data:
        client.table("oauth_tokens").update(record).eq("provider", "imap").execute()
    else:
        client.table("oauth_tokens").insert(record).execute()
    logger.info("Credentials IMAP sauvegardés pour %s.", email_addr)


def get_credentials() -> tuple[str, str]:
    """Retourne (email, password) depuis Supabase."""
    client = _get_supabase()
    result = client.table("oauth_tokens").select("*").eq("provider", "imap").execute()
    if not result.data:
        raise ValueError("Compte email non configuré. Connectez-le dans les paramètres.")
    row = result.data[0]
    return row["email"], row["access_token"]


def get_outlook_status() -> dict:
    try:
        client = _get_supabase()
        result = client.table("oauth_tokens").select("email, updated_at").eq("provider", "imap").execute()
        if not result.data:
            return {"connected": False}
        row = result.data[0]
        return {"connected": True, "email": row.get("email"), "last_sync": row.get("updated_at")}
    except Exception:
        return {"connected": False}


def disconnect_outlook() -> None:
    client = _get_supabase()
    client.table("oauth_tokens").delete().eq("provider", "imap").execute()
    logger.info("Compte IMAP déconnecté.")


# ── Lecture des emails ────────────────────────────────────────────────────────

def _extract_body(msg: email.message.Message) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or "utf-8"
                    return payload.decode(charset, errors="replace")[:600]
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            return payload.decode(charset, errors="replace")[:600]
    return ""


def fetch_recent_emails(count: int = 50) -> list[dict]:
    email_addr, password = get_credentials()
    imap = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    imap.login(email_addr, password)
    imap.select("INBOX")

    _, msg_ids = imap.search(None, "ALL")
    ids = msg_ids[0].split()
    ids = ids[-count:][::-1]

    results = []
    for eid in ids:
        try:
            _, data = imap.fetch(eid, "(RFC822)")
            raw = data[0][1]
            msg = email.message_from_bytes(raw)
            results.append({
                "subject": _decode_str(msg.get("Subject", "(sans objet)")),
                "from": _decode_str(msg.get("From", "")),
                "date": msg.get("Date", "")[:25],
                "body": _extract_body(msg),
            })
        except Exception as exc:
            logger.warning("Erreur lecture email %s : %s", eid, exc)

    imap.logout()
    return results


def email_to_text(e: dict) -> str:
    return (
        f"Mail | De : {e.get('from', '')} | Date : {e.get('date', '')} "
        f"| Sujet : {e.get('subject', '')}\n{e.get('body', '')}"
    )


# ── Sync complète ─────────────────────────────────────────────────────────────

def sync_outlook_data() -> dict:
    from services.rag_engine import chunk_pages, delete_by_filename, generate_embeddings, insert_chunks

    emails = fetch_recent_emails(count=50)
    logger.info("IMAP : %d mails récupérés.", len(emails))

    delete_by_filename(OUTLOOK_MAIL_FILENAME)
    total_chunks = 0

    if emails:
        mail_pages = [{"page": i + 1, "text": email_to_text(e)} for i, e in enumerate(emails)]
        mail_chunks = chunk_pages(mail_pages, filename=OUTLOOK_MAIL_FILENAME)
        for chunk in mail_chunks:
            chunk["metadata"]["theme"] = "outlook_mail"
        total_chunks += insert_chunks(
            mail_chunks,
            generate_embeddings([c["content"] for c in mail_chunks]),
        )

    client = _get_supabase()
    client.table("oauth_tokens").update({
        "updated_at": datetime.now(timezone.utc).isoformat()
    }).eq("provider", "imap").execute()

    logger.info("Sync IMAP terminée : %d chunks.", total_chunks)
    return {"mail_count": len(emails), "event_count": 0, "chunks_inserted": total_chunks}
