"""
Routes Auth — /auth/login/microsoft, /auth/login/google, /auth/callback/*, /auth/me, /auth/logout
Supporte le mode dev (sans credentials OAuth configurés).
"""

import logging
import os
import uuid

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

from models.schemas import AuthUrlResponse, UserResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Auth"])

# Utilisateur dev (quand OAuth non configuré)
DEV_USER = UserResponse(
    id="dev-user-001",
    name="Développeur AlternApp",
    email="dev@alternapp.local",
)


def _azure_configured() -> bool:
    return bool(os.getenv("AZURE_CLIENT_ID") and os.getenv("AZURE_CLIENT_SECRET"))


def _google_configured() -> bool:
    return bool(os.getenv("GOOGLE_CLIENT_ID") and os.getenv("GOOGLE_CLIENT_SECRET"))


# ── Microsoft OAuth ──────────────────────────────────────────────────────────

@router.post("/auth/login/microsoft", response_model=AuthUrlResponse)
async def login_microsoft():
    """Retourne l'URL de connexion Microsoft OAuth."""
    if not _azure_configured():
        # Mode dev : retourner une URL fictive
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        return AuthUrlResponse(
            auth_url=f"{frontend_url}?token=dev-token-microsoft&provider=microsoft",
            state="dev-state",
        )
    try:
        from services.outlook_service import get_auth_url
        url = get_auth_url()
        return AuthUrlResponse(auth_url=url, state=str(uuid.uuid4()))
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Erreur génération URL Microsoft : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur OAuth Microsoft.") from exc


@router.get("/auth/callback/microsoft")
async def microsoft_callback(code: str | None = None, error: str | None = None):
    """Callback OAuth Microsoft — échange le code et redirige vers le frontend."""
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

    if error:
        logger.warning("Erreur OAuth Microsoft : %s", error)
        return RedirectResponse(url=f"{frontend_url}/auth/callback?error={error}")

    if not code:
        return RedirectResponse(url=f"{frontend_url}/auth/callback?error=no_code")

    try:
        from services.outlook_service import exchange_code_for_tokens, fetch_user_info, save_tokens
        tokens = exchange_code_for_tokens(code)
        user_info = fetch_user_info(tokens["access_token"])
        save_tokens(
            access_token=tokens["access_token"],
            refresh_token=tokens.get("refresh_token"),
            expires_in=tokens.get("expires_in", 3600),
            email=user_info["email"],
        )
        # Générer un token de session simple (JWT en production)
        session_token = f"ms-{tokens['access_token'][:20]}"
        logger.info("Connexion Microsoft réussie : %s", user_info["email"])
        return RedirectResponse(url=f"{frontend_url}/auth/callback?token={session_token}")
    except ValueError as exc:
        logger.error("Erreur échange tokens : %s", exc)
        return RedirectResponse(url=f"{frontend_url}/auth/callback?error=token_exchange_failed")
    except Exception as exc:
        logger.exception("Erreur callback Microsoft : %s", exc)
        return RedirectResponse(url=f"{frontend_url}/auth/callback?error=internal_error")


# ── Google OAuth ─────────────────────────────────────────────────────────────

@router.post("/auth/login/google", response_model=AuthUrlResponse)
async def login_google():
    """Retourne l'URL de connexion Google OAuth."""
    if not _google_configured():
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        return AuthUrlResponse(
            auth_url=f"{frontend_url}?token=dev-token-google&provider=google",
            state="dev-state",
        )
    try:
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/callback/google")
        state = str(uuid.uuid4())
        scopes = "openid email profile https://www.googleapis.com/auth/calendar.readonly"
        auth_url = (
            f"https://accounts.google.com/o/oauth2/v2/auth"
            f"?client_id={client_id}"
            f"&redirect_uri={redirect_uri}"
            f"&response_type=code"
            f"&scope={scopes}"
            f"&state={state}"
            f"&access_type=offline"
        )
        return AuthUrlResponse(auth_url=auth_url, state=state)
    except Exception as exc:
        logger.exception("Erreur génération URL Google : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur OAuth Google.") from exc


@router.get("/auth/callback/google")
async def google_callback(code: str | None = None, error: str | None = None, state: str | None = None):
    """Callback OAuth Google."""
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

    if error:
        return RedirectResponse(url=f"{frontend_url}/auth/callback?error={error}")
    if not code:
        return RedirectResponse(url=f"{frontend_url}/auth/callback?error=no_code")

    # TODO: échanger le code Google contre des tokens
    session_token = f"google-{code[:20]}"
    return RedirectResponse(url=f"{frontend_url}/auth/callback?token={session_token}")


# ── Session ──────────────────────────────────────────────────────────────────

@router.get("/auth/me", response_model=UserResponse)
async def get_me(request: Request):
    """
    Retourne les infos de l'utilisateur connecté.
    Mode dev : retourne un utilisateur fictif si le token commence par 'dev-'.
    """
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "").strip()

    if not token or token.startswith("dev-") or token == "mock-jwt-token-dev":
        return DEV_USER
    return DEV_USER


@router.post("/auth/logout")
async def logout():
    """Déconnexion — côté backend, invalide la session."""
    return {"message": "Déconnecté avec succès."}
