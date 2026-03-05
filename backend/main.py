"""
=============================================================================
AlternApp — Backend FastAPI Unifié
=============================================================================
Lancement :
    cd backend
    uvicorn main:app --reload --port 8000

Routes :
    /auth/*          → authentification OAuth Microsoft + Google
    /chat            → chatbot RAG (POST question, POST upload, GET history)
    /agenda/*        → calendrier unifié (Outlook/Teams)
    /dashboard/*     → tableau de bord alternant
    /documents/*     → arborescence + recherche sémantique + gestion fichiers
    /outlook/*       → sync Outlook (mails + calendrier → RAG)
    /ingest          → ingestion directe de documents
    /health          → santé de l'API
=============================================================================
"""

import logging
import os
import sys

from dotenv import find_dotenv, load_dotenv

# Charger .env en premier
load_dotenv(find_dotenv())

_required_vars = ["OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
_missing = [v for v in _required_vars if not os.getenv(v)]
if _missing:
    print(f"ERREUR : Variables d'environnement manquantes : {_missing}", file=sys.stderr)
    print("Vérifie le fichier .env dans le dossier backend/", file=sys.stderr)
    sys.exit(1)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routes import auth, chat, documents, agenda, dashboard, outlook, revision, connect

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ── Application ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="AlternApp API",
    description="Backend unifié — RAG Chatbot, Agenda, Dashboard, Documents",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "PATCH", "PUT", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)

# ── Routes ───────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(documents.router)
app.include_router(agenda.router)
app.include_router(dashboard.router)
app.include_router(outlook.router)
app.include_router(revision.router)
app.include_router(connect.router)

# ── Fichiers uploadés ────────────────────────────────────────────────────────

_uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(_uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_uploads_dir), name="uploads")

# ── Health ───────────────────────────────────────────────────────────────────

@app.get("/health", tags=["Monitoring"])
async def health_check():
    """Vérifie que l'API est opérationnelle."""
    return {
        "status": "ok",
        "version": "2.0.0",
        "services": {
            "openai": bool(os.getenv("OPENAI_API_KEY")),
            "supabase": bool(os.getenv("SUPABASE_URL")),
            "azure_oauth": bool(os.getenv("AZURE_CLIENT_ID")),
            "google_oauth": bool(os.getenv("GOOGLE_CLIENT_ID")),
            "jira": bool(os.getenv("JIRA_BASE_URL")),
        },
    }
