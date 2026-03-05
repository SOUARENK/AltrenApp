"""
Routes Outlook/IMAP — connexion, statut, synchronisation, déconnexion.
Utilise IMAP (gratuit, sans Azure) via imap_service.
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.imap_service import (
    disconnect_outlook,
    get_outlook_status,
    sync_outlook_data,
    test_and_save,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Outlook"])


class ImapConnectRequest(BaseModel):
    email: str
    password: str


@router.post("/outlook/connect")
async def outlook_connect(body: ImapConnectRequest):
    """Connecte un compte Outlook via IMAP (email + mot de passe d'application)."""
    try:
        test_and_save(body.email, body.password)
        return {"message": "Compte connecté avec succès.", "email": body.email}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Erreur connexion IMAP : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur de connexion.") from exc


@router.get("/outlook/status")
async def outlook_status():
    """Statut de connexion Outlook (connecté, email, dernière sync)."""
    return get_outlook_status()


@router.post("/outlook/sync")
async def outlook_sync():
    """Synchronise les mails dans le RAG via IMAP."""
    try:
        result = sync_outlook_data()
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Erreur sync Outlook : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur synchronisation.") from exc


@router.delete("/outlook/disconnect")
async def outlook_disconnect():
    """Déconnecte le compte Outlook."""
    try:
        disconnect_outlook()
        return {"message": "Compte Outlook déconnecté."}
    except Exception as exc:
        logger.exception("Erreur déconnexion Outlook : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur déconnexion.") from exc
