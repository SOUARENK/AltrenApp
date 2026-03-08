"""
Routes Auth — /auth/login/microsoft, /auth/login/google, /auth/callback/*, /auth/me, /auth/logout
Supporte le mode dev (sans credentials OAuth configurés).

Session :
  Après un login OAuth réussi, on génère un token opaque (secrets.token_urlsafe(32))
  et on le stocke dans _sessions (dict en mémoire).
  Ce token est retourné au frontend via le redirect URL et envoyé dans
  chaque requête en tant que Authorization: Bearer <session_token>.
  Note : les sessions sont perdues au redémarrage du serveur (acceptable en dev/demo).
"""

import logging
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import httpx
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

# ── Store de sessions en mémoire ─────────────────────────────────────────────
# Clé : session_token (str opaque)
# Valeur : {"provider": "microsoft"|"google", "email": str, "name": str}
_sessions: dict[str, dict] = {}
_MAX_SESSIONS = 500  # évite une fuite mémoire si beaucoup de connexions


def _store_session(token: str, provider: str, email: str, name: str) -> None:
    """Enregistre une session. Évicte la plus ancienne si la limite est atteinte."""
    if len(_sessions) >= _MAX_SESSIONS:
        oldest = next(iter(_sessions))
        del _sessions[oldest]
    _sessions[token] = {"provider": provider, "email": email, "name": name}


def _get_session(token: str) -> dict | None:
    return _sessions.get(token)


def _remove_session(token: str) -> None:
    _sessions.pop(token, None)


def _azure_configured() -> bool:
    return bool(os.getenv("AZURE_CLIENT_ID") and os.getenv("AZURE_CLIENT_SECRET"))


def _google_configured() -> bool:
    return bool(os.getenv("GOOGLE_CLIENT_ID") and os.getenv("GOOGLE_CLIENT_SECRET"))


# ── Microsoft OAuth ──────────────────────────────────────────────────────────

@router.post("/auth/login/microsoft", response_model=AuthUrlResponse)
async def login_microsoft():
    """Retourne l'URL de connexion Microsoft OAuth."""
    if not _azure_configured():
        raise HTTPException(
            status_code=503,
            detail="Azure non configuré. Renseignez AZURE_CLIENT_ID et AZURE_CLIENT_SECRET dans backend/.env.",
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
    """Callback OAuth Microsoft — échange le code, crée une session et redirige vers le frontend."""
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
            name=user_info.get("name", ""),
        )
        # Token opaque aléatoire — ne contient aucune donnée de l'access_token Microsoft
        session_token = secrets.token_urlsafe(32)
        _store_session(session_token, "microsoft", user_info["email"], user_info.get("name", ""))
        logger.info("Connexion Microsoft réussie : %s", user_info["email"])
        return RedirectResponse(url=f"{frontend_url}/auth/callback?token={session_token}")
    except ValueError as exc:
        logger.error("Erreur échange tokens Microsoft : %s", exc)
        return RedirectResponse(url=f"{frontend_url}/auth/callback?error=token_exchange_failed")
    except Exception as exc:
        logger.exception("Erreur callback Microsoft : %s", exc)
        return RedirectResponse(url=f"{frontend_url}/auth/callback?error=internal_error")


# ── Google OAuth ─────────────────────────────────────────────────────────────

@router.post("/auth/login/google", response_model=AuthUrlResponse)
async def login_google():
    """Retourne l'URL de connexion Google OAuth."""
    if not _google_configured():
        # Mode dev : token fictif directement sans vraie connexion Google
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        dev_token = secrets.token_urlsafe(32)
        _store_session(dev_token, "google", "dev@alternapp.local", "Dev Google")
        return AuthUrlResponse(
            auth_url=f"{frontend_url}/auth/callback?token={dev_token}",
            state="dev-state",
        )
    try:
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/callback/google")
        state = str(uuid.uuid4())
        # Les scopes sont encodés correctement pour une URL valide
        scopes = quote("openid email profile https://www.googleapis.com/auth/calendar.readonly")
        auth_url = (
            f"https://accounts.google.com/o/oauth2/v2/auth"
            f"?client_id={quote(client_id or '', safe='')}"
            f"&redirect_uri={quote(redirect_uri, safe='')}"
            f"&response_type=code"
            f"&scope={scopes}"
            f"&state={state}"
            f"&access_type=offline"
            f"&prompt=consent"
        )
        return AuthUrlResponse(auth_url=auth_url, state=state)
    except Exception as exc:
        logger.exception("Erreur génération URL Google : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur OAuth Google.") from exc


