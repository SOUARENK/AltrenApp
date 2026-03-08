# Architecture Technique — Partie 1 : Backend Core + Agent IA

Version : 1.0 | Date : Mars 2026 | Statut : Actif

---

# 1. Vue d'Ensemble

Le backend est le point central d'AlternApp. Il reçoit toutes les requêtes du frontend, orchestre les connecteurs, et gère la base de données, l'authentification et le moteur RAG.

## Flux global

Frontend (React)
    ↓ HTTP REST (JSON)
API FastAPI (main.py)
    ├── routes/auth.py      → services/auth_service.py    → Azure AD / Google OAuth
    ├── routes/chat.py      → services/rag_engine.py      → OpenAI Embeddings
    │                       → services/llm_service.py     → Claude API (Anthropic)
    │                       → Supabase (pgvector search)
    ├── routes/agenda.py    → services/connector_orchestrator.py → Connecteurs
    ├── routes/documents.py → services/connector_orchestrator.py → Connecteurs
    └── routes/dashboard.py → services/connector_orchestrator.py → Connecteurs

---

# 2. Schéma de Base de Données

## Table users

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    microsoft_token_encrypted TEXT,
    google_token_encrypted TEXT,
    jira_api_token_encrypted TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

## Table documents

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX documents_user_idx ON documents(user_id);
CREATE INDEX documents_embedding_idx ON documents
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

## Table conversations

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

## Table messages

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    sources JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

## Table connector_cache

CREATE TABLE connector_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connector TEXT NOT NULL,
    data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

---

# 3. Fonction SQL de Recherche Vectorielle

CREATE OR REPLACE FUNCTION match_documents(
    query_embedding VECTOR(1536),
    match_count INT DEFAULT 5,
    similarity_threshold FLOAT DEFAULT 0.3,
    p_user_id UUID
)
RETURNS TABLE (id UUID, content TEXT, metadata JSONB, similarity FLOAT)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT d.id, d.content, d.metadata,
        1 - (d.embedding <=> query_embedding) AS similarity
    FROM documents d
    WHERE d.user_id = p_user_id
    AND 1 - (d.embedding <=> query_embedding) > similarity_threshold
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

---

# 4. Pipeline RAG

## Ingestion

PDF (bytes)
→ pypdf (extraction page par page)
→ text_cleaner (nettoyage)
→ tiktoken (chunking 700 tokens, overlap 75)
→ OpenAI Embeddings (1536 dim)
→ Supabase INSERT (content + embedding + metadata + user_id)

## Retrieval + Generation

