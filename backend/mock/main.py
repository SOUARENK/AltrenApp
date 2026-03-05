"""
AlternApp — Mock Backend (suit le Contrat d'API exactement)
Lancer : uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI, Header, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid

app = FastAPI(title="AlternApp Mock API", version="1.0.0-mock")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# HELPERS
# ============================================================
MOCK_TOKEN = "mock-jwt-token-dev"


def auth(authorization: Optional[str] = None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail={"detail": "Token manquant ou invalide", "code": "UNAUTHORIZED",
                    "timestamp": datetime.utcnow().isoformat() + "Z"},
        )
    return authorization.removeprefix("Bearer ")


# ============================================================
# MOCK DATA
# ============================================================
MOCK_USER = {
    "id": "user-dev-001",
    "email": "dev@alternapp.local",
    "name": "Dev User",
    "microsoft_connected": True,
    "google_connected": True,
    "jira_connected": True,
    "created_at": "2026-03-01T10:00:00Z",
    "last_login": datetime.utcnow().isoformat() + "Z",
}

MOCK_CONVERSATIONS = {
    "conv-001": {
        "id": "conv-001",
        "title": "Questions sur le projet AlternApp",
        "created_at": "2026-03-14T09:00:00Z",
        "updated_at": "2026-03-14T09:15:00Z",
        "messages_count": 4,
        "messages": [
            {
                "id": "msg-001", "role": "user",
                "content": "Quels sont les objectifs du projet AlternApp ?",
                "sources": None, "created_at": "2026-03-14T09:00:00Z",
            },
            {
                "id": "msg-002", "role": "assistant",
                "content": "AlternApp est une plateforme intelligente pour les alternants, combinant un assistant IA (RAG), un agenda unifié, un gestionnaire de fichiers et un mode révision.",
                "sources": [{"content": "AlternApp vise à centraliser les outils de l'alternant...", "filename": "cahier_des_charges.pdf", "page": 2, "chunk_index": 1, "similarity": 0.92}],
                "created_at": "2026-03-14T09:00:03Z",
            },
            {
                "id": "msg-003", "role": "user",
                "content": "Quelles technologies sont utilisées ?",
                "sources": None, "created_at": "2026-03-14T09:10:00Z",
            },
            {
                "id": "msg-004", "role": "assistant",
                "content": "Le frontend utilise React + TypeScript + TailwindCSS. Le backend utilise Python/FastAPI avec Supabase et Claude Sonnet pour le RAG.",
                "sources": [{"content": "Stack technique : React 18+, FastAPI, Supabase...", "filename": "architecture.pdf", "page": 1, "chunk_index": 3, "similarity": 0.88}],
                "created_at": "2026-03-14T09:10:05Z",
            },
        ],
    },
    "conv-002": {
        "id": "conv-002",
        "title": "Révision — Droit du travail",
        "created_at": "2026-03-13T14:00:00Z",
        "updated_at": "2026-03-13T14:30:00Z",
        "messages_count": 2,
        "messages": [
            {
                "id": "msg-005", "role": "user",
                "content": "Explique-moi les règles du contrat d'apprentissage",
                "sources": None, "created_at": "2026-03-13T14:00:00Z",
            },
            {
                "id": "msg-006", "role": "assistant",
                "content": "Le contrat d'apprentissage est un contrat de travail signé entre un apprenti (16-29 ans), un employeur et un CFA. Sa durée est de 6 mois à 3 ans.",
                "sources": [{"content": "Art. L6221-1 du Code du travail — contrat d'apprentissage...", "filename": "droit_travail.pdf", "page": 5, "chunk_index": 2, "similarity": 0.95}],
                "created_at": "2026-03-13T14:00:04Z",
            },
        ],
    },
    "conv-003": {
        "id": "conv-003",
        "title": "Architecture logicielle — microservices",
        "created_at": "2026-03-12T10:00:00Z",
        "updated_at": "2026-03-12T10:45:00Z",
        "messages_count": 2,
        "messages": [
            {
                "id": "msg-007", "role": "user",
                "content": "Quelles sont les différences entre microservices et monolith ?",
                "sources": None, "created_at": "2026-03-12T10:00:00Z",
            },
            {
                "id": "msg-008", "role": "assistant",
                "content": "Un monolithe regroupe toutes les fonctionnalités dans une seule application, tandis que les microservices décomposent l'application en services indépendants communicant via API.",
                "sources": [{"content": "Comparaison architectures logicielles...", "filename": "cours_archi.pdf", "page": 12, "chunk_index": 5, "similarity": 0.91}],
                "created_at": "2026-03-12T10:00:05Z",
            },
        ],
    },
}

MOCK_EVENTS = [
    {"id": "evt-001", "title": "Daily stand-up équipe backend", "start": "2026-03-15T09:00:00Z", "end": "2026-03-15T09:15:00Z", "source": "teams", "source_label": "Entreprise", "color": "#3b82f6", "location": "Microsoft Teams", "description": None, "metadata": {"teams_link": "https://teams.microsoft.com/mock"}},
    {"id": "evt-002", "title": "Cours Mécanique des fluides", "start": "2026-03-15T11:00:00Z", "end": "2026-03-15T13:00:00Z", "source": "ent", "source_label": "École", "color": "#22c55e", "location": "Amphi B2", "description": None, "metadata": {}},
    {"id": "evt-003", "title": "Review PR #42 — Auth service", "start": "2026-03-15T14:00:00Z", "end": "2026-03-15T15:00:00Z", "source": "outlook", "source_label": "Entreprise", "color": "#3b82f6", "location": "Salle A3", "description": "Code review de la PR Auth", "metadata": {}},
    {"id": "evt-004", "title": "TD Droit du travail", "start": "2026-03-15T16:30:00Z", "end": "2026-03-15T18:00:00Z", "source": "ent", "source_label": "École", "color": "#22c55e", "location": "Salle 203", "description": None, "metadata": {}},
    {"id": "evt-005", "title": "Réunion de projet AlternApp", "start": "2026-03-16T10:00:00Z", "end": "2026-03-16T11:00:00Z", "source": "teams", "source_label": "Entreprise", "color": "#3b82f6", "location": "Teams", "description": "Revue avancement Sprint 3", "metadata": {}},
    {"id": "evt-006", "title": "Cours Architecture logicielle", "start": "2026-03-17T08:00:00Z", "end": "2026-03-17T10:00:00Z", "source": "ent", "source_label": "École", "color": "#22c55e", "location": "Amphi A1", "description": None, "metadata": {}},
    {"id": "evt-007", "title": "Formation Docker & Kubernetes", "start": "2026-03-17T14:00:00Z", "end": "2026-03-17T17:00:00Z", "source": "outlook", "source_label": "Entreprise", "color": "#3b82f6", "location": "Salle Formation", "description": None, "metadata": {}},
    {"id": "evt-008", "title": "Sprint Review S3", "start": "2026-03-18T15:00:00Z", "end": "2026-03-18T16:00:00Z", "source": "jira", "source_label": "Projet", "color": "#f59e0b", "location": "Teams", "description": "Démonstration du sprint 3", "metadata": {"jira_key": "ALT-50"}},
    {"id": "evt-009", "title": "Cours Gestion de projet agile", "start": "2026-03-18T09:00:00Z", "end": "2026-03-18T11:00:00Z", "source": "ent", "source_label": "École", "color": "#22c55e", "location": "Salle 105", "description": None, "metadata": {}},
    {"id": "evt-010", "title": "Entretien intermédiaire tuteur", "start": "2026-03-19T11:00:00Z", "end": "2026-03-19T12:00:00Z", "source": "outlook", "source_label": "Entreprise", "color": "#3b82f6", "location": "Bureau RH", "description": "Bilan mi-parcours alternance", "metadata": {}},
]

MOCK_FILES = [
    {"id": "f-001", "name": "Cours", "path": "/Cours", "is_folder": True, "size": None, "modified_at": "2026-03-14T18:00:00Z", "source": "onedrive_pro", "mime_type": None},
    {"id": "f-002", "name": "cahier_des_charges.pdf", "path": "/Cours/cahier_des_charges.pdf", "is_folder": False, "size": 2450000, "modified_at": "2026-03-12T10:30:00Z", "source": "onedrive_pro", "mime_type": "application/pdf"},
    {"id": "f-003", "name": "architecture.pdf", "path": "/Cours/architecture.pdf", "is_folder": False, "size": 1200000, "modified_at": "2026-03-10T09:00:00Z", "source": "onedrive_pro", "mime_type": "application/pdf"},
    {"id": "f-004", "name": "cours_archi_logicielle.pdf", "path": "/Cours/cours_archi_logicielle.pdf", "is_folder": False, "size": 3400000, "modified_at": "2026-03-09T14:00:00Z", "source": "onedrive_pro", "mime_type": "application/pdf"},
    {"id": "f-005", "name": "Projets", "path": "/Projets", "is_folder": True, "size": None, "modified_at": "2026-03-14T12:00:00Z", "source": "onedrive_pro", "mime_type": None},
    {"id": "f-006", "name": "rapport_sprint3.docx", "path": "/Projets/rapport_sprint3.docx", "is_folder": False, "size": 890000, "modified_at": "2026-03-14T12:00:00Z", "source": "onedrive_pro", "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    {"id": "f-007", "name": "specs_api.pdf", "path": "/Projets/specs_api.pdf", "is_folder": False, "size": 560000, "modified_at": "2026-03-11T08:30:00Z", "source": "onedrive_pro", "mime_type": "application/pdf"},
    {"id": "f-008", "name": "cours_mecanique.pdf", "path": "/Personnel/cours_mecanique.pdf", "is_folder": False, "size": 3100000, "modified_at": "2026-03-08T16:00:00Z", "source": "onedrive_perso", "mime_type": "application/pdf"},
    {"id": "f-009", "name": "fiches_droit.pdf", "path": "/Personnel/fiches_droit.pdf", "is_folder": False, "size": 780000, "modified_at": "2026-03-07T10:00:00Z", "source": "onedrive_perso", "mime_type": "application/pdf"},
]

MOCK_TASKS = [
    {"id": "ALT-38", "title": "Implémenter endpoint POST /auth/google", "status": "in_progress", "priority": "high", "project": "AlternApp", "assignee": "Dev User", "due_date": "2026-03-15", "url": "https://alternapp.atlassian.net/browse/ALT-38", "source": "jira"},
    {"id": "ALT-41", "title": "Fix: timeout sur l'upload de PDF", "status": "todo", "priority": "medium", "project": "AlternApp", "assignee": "Dev User", "due_date": "2026-03-17", "url": "https://alternapp.atlassian.net/browse/ALT-41", "source": "jira"},
    {"id": "ALT-42", "title": "Review PR Auth service", "status": "in_progress", "priority": "high", "project": "AlternApp", "assignee": "Dev User", "due_date": "2026-03-16", "url": "https://alternapp.atlassian.net/browse/ALT-42", "source": "jira"},
    {"id": "ALT-45", "title": "Intégrer connecteur ENT", "status": "todo", "priority": "medium", "project": "AlternApp", "assignee": "Dev User", "due_date": "2026-03-20", "url": "https://alternapp.atlassian.net/browse/ALT-45", "source": "jira"},
    {"id": "school-1", "title": "Finir rapport de stage — semaine 8", "status": "in_progress", "priority": "high", "project": "École", "assignee": "Dev User", "due_date": "2026-03-15", "url": None, "source": "jira"},
]

# ============================================================
# 1. AUTHENTIFICATION
# ============================================================

@app.post("/auth/login/microsoft")
def login_microsoft():
    return {
        "auth_url": f"http://localhost:5173/auth/callback?token={MOCK_TOKEN}",
        "state": "mock-csrf-state-ms",
    }


@app.post("/auth/login/google")
def login_google():
    return {
        "auth_url": f"http://localhost:5173/auth/callback?token={MOCK_TOKEN}",
        "state": "mock-csrf-state-google",
    }


@app.get("/auth/callback/microsoft")
@app.get("/auth/callback/google")
def auth_callback(code: str = "mock", state: str = "mock"):
    return {
        "access_token": MOCK_TOKEN,
        "token_type": "Bearer",
        "expires_in": 86400,
        "user": MOCK_USER,
    }


@app.get("/auth/me")
def get_me(authorization: Optional[str] = Header(None)):
    auth(authorization)
    return MOCK_USER


@app.post("/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    auth(authorization)
    return {"message": "Déconnexion réussie"}


# ============================================================
# 2. CHAT
# ============================================================

class ChatRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None
    mode: str = "general"


@app.post("/chat")
def chat(req: ChatRequest, authorization: Optional[str] = Header(None)):
    auth(authorization)
    conv_id = req.conversation_id or ("conv-" + str(uuid.uuid4())[:8])
    msg_id = "msg-" + str(uuid.uuid4())[:8]

    answers = {
        "general": f"Voici ma réponse à votre question : **{req.question}**\n\nJ'ai analysé les documents disponibles et trouvé plusieurs informations pertinentes. Voici un résumé détaillé basé sur les sources indexées.",
        "entreprise": f"En contexte entreprise : **{req.question}**\n\nD'après les documents OneDrive et les tickets Jira, voici ce que j'ai trouvé concernant votre question.",
        "revision": f"Pour la révision : **{req.question}**\n\nVoici les points clés à retenir pour votre examen, extraits des cours indexés.",
        "redaction": f"Pour la rédaction : **{req.question}**\n\nVoici une proposition de rédaction basée sur les documents disponibles.",
    }

    return {
        "answer": answers.get(req.mode, answers["general"]),
        "conversation_id": conv_id,
        "message_id": msg_id,
        "sources": [
            {"content": "Extrait pertinent du document principal...", "filename": "cahier_des_charges.pdf", "page": 3, "chunk_index": 7, "similarity": 0.87},
            {"content": "Deuxième source complémentaire...", "filename": "architecture.pdf", "page": 1, "chunk_index": 2, "similarity": 0.79},
        ],
        "chunks_found": 5,
        "model": "claude-sonnet-mock",
        "processing_time_ms": 1250,
    }


@app.post("/chat/upload")
async def upload_document(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
):
    auth(authorization)
    content = await file.read()
    return {
        "message": "Document indexé avec succès",
        "filename": file.filename,
        "chunks_count": max(1, len(content) // 500),
        "pages_count": max(1, len(content) // 3000),
        "processing_time_ms": 2500,
    }


@app.get("/chat/history")
def get_history(
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    authorization: Optional[str] = Header(None),
):
    auth(authorization)
    convs = list(MOCK_CONVERSATIONS.values())
    summaries = [
        {"id": c["id"], "title": c["title"], "created_at": c["created_at"],
         "updated_at": c["updated_at"], "messages_count": c["messages_count"]}
        for c in convs[offset: offset + limit]
    ]
    return {"conversations": summaries, "total": len(convs), "limit": limit, "offset": offset}


@app.get("/chat/history/{conversation_id}")
def get_conversation(conversation_id: str, authorization: Optional[str] = Header(None)):
    auth(authorization)
    conv = MOCK_CONVERSATIONS.get(conversation_id)
    if not conv:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Conversation non trouvée", "code": "NOT_FOUND",
                    "timestamp": datetime.utcnow().isoformat() + "Z"},
        )
    return conv


@app.get("/chat/documents")
def get_chat_documents(authorization: Optional[str] = Header(None)):
    auth(authorization)
    return {
        "documents": [
            {"filename": "cahier_des_charges.pdf", "chunks_count": 42, "pages_count": 15, "ingested_at": "2026-03-10T14:00:00Z"},
            {"filename": "architecture.pdf", "chunks_count": 28, "pages_count": 10, "ingested_at": "2026-03-11T09:30:00Z"},
            {"filename": "cours_mecanique.pdf", "chunks_count": 35, "pages_count": 12, "ingested_at": "2026-03-12T11:00:00Z"},
        ],
        "total_chunks": 105,
    }


@app.delete("/chat/documents")
def delete_all_documents(authorization: Optional[str] = Header(None)):
    auth(authorization)
    return {"message": "Tous les documents ont été supprimés", "deleted_chunks": 105}


@app.delete("/chat/documents/{filename}")
def delete_document(filename: str, authorization: Optional[str] = Header(None)):
    auth(authorization)
    return {"message": "Document supprimé", "filename": filename, "deleted_chunks": 35}


# ============================================================
# 3. AGENDA
# ============================================================

@app.get("/agenda/events")
def get_events(
    start: str,
    end: str,
    authorization: Optional[str] = Header(None),
):
    auth(authorization)
    return {
        "events": MOCK_EVENTS,
        "warnings": [],
        "sources_status": {
            "teams": "connected",
            "outlook": "connected",
            "google_calendar": "connected",
            "ent": "connected",
        },
    }


@app.get("/agenda/today")
def get_today(authorization: Optional[str] = Header(None)):
    auth(authorization)
    today_events = [e for e in MOCK_EVENTS if "2026-03-15" in e["start"]]
    return {
        "date": "2026-03-15",
        "events": today_events,
        "urgent_tasks": [
            {"id": "ALT-38", "title": "Finir le rapport de stage", "status": "in_progress",
             "priority": "high", "due_date": "2026-03-15", "source": "jira",
             "url": "https://alternapp.atlassian.net/browse/ALT-38"},
        ],
        "warnings": [],
    }


# ============================================================
# 4. DOCUMENTS
# ============================================================

@app.get("/documents/tree")
def get_tree(
    path: str = "/",
    source: Optional[str] = None,
    authorization: Optional[str] = Header(None),
):
    auth(authorization)
    files = MOCK_FILES if not source else [f for f in MOCK_FILES if f["source"] == source]
    return {"path": path, "files": files, "warnings": []}


@app.get("/documents/search")
def search_documents(
    q: str,
    limit: int = Query(10, le=50),
    authorization: Optional[str] = Header(None),
):
    auth(authorization)
    return {
        "query": q,
        "results": [
            {"content": f"Extrait pertinent pour « {q} »… (p.2)", "filename": "cahier_des_charges.pdf", "page": 2, "similarity": 0.89, "source": "rag"},
            {"content": f"Deuxième résultat pour « {q} »… (p.1)", "filename": "architecture.pdf", "page": 1, "similarity": 0.82, "source": "rag"},
            {"content": f"Troisième résultat pour « {q} »… (p.5)", "filename": "cours_archi_logicielle.pdf", "page": 5, "similarity": 0.75, "source": "rag"},
        ],
        "total": 3,
    }


# ============================================================
# 5. DASHBOARD
# ============================================================

@app.get("/dashboard/summary")
def get_summary(authorization: Optional[str] = Header(None)):
    auth(authorization)
    today_events = [e for e in MOCK_EVENTS if "2026-03-15" in e["start"]]
    return {
        "today": {
            "events_count": len(today_events),
            "events": today_events[:5],
            "tasks_urgent_count": 2,
        },
        "school": {
            "next_exams": [
                {"title": "Examen Droit du travail", "date": "2026-03-20", "source": "ent"},
                {"title": "Examen Architecture logicielle", "date": "2026-03-27", "source": "ent"},
                {"title": "Examen Management de projet", "date": "2026-04-03", "source": "ent"},
            ],
            "pending_assignments": [
                {"title": "Rendu TP Mécanique des fluides", "due_date": "2026-03-18", "source": "ent"},
            ],
        },
        "work": {
            "open_tickets": 4,
            "tickets": [t for t in MOCK_TASKS if t["source"] == "jira"][:5],
        },
        "documents_indexed": 105,
        "warnings": [],
        "sources_status": {
            "teams": "connected",
            "jira": "connected",
            "ent": "connected",
            "google_calendar": "connected",
        },
    }


@app.get("/dashboard/tasks")
def get_tasks(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    authorization: Optional[str] = Header(None),
):
    auth(authorization)
    tasks = list(MOCK_TASKS)
    if status:
        tasks = [t for t in tasks if t["status"] == status]
    if priority:
        tasks = [t for t in tasks if t["priority"] == priority]
    return {"tasks": tasks, "total": len(tasks), "warnings": []}


# ============================================================
# 6. HEALTH
# ============================================================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "1.0.0-mock",
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
