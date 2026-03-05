# Cahier des Charges — Partie 1 : Backend Core + Agent IA

Version : 1.0 | Date : Mars 2026 | Responsable : Arsène | Statut : En cours

---

# 1. Présentation du Module

## 1.1 Contexte

La Partie 1 constitue le cœur technique d'AlternApp. Elle englobe le serveur API central (FastAPI), le moteur RAG (Retrieval-Augmented Generation), l'authentification OAuth 2.0 multi-comptes, la base de données (Supabase/PostgreSQL + pgvector), et l'orchestrateur qui coordonne les connecteurs externes (Partie 3) pour alimenter le frontend (Partie 2).

## 1.2 Objectif Principal

Fournir une API REST robuste, sécurisée et documentée qui sert de point d'entrée unique pour le frontend et qui orchestre tous les services internes et externes d'AlternApp.

## 1.3 Périmètre de responsabilité

* API REST FastAPI : toutes les routes consommées par le frontend
* Moteur RAG : chunking, embedding, recherche vectorielle, génération LLM
* Authentification : OAuth 2.0 Microsoft (Azure AD) + Google
* Base de données : schéma PostgreSQL, migrations, pgvector
* Orchestrateur : interface avec les connecteurs de la Partie 3
* Documentation API : OpenAPI/Swagger auto-générée

---

# 2. Périmètre Fonctionnel

## 2.1 Inclus

* Routes POST /chat et POST /chat/upload (moteur RAG)
* Routes GET /chat/history (historique conversations)
* Routes POST /auth/login/microsoft et /auth/login/google
* Route GET /auth/me (infos utilisateur connecté)
* Routes GET /agenda/events et /agenda/today
* Routes GET /documents/tree et /documents/search
* Routes GET /dashboard/summary et /dashboard/tasks
* Route GET /health (healthcheck)

## 2.2 Exclusions (Phase 1)

* Streaming SSE des réponses (Phase 2)
* Gestion avancée des rôles (admin, tuteur, enseignant)
* Déploiement haute disponibilité
* Mode hors-ligne côté backend

---

# 3. Spécifications Fonctionnelles

## 3.1 Module Chat Assistant IA (RAG)

Le chatbot est le cœur d'AlternApp. Il répond aux questions de l'alternant en se basant uniquement sur les documents indexés dans la base vectorielle. Température = 0, aucune hallucination.

### Ingestion des documents

* Accepter des fichiers PDF via POST /chat/upload
* Extraire le texte page par page (pypdf)
* Découper en chunks de 500-800 tokens avec overlap de 75 tokens
* Générer un embedding par chunk (text-embedding-3-small, 1536 dimensions)
* Stocker content + embedding + metadata dans la table documents

### Recherche et génération