@router.get("/auth/callback/google")
async def google_callback(code: str | None = None, error: str | None = None, state: str | None = None):
    """Callback OAuth Google — échange le code, sauvegarde les tokens et crée une session."""
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

    if error:
        return RedirectResponse(url=f"{frontend_url}/auth/callback?error={error}")
    if not code:
        return RedirectResponse(url=f"{frontend_url}/auth/callback?error=no_code")

    if not _google_configured():
        # Mode dev sans credentials Google configurés
        session_token = secrets.token_urlsafe(32)
        _store_session(session_token, "google", "dev@alternapp.local", "Dev Google")
        return RedirectResponse(url=f"{frontend_url}/auth/callback?token={session_token}")

    try:
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/callback/google")

        # Échange du code contre les tokens Google
        token_resp = httpx.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=15,
        )
        token_resp.raise_for_status()
        tokens = token_resp.json()

        # Récupération des infos utilisateur Google
        user_resp = httpx.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
            timeout=10,
        )
        user_resp.raise_for_status()
        user_data = user_resp.json()

        # Sauvegarde des tokens Google dans Supabase (même table oauth_tokens, provider="google")
        from services.outlook_service import _get_supabase
        supabase = _get_supabase()
        expires_in = tokens.get("expires_in", 3600)
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()
        record = {
            "provider": "google",
            "access_token": tokens["access_token"],
            "refresh_token": tokens.get("refresh_token"),
            "expires_at": expires_at,
            "email": user_data.get("email", ""),
            "name": user_data.get("name", ""),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        existing = supabase.table("oauth_tokens").select("id").eq("provider", "google").execute()
        if existing.data:
            supabase.table("oauth_tokens").update(record).eq("provider", "google").execute()
        else:
            supabase.table("oauth_tokens").insert(record).execute()

        session_token = secrets.token_urlsafe(32)
        _store_session(session_token, "google", user_data.get("email", ""), user_data.get("name", ""))
        logger.info("Connexion Google réussie : %s", user_data.get("email"))
        return RedirectResponse(url=f"{frontend_url}/auth/callback?token={session_token}")

    except httpx.HTTPStatusError as exc:
        logger.error("Erreur HTTP Google token exchange : %s", exc)
        return RedirectResponse(url=f"{frontend_url}/auth/callback?error=google_token_failed")
    except Exception as exc:
        logger.exception("Erreur callback Google : %s", exc)
        return RedirectResponse(url=f"{frontend_url}/auth/callback?error=internal_error")


# ── Session ──────────────────────────────────────────────────────────────────

@router.get("/auth/me", response_model=UserResponse)
async def get_me(request: Request):
    """
    Retourne les infos de l'utilisateur connecté.
    Priorité :
      1. Token dev → retourne DEV_USER
      2. Session connue → retourne l'utilisateur de la session
         - Microsoft : récupère les infos fraîches depuis Graph API
         - Google : retourne les infos stockées en session
      3. Fallback → DEV_USER
    """
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "").strip()

    if not token or token.startswith("dev-") or token == "mock-jwt-token-dev":
        return DEV_USER

    session = _get_session(token)

    if session and session["provider"] == "google":
        return UserResponse(
            id=f"google-{session['email']}",
            name=session.get("name", "Utilisateur"),
            email=session.get("email", ""),
        )

    if session and session["provider"] == "microsoft":
        try:
            from services.outlook_service import fetch_user_info, get_valid_token
            ms_token = get_valid_token()
            user_info = fetch_user_info(ms_token)
            return UserResponse(
                id=user_info.get("id", str(uuid.uuid4())),
                name=user_info.get("name", session.get("name", "Utilisateur")),
                email=user_info.get("email", session.get("email", "")),
            )
        except Exception:
            # Fallback sur les données de la session si Graph API indisponible
            return UserResponse(
                id=str(uuid.uuid4()),
                name=session.get("name", "Utilisateur"),
                email=session.get("email", ""),
            )

    # Token non reconnu → tenter de récupérer l'utilisateur Outlook si connecté
    try:
        from services.outlook_service import fetch_user_info, get_valid_token
        ms_token = get_valid_token()
        user_info = fetch_user_info(ms_token)
        return UserResponse(
            id=user_info.get("id", str(uuid.uuid4())),
            name=user_info.get("name", "Utilisateur"),
            email=user_info.get("email", ""),
        )
    except Exception:
        return DEV_USER


@router.post("/auth/logout")
async def logout(request: Request):
    """Déconnexion — invalide la session en mémoire."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "").strip()
    if token:
        _remove_session(token)
    return {"message": "Déconnecté avec succès."}
