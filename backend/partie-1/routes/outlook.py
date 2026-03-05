"""
Routes Outlook — statut, synchronisation, déconnexion.
"""

import logging

from fastapi import APIRouter, HTTPException

from services.outlook_service import (
    disconnect_outlook,
    get_outlook_status,
    sync_outlook_data,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Outlook"])


@router.get("/outlook/status")
async def outlook_status():
    """Retourne le statut de connexion Outlook (connecté, email, dernière sync)."""
    return get_outlook_status()


@router.post("/outlook/sync")
async def outlook_sync():
    """
    Synchronise les mails et événements calendrier Outlook dans le RAG.

    Retourne le nombre de mails, événements et chunks indexés.
    """
    try:
        result = sync_outlook_data()
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Erreur sync Outlook : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur lors de la synchronisation Outlook.") from exc


@router.delete("/outlook/disconnect")
async def outlook_disconnect():
    """Déconnecte le compte Outlook (supprime les tokens)."""
    try:
        disconnect_outlook()
        return {"message": "Compte Outlook déconnecté."}
    except Exception as exc:
        logger.exception("Erreur déconnexion Outlook : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur lors de la déconnexion.") from exc