* Vectoriser la question utilisateur (même modèle d'embedding)
* Rechercher Top K = 5 chunks par similarité cosinus (seuil 0.3)
* Construire le prompt avec contexte + question
* Appeler Claude API avec temperature = 0
* Retourner la réponse + les sources utilisées

### Prompt système obligatoire

"Tu dois répondre uniquement à partir du contexte fourni.
Si la réponse n'est pas dans le contexte, réponds :
'Je ne trouve pas l'information dans les documents fournis.'
N'invente rien. Ne complète pas avec tes connaissances générales.
Sois précis, factuel et concis."

## 3.2 Module Authentification

* OAuth 2.0 Authorization Code Flow avec PKCE
* Stockage des tokens (access + refresh) chiffrés en base (AES-256)
* Middleware d'authentification sur toutes les routes protégées
* Refresh automatique des tokens expirés

## 3.3 Module Orchestrateur

* Appeler les connecteurs via l'interface commune BaseConnector
* Agréger les résultats (ex: agenda unifié = Teams + ENT + Google)
* Gérer les erreurs de connecteurs sans impacter le reste
* Cache des données pour éviter les appels API répétitifs

---

# 4. Spécifications Techniques

## 4.1 Stack

| Composant | Technologie | Rôle |
|---|---|---|
| Langage | Python 3.11+ | Langage principal du backend |
| Framework | FastAPI | API REST async, validation Pydantic, docs auto |
| Base de données | Supabase (PostgreSQL + pgvector) | Données utilisateurs, documents, embeddings |
| LLM | Claude API (Anthropic) | Génération de réponses (temperature=0) |
| Embeddings | OpenAI text-embedding-3-small | Vectorisation des chunks (1536 dim) |
| Auth | OAuth 2.0 (MSAL + Google) | Authentification multi-comptes |

## 4.2 Schéma de base de données

| Table | Colonnes principales | Description |
|---|---|---|
| users | id, email, name, microsoft_token, google_token, created_at | Utilisateurs alternants |
| documents | id, user_id, content, embedding(1536), metadata, created_at | Chunks avec embeddings |
| conversations | id, user_id, title, created_at | Historique des conversations |
| messages | id, conversation_id, role, content, sources, created_at | Messages dans une conversation |
| connector_cache | id, user_id, connector, data, expires_at | Cache des données connecteurs |

## 4.3 Sécurité

* Clés API exclusivement côté backend (.env non versionné)
* Tokens OAuth chiffrés au repos (AES-256)
* Validation Pydantic stricte sur toutes les routes
* Rate limiting par utilisateur (60 req/min)
* CORS restrictif (origines frontend uniquement)
* Cloisonnement des données par user_id sur chaque requête

---

# 5. Contrat d'API

| Méthode | Endpoint | Description | Auth |
|---|---|---|---|
| POST | /auth/login/microsoft | Login Microsoft OAuth | Non |
| POST | /auth/login/google | Login Google OAuth | Non |
| GET | /auth/me | Infos utilisateur connecté | Oui |
| POST | /chat | Poser une question au chatbot RAG | Oui |
| POST | /chat/upload | Upload un PDF pour indexation | Oui |
| GET | /chat/history | Historique des conversations | Oui |
| GET | /agenda/events | Événements unifiés | Oui |
| GET | /agenda/today | Résumé du jour | Oui |
| GET | /documents/tree | Arborescence fichiers | Oui |
| GET | /documents/search | Recherche sémantique | Oui |
| GET | /dashboard/summary | Résumé global alternant | Oui |
| GET | /dashboard/tasks | Tâches Jira/Linear | Oui |
| GET | /health | Healthcheck | Non |

---

# 6. Critères d'Acceptation

- [ ] POST /chat retourne une réponse pertinente à partir des documents
- [ ] POST /chat refuse de répondre si l'info n'est pas dans les documents
- [ ] Temperature = 0 toujours respectée
- [ ] POST /chat/upload ingère un PDF et stocke les chunks avec embeddings
- [ ] OAuth Microsoft et Google fonctionnels
- [ ] Chaque utilisateur voit uniquement ses propres données
- [ ] GET /health retourne 200
- [ ] Aucune clé API exposée dans les réponses HTTP
- [ ] Documentation Swagger accessible sur /docs

---

# 7. Tests Requis

| Scénario | Résultat attendu |
|---|---|
| Question présente dans un PDF | Réponse correcte et sourcée |
| Question hors-document | Message de refus standardisé |
| Upload PDF 50 pages | Ingestion réussie, chunks en base |
| Login Microsoft | Token valide, accès autorisé |
| Login Google | Token valide, accès autorisé |
| Appel /chat sans token | Erreur 401 |

| Métrique | Cible |
|---|---|
| Temps réponse /chat | < 5s (P95) |
| Temps ingestion 10 pages | < 30s |
| Mémoire | < 512 MB |

---

# 8. Livrables

* Code backend structuré (alternapp/backend/)
* Schéma SQL Supabase + migrations
* Fichier .env.example
* Documentation API (Swagger)
* Tests unitaires et d'intégration

---

# Cahier des Charges — Partie 2 : Frontend & Interface

Version : 1.0 | Date : Mars 2026 | Responsable : Arsène | Statut : En cours

---

# 1. Présentation du Module

## 1.1 Contexte

La Partie 2 couvre l'intégralité de l'interface utilisateur d'AlternApp. C'est ce que l'alternant voit et utilise. L'interface doit être moderne, réactive, responsive et installable comme PWA sur mobile.

## 1.2 Objectif

Développer une interface web complète en React (Vite + TypeScript) qui consomme l'API REST du backend (Partie 1) et offre une expérience fluide et professionnelle.

## 1.3 Périmètre

* Page de connexion (OAuth Microsoft + Google)
* Interface Chat IA (style ChatGPT) avec upload PDF
* Dashboard alternant (vue globale)
* Agenda unifié (calendrier multi-sources)
* Gestionnaire de fichiers (arborescence OneDrive)
* Mode révision (flashcards, QCM, fiches)
* Sidebar de navigation
* PWA installable + responsive

---

# 2. Spécifications Fonctionnelles

## 2.1 Page de Connexion

* Bouton "Se connecter avec Microsoft"
* Bouton "Se connecter avec Google"
* Redirection OAuth puis stockage du token en mémoire
* Redirection vers /dashboard après connexion réussie

## 2.2 Interface Chat IA

* Zone de messages : user (droite, bleu) et assistant (gauche, gris)
* Champ de saisie en bas : textarea auto-resize, envoi sur Enter
* Bouton envoi désactivé si vide ou loading
* Compteur caractères (max 2000)
* Indicateur de chargement (3 points animés)
* Bouton upload PDF dans la sidebar du chat
* Accordéon dépliable pour les sources sous chaque réponse
* Historique des conversations dans la sidebar gauche
* Modes spécialisés : Général / Entreprise / Révision / Rédaction

## 2.3 Dashboard Alternant

| Zone | Contenu |
|---|---|
| Haut | Réunions du jour, cours du jour, tâches urgentes |
| Centre gauche | Prochains examens, notes récentes, rendus à venir |
| Centre droit | Tickets Jira ouverts, livrables, deadlines |
| Bas | Vue semaine unifiée |

Données via GET /dashboard/summary et GET /dashboard/tasks.
Refresh auto toutes les 15 min. Skeleton loaders pendant le chargement.

## 2.4 Agenda Unifié

* Vue semaine (défaut) et vue mois
* Code couleur : entreprise=bleu, école=vert, perso=gris
* Détail événement au clic (modal)
* Navigation semaine précédente/suivante
* Données via GET /agenda/events?start=...&end=...

## 2.5 Gestionnaire de Fichiers

* Arborescence unifiée (OneDrive Pro + Perso) via GET /documents/tree
* Onglets "Entreprise" et "École"
* Barre de recherche sémantique via GET /documents/search?q=...
* Preview fichiers (PDF, images)

## 2.6 Mode Révision

* Upload de cours (PDF) pour indexation
* Génération de fiches de révision via le chat
* QCM auto-générés
* Flashcards avec répétition espacée (SM-2)
* Score et progression

---

# 3. Spécifications Techniques

## 3.1 Stack

| Composant | Technologie |
|---|---|
| Framework | React 18+ (Vite) |
| Langage | TypeScript strict |
| Styling | TailwindCSS |
| State | React Context + hooks |
| HTTP | fetch natif (wrapper dans api.ts) |
| PWA | Service Workers + manifest.json |
| Routing | React Router v6 |
| Icons | lucide-react |

## 3.2 Communication avec le Backend

Le frontend communique EXCLUSIVEMENT via les endpoints REST du contrat d'API.
JAMAIS d'accès direct à Supabase.
Toutes les requêtes incluent : Authorization: Bearer <token>

## 3.3 Sécurité

* Aucune clé API dans le code frontend
* Token stocké en mémoire (PAS localStorage)
* Variable d'environnement : VITE_API_URL uniquement
* Timeout client : 30 secondes

---

# 4. UI/UX

* Dark mode par défaut (#0d0d0d bg, #141414 cards, #2563eb accent)
* Responsive : desktop 1440px, tablette 768px, mobile 375px
* Font : Inter
* Skeleton loaders pendant les chargements
* Messages d'erreur en français

---

# 5. Critères d'Acceptation

- [ ] Interface correcte sur desktop, tablette, mobile
- [ ] Login OAuth Microsoft et Google fonctionnels
- [ ] Chat : envoi question → affichage réponse avec sources
- [ ] Upload PDF avec indicateur de progression
- [ ] Dashboard affiche données de toutes les sources
- [ ] Agenda avec code couleur
- [ ] Fichiers navigables dans l'arborescence
- [ ] Recherche sémantique fonctionne
- [ ] Mode révision : flashcards/QCM
- [ ] PWA installable sur mobile
- [ ] Erreurs API gérées dans l'UI
- [ ] Loading state visible pendant chaque appel

---

# 6. Livrables

* Code frontend complet (alternapp/frontend/)
* Composants React réutilisables
* Types TypeScript partagés (types/)
* Client API centralisé (services/api.ts)
* Configuration PWA

---

# Cahier des Charges — Partie 3 : Intégrations & Connecteurs

Version : 1.0 | Date : Mars 2026 | Responsable : Arsène | Statut : À démarrer

---

# 1. Présentation du Module

## 1.1 Contexte

La Partie 3 développe les connecteurs qui permettent à AlternApp de communiquer avec les services externes. Chaque connecteur est un module Python indépendant qui implémente BaseConnector.

## 1.2 Périmètre

* Connecteur Microsoft Teams (API Graph)
* Connecteur OneDrive x2 — pro et perso (API Graph)
* Connecteur Jira / Linear (REST API)
* Connecteur ENT scolaire — LISE, Aurion (scraping)
* Connecteur Google Calendar (Google API)
* Connecteur Outlook (API Graph)

---

# 2. Interface Commune : BaseConnector

Tous les connecteurs DOIVENT implémenter :

class BaseConnector(ABC):
    name: str
    def authenticate(self, tokens: dict) -> bool
    def fetch_events(self, start, end) -> list[Event]
    def fetch_tasks(self) -> list[Task]
    def fetch_files(self, path="/") -> list[File]
    def search(self, query) -> list[SearchResult]
    def get_status(self) -> ConnectorStatus

Types (shared/types.py) :

ConnectorStatus: CONNECTED, UNAVAILABLE, AUTH_EXPIRED, PARSE_ERROR
Event: id, title, start, end, source, location, description, metadata
Task: id, title, status, priority, project, assignee, due_date, url
File: id, name, path, size, modified_at, source, mime_type, is_folder
SearchResult: id, content, source, score, metadata

---

# 3. Spécifications par Connecteur

## 3.1 Microsoft Teams

API : Microsoft Graph v1.0
* fetch_events() : GET /me/calendarView
* Canaux et messages : GET /me/joinedTeams, GET /teams/{id}/channels
* Scopes : Calendars.Read, ChannelMessage.Read.All, Chat.Read

## 3.2 OneDrive (x2)

API : Microsoft Graph v1.0
* fetch_files(path) : GET /me/drive/root/children
* search(query) : GET /me/drive/search(q='...')
* Séparation pro/perso via paramètre account_type
* Scopes : Files.Read, Files.Read.All

## 3.3 Jira

API : Jira REST API v3
* fetch_tasks() : GET /search?jql=assignee=currentUser() AND status!=Done
* Auth : Basic Auth (email + API token)

## 3.4 ENT Scolaire (LISE prioritaire)

Méthode : Scraping web (Playwright)
* fetch_events() : emploi du temps
* Notes, absences, rendus
* LISE = Phase 1, Aurion/Ypareo/Moodle = Phase 2

## 3.5 Google Calendar

API : Google Calendar API v3
* fetch_events() : GET /calendars/primary/events?timeMin=...&timeMax=...
* Scope : calendar.readonly

## 3.6 Outlook

API : Microsoft Graph v1.0
* fetch_events() : calendrier pro
* Emails importants : GET /me/messages?$filter=importance eq 'high'
* Scopes : Mail.Read, Calendars.Read

---

# 4. Stack

| Composant | Technologie |
|---|---|
| Langage | Python 3.11+ |
| Microsoft APIs | requests |
| Jira | requests (REST) |
| Google | google-api-python-client |
| ENT Scraping | Playwright + BeautifulSoup4 |
| Tests | pytest + responses |
| Retry | tenacity |

---

# 5. Gestion des Erreurs

* Service indisponible → ConnectorStatus.UNAVAILABLE
* Token expiré (401) → ConnectorStatus.AUTH_EXPIRED
* Parsing échoué → ConnectorStatus.PARSE_ERROR
* Rate limit (429) → retry exponentiel (1s, 2s, 4s, max 3 tentatives)

---

# 6. Critères d'Acceptation

- [ ] Chaque connecteur implémente BaseConnector
- [ ] Teams : récupère les réunions
- [ ] OneDrive : navigue l'arborescence et recherche
- [ ] Jira : liste les tickets assignés
- [ ] ENT LISE : récupère l'emploi du temps
- [ ] Google Calendar : récupère les événements
- [ ] Outlook : récupère calendrier et emails importants
- [ ] Erreurs gérées sans crash
- [ ] Tests unitaires avec mocks HTTP

---

# 7. Livrables

* Code des connecteurs (alternapp/connectors/)
* BaseConnector (connectors/base_connector.py)
* Tests unitaires (connectors/tests/)
* README par connecteur
* Guide setup des comptes développeur (Azure, Google, Jira)