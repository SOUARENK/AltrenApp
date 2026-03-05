"""
Routes Mail — GET /mail/inbox, GET /mail/inbox/{id}
Retourne les mails reçus depuis Outlook (Microsoft Graph API).
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Mail"])


def _format_email(e: dict) -> dict:
    """Convertit un objet Graph API mail en dict propre."""
    sender = e.get("from", {}).get("emailAddress", {})
    return {
        "id": e.get("id", ""),
        "subject": e.get("subject") or "(Sans objet)",
        "from_name": sender.get("name", ""),
        "from_email": sender.get("address", ""),
        "received_at": e.get("receivedDateTime", ""),
        "preview": e.get("bodyPreview", ""),
        "body_html": e.get("body", {}).get("content", ""),
        "body_type": e.get("body", {}).get("contentType", "text"),
        "is_read": e.get("isRead", True),
        "has_attachments": e.get("hasAttachments", False),
        "importance": e.get("importance", "normal"),
    }


@router.get("/mail/inbox")
async def get_inbox(count: int = Query(default=50, le=100)):
    """
    Retourne les mails reçus (boîte de réception Outlook).
    Nécessite une connexion Outlook active.
    """
    try:
        from services.outlook_service import fetch_recent_emails, get_valid_token
        token = get_valid_token()
        raw = fetch_recent_emails(token, count=count)
        emails = [_format_email(e) for e in raw]
        logger.info("Mail inbox : %d mails retournés.", len(emails))
        return {"emails": emails, "count": len(emails)}
    except ValueError:
        return {"emails": [], "count": 0, "not_connected": True}
    except Exception as exc:
        logger.warning("Erreur lecture inbox : %s", exc)
        raise HTTPException(status_code=502, detail=f"Impossible de lire la boîte mail : {exc}")


@router.get("/mail/inbox/{message_id}")
async def get_email(message_id: str):
    """
    Retourne un mail complet par son ID Graph API.
    """
    try:
        import httpx
        from services.outlook_service import get_valid_token, GRAPH_BASE
        token = get_valid_token()
        headers = {"Authorization": f"Bearer {token}"}
        params = {"$select": "id,subject,from,receivedDateTime,bodyPreview,body,isRead,hasAttachments,importance,toRecipients,ccRecipients"}
        r = httpx.get(f"{GRAPH_BASE}/me/messages/{message_id}", headers=headers, params=params, timeout=30)
        r.raise_for_status()
        return {"email": _format_email(r.json())}
    except ValueError:
        raise HTTPException(status_code=401, detail="Outlook non connecté.")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))