Question (texte)
→ OpenAI Embedding (même modèle)
→ Supabase match_documents (Top 5, seuil 0.3, filtre user_id)
→ Si 0 chunk : message de refus (pas d'appel LLM)
→ Construction prompt (system + contexte numéroté + question)
→ Claude API (temperature=0, max_tokens=4096)
→ Réponse + sources retournées au frontend

## Construction du prompt

System: {SYSTEM_PROMPT}

User:
Contexte extrait des documents :
---
[Document 1 | Source: cours.pdf | Page: 3]
{chunk_1_content}

[Document 2 | Source: cours.pdf | Page: 4]
{chunk_2_content}
---

Question : {question_utilisateur}

---

# 5. Authentification — Flow OAuth 2.0

## Microsoft
1. Frontend → POST /auth/login/microsoft → Backend génère l'URL Azure AD (via MSAL)
2. Redirect → Page de login Azure AD
3. Azure AD → Redirect vers /auth/callback/microsoft?code=...
4. Backend échange le code contre access_token + refresh_token (via MSAL)
5. Backend stocke les tokens dans oauth_tokens (Supabase), provider="microsoft"
6. Backend génère un token de session opaque (secrets.token_urlsafe(32))
7. Session stockée en mémoire : token → {provider, email, name}
8. Redirect vers frontend/auth/callback?token=<session_token>
9. Frontend stocke le token et l'inclut dans : Authorization: Bearer <session_token>

## Google
1. Frontend → POST /auth/login/google → Backend génère l'URL Google OAuth2
2. Redirect → Page de login Google
3. Google → Redirect vers /auth/callback/google?code=...
4. Backend échange le code (POST https://oauth2.googleapis.com/token)
5. Backend récupère les infos user (GET https://www.googleapis.com/oauth2/v3/userinfo)
6. Backend stocke les tokens dans oauth_tokens, provider="google"
7. Session opaque générée et stockée en mémoire
8. Redirect vers frontend/auth/callback?token=<session_token>

## Validation (/auth/me)
- Token "dev-*" → retourne DEV_USER (mode développement sans backend)
- Token connu en session + provider=google → retourne infos de session
- Token connu en session + provider=microsoft → appel frais à Microsoft Graph /me
- Token inconnu mais Outlook connecté → fallback sur Graph API
- Sinon → retourne DEV_USER

## Déconnexion (/auth/logout)
- Invalidation du token dans le store de sessions en mémoire

Note : le store de sessions est un dict Python en mémoire. Les sessions sont perdues
au redémarrage du serveur (acceptable en dev/demo). En production → Redis ou table Supabase.

---

# 6. Sécurité

* HTTPS (TLS 1.3) en transit
* Tokens OAuth stockés dans Supabase (oauth_tokens) — à chiffrer en production
* Session token : opaque, 43 caractères aléatoires (secrets.token_urlsafe(32))
* Ne contient aucune donnée dérivée des tokens OAuth
* CORS : origines frontend uniquement (configurables via CORS_ALLOWED_ORIGINS)
* Scopes OAuth encodés correctement dans les URLs (urllib.parse.quote)
* Refresh automatique des tokens Microsoft (via MSAL) à l'expiration

---

# 7. Performance

| Métrique | Cible | Stratégie |
|---|---|---|
| Temps réponse /chat | < 5s | Cache embeddings, index ivfflat |
| Temps ingestion 10p | < 30s | Batch embeddings (100/appel) |
| Mémoire | < 512 MB | Streaming PDF |
| Sync connecteurs | < 15 min | Cache dans connector_cache |

---

# Architecture Technique — Partie 2 : Frontend & Interface

Version : 1.0 | Date : Mars 2026 | Statut : Actif

---

# 1. Vue d'Ensemble

Le frontend est une app React (TypeScript) qui communique exclusivement avec le backend via REST. Il ne connaît pas Supabase, pas Claude API, pas Microsoft Graph. Aucune clé API.

Flux :
Utilisateur → React Components → hooks → services/api.ts → fetch() → Backend → JSON → React → DOM

---

# 2. Routes

| Route | Page | Dans Layout | Notes |
|---|---|---|---|
| /login | Login.tsx | Non | Page de connexion OAuth |
| /auth/callback | AuthCallback.tsx | Non | Reçoit le token OAuth après redirect |
| / | Dashboard.tsx | Oui | Tableau de bord |
| /chat | Chat.tsx | Oui | Chatbot RAG |
| /chat/:id | Chat.tsx | Oui | Conversation existante |
| /agenda | Agenda.tsx | Oui | Calendrier unifié |
| /files | Files.tsx | Oui | Arborescence documents |
| /revision | Revision.tsx | Oui | Hub flashcards/QCM |
| /revision/sheet | RevisionSheet.tsx | Oui | Affichage fiche HTML |
| /settings | Settings.tsx | Oui | Connexion Outlook, thème |
| /mail | Mail.tsx | Oui | Boîte de réception Outlook |
| /profile | Profile.tsx | Oui | Stats et médailles utilisateur |

---

# 3. Arborescence

frontend/
├── src/
│   ├── App.tsx                      ← Router principal
│   ├── main.tsx
│   ├── index.css
│   ├── pages/
│   │   ├── Login.tsx               ← Connexion Microsoft / Google / Dev
│   │   ├── AuthCallback.tsx        ← Reçoit le token OAuth du backend
│   │   ├── Dashboard.tsx           ← Vue d'ensemble du jour
│   │   ├── Chat.tsx                ← Interface chatbot RAG
│   │   ├── Agenda.tsx              ← Calendrier unifié
│   │   ├── Files.tsx               ← Documents indexés
│   │   ├── Revision.tsx            ← Hub révision (flashcards, QCM, fiches)
│   │   ├── RevisionSheet.tsx       ← Affichage fiche HTML générée
│   │   ├── Settings.tsx            ← Paramètres Outlook + thème
│   │   ├── Mail.tsx                ← Boîte de réception Outlook
│   │   └── Profile.tsx             ← Profil + médailles gamification
│   ├── components/
│   │   ├── layout/ (Sidebar, Layout)
│   │   ├── chat/ (ChatWindow, MessageBubble, ChatInput, LoadingDots, SourcesAccordion, ChatSidebar)
│   │   ├── dashboard/ (TodayCard, TasksCard, AgendaPreview)
│   │   ├── agenda/ (CalendarView, EventModal)
│   │   ├── files/ (FileTree, FilePreview)
│   │   ├── revision/ (FlashCard, QuizView)
│   │   └── shared/ (SkeletonLoader, ErrorMessage)
│   ├── services/api.ts              ← Client HTTP (BASE_URL = localhost:8000 par défaut)
│   ├── types/index.ts
│   ├── hooks/ (useAuth, useChat, useAgenda)
│   ├── contexts/
│   │   ├── AuthContext.tsx         ← Auth state (DEV_USER par défaut)
│   │   └── ThemeContext.tsx        ← Thème clair/sombre
│   └── utils/profileStats.ts       ← Calcul médailles depuis localStorage
├── .env.local (VITE_API_URL=http://localhost:8000)
├── package.json
├── tsconfig.json
└── vite.config.ts

---

# 4. Client API (services/api.ts)

BASE_URL par défaut : http://localhost:8000 (surcharger via VITE_API_URL)

Fonctions exposées :
* loginMicrosoft() / loginGoogle() → redirect URL
* getMe() → User
* logout() → void
* sendQuestion(question, mode, conversationId) → ChatResponse
* uploadPDF(file) → UploadResponse
* getChatHistory() / getConversation(id) / deleteConversation(id)
* searchConversations(q) → Conversation[]
* getAgendaEvents(start, end) → AgendaEvent[]
* getAgendaToday() → TodaySummary
* getDashboardSummary() → DashboardData
* getDashboardTasks() → Task[]
* getDocumentList() / getDocumentTree(path) → FileItem[]
* searchDocuments(query) → SearchResult[]
* deleteDocument(filename) / moveDocument(filename, theme, subfolder)
* ingestFile(file, theme, subfolder) → {filename, chunks}
* generateRevision(params) → RevisionResult
* getOutlookStatus() / syncOutlook() / disconnectOutlook()
* getMailInbox() / getMailMessage(id) / markMailRead(id) / deleteMail(id) / replyMail(id, comment)
* getConnectionsStatus() / connectEmail() / connectCalendar() / syncEmail() / syncCalendar()

---

# 5. Responsive

| Taille | Breakpoint | Layout |
|---|---|---|
| Mobile | < 768px | Sidebar cachée (hamburger), colonne unique |
| Tablette | 768-1024px | Sidebar collapsée (icônes) |
| Desktop | > 1024px | Sidebar ouverte, layout complet |

---

# 6. PWA

* manifest.json : name "AlternApp", theme_color #2563eb, background_color #0d0d0d
* Service Worker : cache des assets statiques
* Mode hors-ligne partiel (données cachées)

---

# Architecture Technique — Partie 3 : Intégrations & Connecteurs

Version : 1.0 | Date : Mars 2026 | Statut : Actif

---

# 1. Vue d'Ensemble

Les connecteurs sont des modules Python indépendants appelés par l'orchestrateur du backend.

Flux :
Frontend → Backend (orchestrateur) → Connecteur.fetch_events() → API Externe → Données → Backend → Frontend

---

# 2. Arborescence

connectors/
├── base_connector.py
├── microsoft/
│   ├── graph_client.py
│   ├── teams.py
│   ├── onedrive.py
│   └── outlook.py
├── project/
│   ├── jira.py
│   └── linear.py
├── school/
│   ├── ent_lise.py
│   └── google_cal.py
└── tests/

---

# 3. APIs Externes

| Connecteur | API | Auth | Scopes |
|---|---|---|---|
| Teams | Microsoft Graph v1.0 | OAuth 2.0 délégué | Calendars.Read, Chat.Read |
| OneDrive | Microsoft Graph v1.0 | OAuth 2.0 délégué | Files.Read, Files.Read.All |
| Outlook | Microsoft Graph v1.0 | OAuth 2.0 délégué | Mail.Read, Calendars.Read |
| Jira | REST API v3 | API Token (Basic) | read:jira-work |
| Linear | GraphQL API | API Key | read |
| ENT LISE | Scraping web | Session cookie | N/A |
| Google Cal | Calendar API v3 | OAuth 2.0 | calendar.readonly |

---

# 4. Helper GraphClient

class GraphClient:
    BASE_URL = "https://graph.microsoft.com/v1.0"
    def __init__(self, access_token):
        self.headers = {"Authorization": f"Bearer {access_token}"}
    def get(self, endpoint, params=None):
        response = requests.get(f"{self.BASE_URL}{endpoint}", headers=self.headers, params=params, timeout=10)
        response.raise_for_status()
        return response.json()

Partagé entre TeamsConnector, OneDriveConnector, OutlookConnector.

---

# 5. Pattern de Retry (tenacity)

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10),
       retry=retry_if_exception_type((TimeoutError, ConnectionError)))

Retrier : 429, timeout, ConnectionError
Ne PAS retrier : 401, 403, 404

---

# 6. Dépendances

requests
tenacity
playwright
beautifulsoup4
google-api-python-client
google-auth
pytest
responses
