"""
Routes d'authentification OAuth 2.0 — Microsoft Outlook.

GET /auth/outlook           → Redirige vers la page de connexion Microsoft
GET /auth/outlook/callback  → Reçoit le code, échange les tokens, redirige vers le frontend
"""

import logging
import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from services.outlook_service import exchange_code_for_tokens, fetch_user_email, save_tokens

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Auth"])


@router.get("/auth/outlook")
async def outlook_login():
    """Redirige l'utilisateur vers la page de connexion Microsoft."""
    try:
        from services.outlook_service import get_auth_url
        url = get_auth_url()
        return RedirectResponse(url=url)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Erreur génération URL auth Outlook : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur lors de l'initialisation OAuth.") from exc


@router.get("/auth/outlook/callback")
async def outlook_callback(code: str | None = None, error: str | None = None):
    """
    Reçoit le code d'autorisation Microsoft, échange les tokens,
    sauvegarde en base et redirige vers le frontend.
    """
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

    if error:
        logger.warning("Erreur OAuth Microsoft : %s", error)
        return RedirectResponse(url=f"{frontend_url}?outlook_error={error}")

    if not code:
        return RedirectResponse(url=f"{frontend_url}?outlook_error=no_code")

    try:
        tokens = exchange_code_for_tokens(code)
        email = fetch_user_email(tokens["access_token"])
        save_tokens(
            access_token=tokens["access_token"],
            refresh_token=tokens.get("refresh_token"),
            expires_in=tokens.get("expires_in", 3600),
            email=email,
        )
        logger.info("Compte Outlook connecté : %s", email)
        return RedirectResponse(url=f"{frontend_url}?outlook_connected=true")
    except ValueError as exc:
        logger.error("Erreur échange tokens : %s", exc)
        return RedirectResponse(url=f"{frontend_url}?outlook_error=token_exchange_failed")
    except Exception as exc:
        logger.exception("Erreur inattendue callback Outlook : %s", exc)
        return RedirectResponse(url=f"{frontend_url}?outlook_error=internal_error")
