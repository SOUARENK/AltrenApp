"""
Routes de connexion directe Email (IMAP) et Calendrier (ICS URL).
Supporte plusieurs comptes par type.
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.direct_sync_service import (
    connect_calendar,
    connect_email,
    disconnect_calendar,
    disconnect_email,
    get_connections_status,
    sync_calendar,
    sync_emails,
    _get_connections,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Connexions"])


class EmailCredentials(BaseModel):
    email: str
    password: str
    imap_server: str | None = None


class CalendarUrl(BaseModel):
    ics_url: str


@router.get("/connect/status")
async def connections_status():
    """Retourne la liste des comptes email et calendriers connectés."""
    return get_connections_status()


@router.post("/connect/email")
async def connect_email_route(body: EmailCredentials):
    """Connecte un compte email via IMAP."""
    try:
        return connect_email(body.email, body.password, body.imap_server)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Erreur connexion email : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur interne.") from exc


@router.post("/connect/calendar")
async def connect_calendar_route(body: CalendarUrl):
    """Connecte un calendrier via URL ICS."""
    try:
        return connect_calendar(body.ics_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Erreur connexion calendrier : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur interne.") from exc


@router.post("/connect/sync/email")
async def sync_email_route():
    """Synchronise tous les emails connectés dans le RAG (50 derniers par compte)."""
    try:
        return sync_emails(count=50)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Erreur sync email : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur lors de la synchronisation.") from exc


@router.post("/connect/sync/calendar")
async def sync_calendar_route():
    """Synchronise tous les calendriers connectés dans le RAG."""
    try:
        return sync_calendar()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Erreur sync calendrier : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur lors de la synchronisation.") from exc


@router.post("/connect/sync")
async def sync_all_route():
    """Synchronise email + calendrier en une seule requête."""
    results: dict = {}
    if _get_connections("imap_email"):
        try:
            results["email"] = sync_emails()
        except Exception as exc:
            results["email"] = {"error": str(exc)}
    if _get_connections("ics_calendar"):
        try:
            results["calendar"] = sync_calendar()
        except Exception as exc:
            results["calendar"] = {"error": str(exc)}
    return results


@router.delete("/connect/email/{id}")
async def disconnect_email_route(id: str):
    """Déconnecte un compte email par son id."""
    try:
        disconnect_email(id)
        return {"message": "Email déconnecté."}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/connect/calendar/{id}")
async def disconnect_calendar_route(id: str):
    """Déconnecte un calendrier par son id."""
    try:
        disconnect_calendar(id)
        return {"message": "Calendrier déconnecté."}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
