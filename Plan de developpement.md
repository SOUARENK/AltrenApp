# 0. Vue d'Ensemble

## Stack Technique

| Couche | Technologie |
|---|---|
| Langage | Python 3.11+ |
| Framework | FastAPI |
| Base de données | Supabase (PostgreSQL + pgvector) |
| LLM | Claude API (Anthropic) |
| Embeddings | OpenAI text-embedding-3-small |
| Auth | OAuth 2.0 (MSAL + Google Auth) |

---

# PHASE 1 — Restructuration du Projet RAG Existant

Durée estimée : 1 weekend

## 1.1 Arborescence cible

backend/
├── main.py                       # Point d'entrée FastAPI
├── routes/
│   ├── auth.py                   # Routes authentification
│   ├── chat.py                   # Routes chat IA (projet RAG actuel)
│   ├── documents.py              # Routes gestion fichiers
│   └── agenda.py                 # Routes agenda unifié
├── services/
│   ├── rag_engine.py             # Moteur RAG (chunking, embedding, search)
│   ├── llm_service.py            # Appels Claude API
│   ├── auth_service.py           # Logique OAuth 2.0
│   └── connector_orchestrator.py # Interface avec les connecteurs
├── models/
│   ├── user.py
│   ├── document.py
│   ├── conversation.py
│   └── schemas.py               # Schémas Pydantic
├── utils/
│   └── text_cleaner.py
├── .env
├── .env.example
├── requirements.txt
└── .gitignore

## 1.2 Extraction des services depuis main.py

* extract_text_from_pdf() et chunk_text() → services/rag_engine.py
* get_embedding() et search_similar_chunks() → services/rag_engine.py
* ask_llm() → services/llm_service.py
* Routes /chat et /upload → routes/chat.py
* Route /documents → routes/documents.py

## Critères de succès Phase 1

- [ ] uvicorn main:app --reload démarre sans erreur
- [ ] GET /health retourne {"status": "ok"}
- [ ] POST /chat fonctionne comme avant la restructuration
- [ ] POST /chat/upload ingère un PDF correctement

---

# PHASE 2 — Migration OpenAI → Claude API

Durée estimée : 1 jour

## 2.1 Remplacement du LLM

Avant (OpenAI) :
openai_client.chat.completions.create(
    model="gpt-4o-mini",
    temperature=0,
    messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": ...}]
)

Après (Claude) :
anthropic_client.messages.create(
    model="claude-sonnet-4-5-20250929",
    temperature=0,
    max_tokens=4096,
    system=SYSTEM_PROMPT,
    messages=[{"role": "user", "content": ...}]
)

## 2.2 Conservation des embeddings

Les embeddings restent sur OpenAI (text-embedding-3-small). Seul le LLM change.

## 2.3 Nouvelles dépendances

Ajouter dans requirements.txt : anthropic>=0.40.0
Ajouter dans .env : ANTHROPIC_API_KEY=sk-ant-...

## Critères de succès Phase 2

- [ ] Le chatbot répond via Claude API avec temperature=0
- [ ] Les embeddings sont toujours générés via OpenAI
- [ ] La qualité des réponses est équivalente ou supérieure

---

# PHASE 3 — Authentification OAuth 2.0

Durée estimée : 1 weekend

## 3.1 OAuth Microsoft (Azure AD)

