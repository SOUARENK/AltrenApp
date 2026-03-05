"""
=============================================================================
AlternApp — Backend FastAPI  (Phase 1)
=============================================================================
Point d'entrée de l'application.

Lancement :
    cd backend
    uvicorn main:app --reload --port 8000

Structure :
    routes/chat.py       → POST /chat, GET /chat/history, POST /chat/upload
    routes/documents.py  → GET/DELETE /documents, POST /ingest
    routes/auth.py       → GET /auth/outlook + callback OAuth Microsoft
    routes/outlook.py    → GET /outlook/status, POST /outlook/sync, DELETE /outlook/disconnect
    services/            → rag_engine, llm_service, classifier_service, conversation_service
    models/              → schemas Pydantic
    utils/               → text_cleaner
=============================================================================
"""

import logging
import os
import sys

# ---------------------------------------------------------------------------
# Charger les variables d'environnement EN PREMIER
# ---------------------------------------------------------------------------
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())

_required_vars = ["OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
_missing = [v for v in _required_vars if not os.getenv(v)]
if _missing:
    print(f"ERREUR : Variables d'environnement manquantes : {_missing}", file=sys.stderr)
    print("Crée un fichier .env en te basant sur .env.example", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Imports FastAPI
# ---------------------------------------------------------------------------
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import auth, chat, documents, outlook

# ---------------------------------------------------------------------------
# Configuration des logs
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Application FastAPI
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AlternApp API",
    description="RAG Chatbot — Répond à partir des documents fournis",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    # Ajouter l'URL Vercel en production :
    # "https://your-app.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
app.include_router(chat.router)
app.include_router(documents.router)
app.include_router(auth.router)
app.include_router(outlook.router)


# ---------------------------------------------------------------------------
# Santé
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Monitoring"])
async def health_check():
    """Vérifie que l'API est opérationnelle."""
    return {"status": "ok", "version": "1.0.0"}