1. Enregistrer l'application sur Azure Portal (App Registration)
2. Configurer redirect URIs (http://localhost:8000/auth/callback/microsoft)
3. Scopes : User.Read, Calendars.Read, Mail.Read, Files.Read
4. Flow Authorization Code avec PKCE
5. Stocker access_token et refresh_token chiffrés dans la table users

Librairie : pip install msal

## 3.2 OAuth Google

1. Créer un projet Google Cloud Console
2. Configurer OAuth consent screen
3. Scopes : calendar.readonly, gmail.readonly
4. Même flow que Microsoft

Librairie : pip install google-auth google-auth-oauthlib

## 3.3 Middleware d'authentification

Middleware FastAPI qui :
1. Extrait le token Bearer du header Authorization
2. Vérifie sa validité (signature + expiration)
3. Injecte le user_id dans le contexte
4. Retourne 401 si invalide

## 3.4 Cloisonnement des données

CRITIQUE : Chaque requête SQL doit filtrer par user_id.

✅ CORRECT : supabase.table("documents").select("*").eq("user_id", user_id).execute()
❌ INTERDIT : supabase.table("documents").select("*").execute()

## 3.5 Table users SQL

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

## Critères de succès Phase 3

- [ ] Login Microsoft fonctionnel
- [ ] Login Google fonctionnel
- [ ] Routes protégées bloquent sans token (401)
- [ ] Chaque user voit uniquement ses propres documents
- [ ] Tokens stockés chiffrés en base

---

# PHASE 4 — Orchestrateur de Connecteurs

Durée estimée : 1 weekend

## 4.1 Interface BaseConnector

class BaseConnector(ABC):
    name: str
    def authenticate(self, tokens: dict) -> bool
    def fetch_events(self, start: datetime, end: datetime) -> list[Event]
    def fetch_tasks(self) -> list[Task]
    def fetch_files(self, path: str) -> list[File]
    def search(self, query: str) -> list[SearchResult]
    def get_status(self) -> ConnectorStatus

## 4.2 Types partagés (shared/types.py)

class ConnectorStatus(Enum):
    CONNECTED = "connected"
    UNAVAILABLE = "unavailable"
    AUTH_EXPIRED = "auth_expired"
    PARSE_ERROR = "parse_error"

@dataclass
class Event: id, title, start, end, source, location, description, metadata
class Task: id, title, status, priority, project, assignee, due_date, url
class File: id, name, path, size, modified_at, source, mime_type, is_folder
class SearchResult: id, content, source, score, metadata

## 4.3 Orchestrateur

class ConnectorOrchestrator:
    def register(self, connector: BaseConnector)
    async def fetch_all_events(self, user_tokens, start, end) -> (list[Event], list[str])
    async def fetch_all_tasks(self, user_tokens) -> list[Task]
    async def fetch_all_files(self, user_tokens, path) -> list[File]

Si un connecteur échoue, les autres continuent. L'erreur est loggée et renvoyée dans warnings.

## Critères de succès Phase 4

- [ ] BaseConnector définie et documentée
- [ ] Types partagés dans shared/types.py
- [ ] L'orchestrateur appelle N connecteurs en parallèle
- [ ] L'échec d'un connecteur n'impacte pas les autres

---

# PHASE 5 — Routes Agenda, Documents, Dashboard

Durée estimée : 1 weekend

GET /agenda/events?start=...&end=... → événements unifiés (toutes sources)
GET /agenda/today → résumé du jour (réunions, cours, deadlines)
GET /documents/tree?path=... → arborescence fichiers (OneDrive Pro + Perso)
GET /documents/search?q=... → recherche sémantique dans les documents indexés
GET /dashboard/summary → vue globale (tâches urgentes, prochains cours, réunions)
GET /dashboard/tasks → tickets Jira/Linear ouverts

---

# PHASE 6 — Tests & Validation

Durée estimée : 1 jour

## Checklist finale

- [ ] .env configuré et non versionné
- [ ] Supabase connecté, tables créées, fonctions SQL opérationnelles
- [ ] Moteur RAG fonctionne (ingestion + retrieval + génération)
- [ ] Claude API avec temperature=0
- [ ] OAuth Microsoft + Google fonctionnels
- [ ] Cloisonnement des données par user_id
- [ ] Toutes les routes documentées sur /docs (Swagger)
- [ ] Tests automatisés passent
- [ ] Aucune clé API dans le code

---

# Récapitulatif du Planning

| Phase | Description | Durée |
|---|---|---|
| Phase 1 | Restructuration du projet RAG | 1 weekend |
| Phase 2 | Migration OpenAI → Claude API | 1 jour |
| Phase 3 | Authentification OAuth 2.0 | 1 weekend |
| Phase 4 | Orchestrateur de connecteurs | 1 weekend |
| Phase 5 | Routes Agenda, Documents, Dashboard | 1 weekend |
| Phase 6 | Tests et validation | 1 jour |
| TOTAL | | 4-5 weekends |

---

# Plan de Développement — Partie 2 : Frontend & Interface

Version : 1.0 | Date : Mars 2026 | Responsable : Arsène | Statut : En cours

---

# PHASE 1 — Setup & Structure (1 jour)

* Initialiser le projet : npm create vite@latest frontend -- --template react-ts
* Installer : tailwindcss, lucide-react, react-router-dom
* Arborescence :

frontend/src/
├── App.tsx
├── pages/ (Login, Chat, Dashboard, Agenda, Files, Revision)
├── components/
│   ├── layout/ (Sidebar, Layout)
│   ├── chat/ (ChatWindow, MessageBubble, ChatInput, LoadingDots, SourcesAccordion)
│   ├── dashboard/ (TodayCard, TasksCard, AgendaPreview)
│   ├── agenda/ (CalendarView, EventModal)
│   ├── files/ (FileTree, FilePreview)
│   └── revision/ (FlashCard, QuizView)
├── services/api.ts
├── types/index.ts
├── hooks/ (useAuth, useChat, useAgenda)
└── contexts/AuthContext.tsx

* Configurer .env.local : VITE_API_URL=http://localhost:8000
* Créer le layout avec sidebar

Critères :
- [ ] npm run dev démarre sur localhost:5173
- [ ] Navigation entre pages fonctionne

---

# PHASE 2 — Page de Connexion (1 jour)

* Page Login.tsx : boutons Microsoft + Google
* AuthContext.tsx : state user/token, actions login/logout
* Flow OAuth : clic → redirect → callback → stockage token
* ProtectedRoute : redirect vers /login si non connecté

Critères :
- [ ] Login Microsoft redirige et récupère le token
- [ ] Login Google fonctionne
- [ ] Routes protégées redirigent si non connecté

---

# PHASE 3 — Interface Chat IA (2 jours)

* ChatWindow.tsx : liste messages, auto-scroll, state messages[]/isLoading
* MessageBubble.tsx : user=droite bleu, assistant=gauche gris
* ChatInput.tsx : textarea auto-resize, Enter=envoi, compteur 2000 chars
* LoadingDots.tsx : 3 points animés CSS
* SourcesAccordion.tsx : accordéon <details> sous chaque réponse
* Sidebar chat : upload PDF, historique conversations
* Modes spécialisés : selector Général/Entreprise/Révision/Rédaction

Critères :
- [ ] Envoi question → réponse affichée avec sources
- [ ] Upload PDF → confirmation + nombre de chunks
- [ ] Loading animé visible
- [ ] Auto-scroll vers le bas

---

# PHASE 4 — Dashboard & Agenda (2 jours)

* Dashboard : grille responsive, cards TodayCard/TasksCard/AgendaPreview
* Skeleton loaders, refresh auto 15 min
* Agenda : CalendarView vue semaine/mois, code couleur par source
* EventModal : détail au clic

Critères :
- [ ] Dashboard affiche toutes les sources
- [ ] Agenda avec couleurs
- [ ] Modal détail fonctionne

---

# PHASE 5 — Fichiers & Révision (2 jours)

* FileTree.tsx : arborescence navigable, onglets Pro/Perso
* Recherche sémantique via /documents/search
* FlashCard.tsx : card retournable, boutons "Je sais"/"À revoir"
* QuizView.tsx : QCM 4 choix, correction immédiate

---

# PHASE 6 — PWA & Tests (1 jour)

* manifest.json : name "AlternApp", theme #2563eb, bg #0d0d0d
* Service Worker : cache assets statiques
* Tester responsive sur 3 tailles (375px, 768px, 1440px)
* Tester tous les parcours utilisateur

---

# Récapitulatif

| Phase | Description | Durée |
|---|---|---|
| Phase 1 | Setup et structure | 1 jour |
| Phase 2 | Page de connexion | 1 jour |
| Phase 3 | Interface Chat IA | 2 jours |
| Phase 4 | Dashboard et Agenda | 2 jours |
| Phase 5 | Fichiers et Révision | 2 jours |
| Phase 6 | PWA et tests | 1 jour |
| TOTAL | | 9 jours (~4 weekends) |

---

# Plan de Développement — Partie 3 : Intégrations & Connecteurs

Version : 1.0 | Date : Mars 2026 | Responsable : Arsène

---

# PHASE 1 — Setup & BaseConnector (1 jour)

Arborescence :

connectors/
├── base_connector.py
├── microsoft/
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
    ├── test_teams.py
    ├── test_onedrive.py
    ├── test_jira.py
    ├── test_ent_lise.py
    └── test_google_cal.py

* Implémenter BaseConnector
* Définir types partagés dans shared/types.py
* Créer un MockConnector
* Tester que l'orchestrateur appelle le MockConnector

Critères :
- [ ] BaseConnector validée
- [ ] MockConnector retourne des données fictives
- [ ] L'orchestrateur appelle le mock sans erreur

---

# PHASE 2 — Connecteurs Microsoft (2 weekends)

## Helper GraphClient

class GraphClient:
    BASE_URL = "https://graph.microsoft.com/v1.0"
    def __init__(self, access_token): self.headers = {"Authorization": f"Bearer {access_token}"}
    def get(self, endpoint, params=None): return requests.get(...).json()

## TeamsConnector
* fetch_events() via GET /me/calendarView
* Parser en list[Event] avec source="teams"

## OneDriveConnector
* fetch_files(path) via GET /me/drive/root/children
* search(query) via GET /me/drive/search
* Paramètre account_type ("pro" | "perso")

## OutlookConnector
* fetch_events() via calendrier
* fetch_important_emails() via GET /me/messages?$filter=importance eq 'high'

Critères :
- [ ] Teams retourne les réunions
- [ ] OneDrive navigue l'arborescence
- [ ] OneDrive search fonctionne
- [ ] Outlook retourne le calendrier
- [ ] Tests avec mock Graph API

---

# PHASE 3 — Jira/Linear (1 weekend)

## JiraConnector
* fetch_tasks() via GET /search?jql=assignee=currentUser() AND status!=Done
* Auth : Basic Auth (email:api_token en base64)
* Mapper les champs : summary→title, status→status, priority→priority, duedate→due_date

Critères :
- [ ] Liste des tickets assignés
- [ ] Filtrage par statut
- [ ] Deadlines récupérées

---

# PHASE 4 — ENT + Google Calendar (2 weekends)

## ENT LISE (scraping avec Playwright)
1. Analyser la structure HTML (DevTools)
2. Login via formulaire (fill + click)
3. Naviguer vers emploi du temps
4. Parser les événements (sélecteurs CSS)
5. Logger HTML brut en cas d'erreur de parsing

## Google Calendar
* fetch_events() via Google Calendar API v3
* Credentials depuis le token fourni par le backend

Critères :
- [ ] ENT LISE : emploi du temps récupéré
- [ ] Google Calendar : événements affichés

---

# PHASE 5 — Tests & Documentation (1 jour)

* Tests unitaires : pytest + responses (mock HTTP)
* Cas testés : succès, 401, 500, 429, timeout, parsing échoué
* README par connecteur : config, scopes, limites

---

# Récapitulatif

| Phase | Description | Durée |
|---|---|---|
| Phase 1 | Setup et BaseConnector | 1 jour |
| Phase 2 | Microsoft (Teams+OneDrive+Outlook) | 2 weekends |
| Phase 3 | Jira/Linear | 1 weekend |
| Phase 4 | ENT + Google Calendar | 2 weekends |
| Phase 5 | Tests et documentation | 1 jour |
| TOTAL | | 5-6 weekends |