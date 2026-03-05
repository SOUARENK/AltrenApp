# ============================================================================
# CONTRAT D'API — AlternApp
# ============================================================================
# Ce document est la SOURCE DE VÉRITÉ pour les 3 développeurs.
# Toute modification doit être discutée et validée par les 3 parties.
# Dernière mise à jour : Mars 2026
# ============================================================================
#
# QUI UTILISE QUOI :
#   Partie 1 (Backend — Arsène)    → IMPLÉMENTE ces endpoints
#   Partie 2 (Frontend — Dev 2)    → CONSOMME ces endpoints
#   Partie 3 (Connecteurs — Dev 3) → IMPLÉMENTE BaseConnector (appelé par P1)
#
# RÈGLES :
#   1. Le frontend ne contacte JAMAIS Supabase/OpenAI/Claude directement
#   2. Les connecteurs ne sont JAMAIS appelés directement par le frontend
#   3. Tout passe par le backend (Partie 1) = point d'entrée unique
#   4. Toute modification d'un endpoint → PR + discussion avec les 3
#
# BASE URL :
#   Dev  : http://localhost:8000
#   Prod : https://api.alternapp.fr (à définir)
#
# AUTH :
#   Toutes les routes "Auth: Oui" nécessitent le header :
#   Authorization: Bearer <jwt_token>
#
# FORMAT :
#   Requêtes  : application/json (sauf upload = multipart/form-data)
#   Réponses  : application/json
#   Dates     : ISO 8601 (2026-03-15T09:00:00Z)
#   IDs       : UUID v4
#
# CODES HTTP :
#   200 = OK
#   201 = Créé
#   400 = Requête invalide (champ manquant, format incorrect)
#   401 = Non authentifié (token absent ou expiré)
#   403 = Accès interdit (tentative d'accéder aux données d'un autre user)
#   404 = Ressource non trouvée
#   422 = Erreur de validation Pydantic
#   429 = Rate limit dépassé
#   500 = Erreur interne serveur
#   503 = Service externe indisponible (OpenAI, Claude, connecteur)
#
# ERREURS (format uniforme) :
#   {
#     "detail": "Message d'erreur lisible en français",
#     "code": "ERROR_CODE",
#     "timestamp": "2026-03-15T09:00:00Z"
#   }
#
# ============================================================================


# ============================================================================
# 1. AUTHENTIFICATION
# ============================================================================
# Responsable : Partie 1 (Backend)
# Consommateur : Partie 2 (Frontend)
# ============================================================================

# --------------------------------------------------------------------------
# POST /auth/login/microsoft
# --------------------------------------------------------------------------
# Description : Initie le flow OAuth 2.0 Microsoft (Azure AD)
# Auth requise : Non
#
# Requête :
#   Body : aucun
#
# Réponse 200 :
#   {
#     "auth_url": "https://login.microsoftonline.com/...",
#     "state": "random_csrf_token"
#   }
#
# Le frontend redirige l'utilisateur vers auth_url.
# Après login, Microsoft redirige vers /auth/callback/microsoft?code=...&state=...

# --------------------------------------------------------------------------
# GET /auth/callback/microsoft
# --------------------------------------------------------------------------
# Description : Callback OAuth Microsoft. Échange le code contre un token.
# Auth requise : Non
#
# Query params :
#   code  : string (requis) — code d'autorisation Microsoft
#   state : string (requis) — doit correspondre au state envoyé
#
# Réponse 200 :
#   {
#     "access_token": "eyJ...",        ← JWT signé par le backend
#     "token_type": "Bearer",
#     "expires_in": 86400,             ← 24h en secondes
#     "user": {
#       "id": "uuid",
#       "email": "arsene@entreprise.com",
#       "name": "Arsène Dupont"
#     }
#   }
#
# Erreurs :
#   400 — state invalide ou code expiré

# --------------------------------------------------------------------------
# POST /auth/login/google
# --------------------------------------------------------------------------
# Description : Initie le flow OAuth 2.0 Google
# Auth requise : Non
#
# Réponse 200 :
#   {
#     "auth_url": "https://accounts.google.com/o/oauth2/v2/auth?...",
#     "state": "random_csrf_token"
#   }

# --------------------------------------------------------------------------
# GET /auth/callback/google
# --------------------------------------------------------------------------
# Description : Callback OAuth Google
# Auth requise : Non
#
# Query params :
#   code  : string (requis)
#   state : string (requis)
#
# Réponse 200 : même format que /auth/callback/microsoft

# --------------------------------------------------------------------------
# GET /auth/me
# --------------------------------------------------------------------------
# Description : Retourne les infos de l'utilisateur connecté
# Auth requise : Oui
#
# Réponse 200 :
#   {
#     "id": "uuid",
#     "email": "arsene@entreprise.com",
#     "name": "Arsène Dupont",
#     "microsoft_connected": true,
#     "google_connected": true,
#     "jira_connected": false,
#     "created_at": "2026-03-01T10:00:00Z",
#     "last_login": "2026-03-15T08:30:00Z"
#   }
#
# Erreurs :
#   401 — token absent ou invalide

# --------------------------------------------------------------------------
# POST /auth/logout
# --------------------------------------------------------------------------
# Description : Invalide le token côté backend
# Auth requise : Oui
#
# Réponse 200 :
#   { "message": "Déconnexion réussie" }


# ============================================================================
# 2. CHAT — ASSISTANT IA (RAG)
# ============================================================================
# Responsable : Partie 1 (Backend — moteur RAG)
# Consommateur : Partie 2 (Frontend — interface chat)
# ============================================================================

# --------------------------------------------------------------------------
# POST /chat
# --------------------------------------------------------------------------
# Description : Envoie une question au chatbot RAG
# Auth requise : Oui
#
# Requête :
#   {
#     "question": "Quels sont les objectifs du projet X ?",
#     "conversation_id": "uuid" | null,    ← null = nouvelle conversation
#     "mode": "general"                     ← "general" | "entreprise" | "revision" | "redaction"
#   }
#
# Contraintes :
#   question : string, min 1 char, max 2000 chars (requis)
#   conversation_id : uuid ou null (optionnel)
#   mode : string parmi les 4 valeurs (optionnel, défaut "general")
#
# Réponse 200 :
#   {
#     "answer": "Les objectifs du projet X sont...",
#     "conversation_id": "uuid",           ← ID de la conversation (nouveau ou existant)
#     "message_id": "uuid",                ← ID du message assistant
#     "sources": [
#       {
#         "content": "Extrait du chunk pertinent...",
#         "filename": "cahier_des_charges.pdf",
#         "page": 3,
#         "chunk_index": 7,
#         "similarity": 0.87
#       },
#       {
#         "content": "Autre extrait pertinent...",
#         "filename": "cahier_des_charges.pdf",
#         "page": 5,
#         "chunk_index": 12,
#         "similarity": 0.82
#       }
#     ],
#     "chunks_found": 5,
#     "model": "claude-sonnet-4-5-20250929",
#     "processing_time_ms": 2340
#   }
#
# Si aucun document pertinent trouvé :
#   {
#     "answer": "Je ne trouve pas l'information dans les documents fournis.",
#     "conversation_id": "uuid",
#     "message_id": "uuid",
#     "sources": [],
#     "chunks_found": 0,
#     "model": null,
#     "processing_time_ms": 450
#   }
#
# Erreurs :
#   400 — question vide ou trop longue
#   401 — non authentifié
#   503 — Claude API ou OpenAI indisponible

# --------------------------------------------------------------------------
# POST /chat/upload
# --------------------------------------------------------------------------
# Description : Upload un fichier PDF pour indexation dans la base vectorielle
# Auth requise : Oui
# Content-Type : multipart/form-data
#
# Requête :
#   file : fichier PDF (requis)
#         — Type MIME : application/pdf uniquement
#         — Taille max : 50 MB
#
# Réponse 201 :
#   {
#     "message": "Document indexé avec succès",
#     "filename": "cours_mecanique.pdf",
#     "chunks_count": 42,
#     "pages_count": 15,
#     "processing_time_ms": 8500
#   }
#
# Erreurs :
#   400 — fichier non-PDF ou trop volumineux
#   401 — non authentifié
#   503 — OpenAI Embeddings indisponible

# --------------------------------------------------------------------------
# GET /chat/history
# --------------------------------------------------------------------------
# Description : Liste les conversations de l'utilisateur
# Auth requise : Oui
#
# Query params :
#   limit  : int (optionnel, défaut 20, max 100)
#   offset : int (optionnel, défaut 0)
#
# Réponse 200 :
#   {
#     "conversations": [
#       {
#         "id": "uuid",
#         "title": "Questions sur le projet X",
#         "created_at": "2026-03-15T09:00:00Z",
#         "updated_at": "2026-03-15T09:15:00Z",
#         "messages_count": 6
#       },
#       ...
#     ],
#     "total": 15,
#     "limit": 20,
#     "offset": 0
#   }

# --------------------------------------------------------------------------
# GET /chat/history/{conversation_id}
# --------------------------------------------------------------------------
# Description : Récupère les messages d'une conversation spécifique
# Auth requise : Oui
#
# Réponse 200 :
#   {
#     "id": "uuid",
#     "title": "Questions sur le projet X",
#     "messages": [
#       {
#         "id": "uuid",
#         "role": "user",
#         "content": "Quels sont les objectifs du projet X ?",
#         "sources": null,
#         "created_at": "2026-03-15T09:00:00Z"
#       },
#       {
#         "id": "uuid",
#         "role": "assistant",
#         "content": "Les objectifs du projet X sont...",
#         "sources": [ { "content": "...", "filename": "...", "page": 3, "similarity": 0.87 } ],
#         "created_at": "2026-03-15T09:00:03Z"
#       }
#     ]
#   }
#
# Erreurs :
#   404 — conversation non trouvée
#   403 — conversation appartient à un autre utilisateur

# --------------------------------------------------------------------------
# GET /chat/documents
# --------------------------------------------------------------------------
# Description : Liste les PDFs indexés par l'utilisateur
# Auth requise : Oui
#
# Réponse 200 :
#   {
#     "documents": [
#       {
#         "filename": "cours_mecanique.pdf",
#         "chunks_count": 42,
#         "pages_count": 15,
#         "ingested_at": "2026-03-10T14:00:00Z"
#       },
#       ...
#     ],
#     "total_chunks": 128
#   }

# --------------------------------------------------------------------------
# DELETE /chat/documents
# --------------------------------------------------------------------------
# Description : Supprime tous les documents indexés de l'utilisateur
# Auth requise : Oui
#
# Réponse 200 :
#   {
#     "message": "Tous les documents ont été supprimés",
#     "deleted_chunks": 128
#   }

# --------------------------------------------------------------------------
# DELETE /chat/documents/{filename}
# --------------------------------------------------------------------------
# Description : Supprime un document spécifique
# Auth requise : Oui
#
# Réponse 200 :
#   {
#     "message": "Document supprimé",
#     "filename": "cours_mecanique.pdf",
#     "deleted_chunks": 42
#   }


# ============================================================================
# 3. AGENDA UNIFIÉ
# ============================================================================
# Responsable : Partie 1 (Backend — orchestrateur)
# Source de données : Partie 3 (Connecteurs — Teams, ENT, Google Cal, Outlook)
# Consommateur : Partie 2 (Frontend — CalendarView)
# ============================================================================

# --------------------------------------------------------------------------
# GET /agenda/events
# --------------------------------------------------------------------------
# Description : Retourne les événements unifiés de TOUTES les sources
# Auth requise : Oui
#
# Query params :
#   start : string ISO 8601 (requis) — ex: "2026-03-10T00:00:00Z"
#   end   : string ISO 8601 (requis) — ex: "2026-03-16T23:59:59Z"
#
# Réponse 200 :
#   {
#     "events": [
#       {
#         "id": "uuid-ou-id-externe",
#         "title": "Standup équipe",
#         "start": "2026-03-15T09:00:00Z",
#         "end": "2026-03-15T09:15:00Z",
#         "source": "teams",              ← "teams" | "outlook" | "google_calendar" | "ent" | "jira"
#         "source_label": "Entreprise",   ← Label lisible pour le frontend
#         "color": "#3b82f6",             ← Code couleur pour l'affichage
#         "location": "Salle A3",
#         "description": "Daily standup de l'équipe dev",
#         "metadata": {
#           "teams_link": "https://teams.microsoft.com/...",
#           "jira_key": null
#         }
#       },
#       {
#         "id": "ent-evt-123",
#         "title": "Cours Mécanique des fluides",
#         "start": "2026-03-15T14:00:00Z",
#         "end": "2026-03-15T16:00:00Z",
#         "source": "ent",
#         "source_label": "École",
#         "color": "#22c55e",
#         "location": "Amphi B2",
#         "description": null,
#         "metadata": {}
#       }
#     ],
#     "warnings": [
#       "google_calendar: token expiré, reconnexion nécessaire"
#     ],
#     "sources_status": {
#       "teams": "connected",
#       "outlook": "connected",
#       "google_calendar": "auth_expired",
#       "ent": "connected"
#     }
#   }
#
# Convention couleurs :
#   Entreprise (teams/outlook) : "#3b82f6" (bleu)
#   École (ent/google_cal)     : "#22c55e" (vert)
#   Projet (jira deadline)     : "#f59e0b" (orange)
#   Personnel                  : "#6b7280" (gris)

# --------------------------------------------------------------------------
# GET /agenda/today
# --------------------------------------------------------------------------
# Description : Résumé du jour (événements + tâches urgentes)
# Auth requise : Oui
#
# Réponse 200 :
#   {
#     "date": "2026-03-15",
#     "events": [ ... ],                  ← même format que /agenda/events
#     "urgent_tasks": [
#       {
#         "id": "PROJ-42",
#         "title": "Livrer le rapport de sprint",
#         "status": "in_progress",
#         "priority": "high",
#         "due_date": "2026-03-15",
#         "source": "jira",
#         "url": "https://company.atlassian.net/browse/PROJ-42"
#       }
#     ],
#     "warnings": []
#   }


# ============================================================================
# 4. DOCUMENTS / FICHIERS
# ============================================================================
# Responsable : Partie 1 (Backend — orchestrateur)
# Source de données : Partie 3 (Connecteurs — OneDrive)
# Consommateur : Partie 2 (Frontend — FileTree)
# ============================================================================

# --------------------------------------------------------------------------
# GET /documents/tree
# --------------------------------------------------------------------------
# Description : Arborescence des fichiers (OneDrive Pro + Perso)
# Auth requise : Oui
#
# Query params :
#   path   : string (optionnel, défaut "/") — chemin du dossier
#   source : string (optionnel) — "onedrive_pro" | "onedrive_perso" | null (= les deux)
#
# Réponse 200 :
#   {
#     "path": "/Documents/Projets",
#     "files": [
#       {
#         "id": "onedrive-item-id",
#         "name": "Sprint_3",
#         "path": "/Documents/Projets/Sprint_3",
#         "is_folder": true,
#         "size": null,
#         "modified_at": "2026-03-14T18:00:00Z",
#         "source": "onedrive_pro",
#         "mime_type": null
#       },
#       {
#         "id": "onedrive-item-id-2",
#         "name": "rapport_final.pdf",
#         "path": "/Documents/Projets/rapport_final.pdf",
#         "is_folder": false,
#         "size": 2450000,
#         "modified_at": "2026-03-12T10:30:00Z",
#         "source": "onedrive_pro",
#         "mime_type": "application/pdf"
#       }
#     ],
#     "warnings": []
#   }

# --------------------------------------------------------------------------
# GET /documents/search
# --------------------------------------------------------------------------
# Description : Recherche sémantique dans les documents indexés (RAG)
# Auth requise : Oui
#
# Query params :
#   q     : string (requis) — requête de recherche
#   limit : int (optionnel, défaut 10, max 50)
#
# Réponse 200 :
#   {
#     "query": "objectifs du projet",
#     "results": [
#       {
#         "content": "Les objectifs principaux du projet sont...",
#         "filename": "cahier_des_charges.pdf",
#         "page": 2,
#         "similarity": 0.89,
#         "source": "rag"
#       },
#       ...
#     ],
#     "total": 5
#   }


# ============================================================================
# 5. DASHBOARD
# ============================================================================
# Responsable : Partie 1 (Backend — agrégation)
# Source de données : Partie 3 (Connecteurs — tous)
# Consommateur : Partie 2 (Frontend — Dashboard)
# ============================================================================

# --------------------------------------------------------------------------
# GET /dashboard/summary
# --------------------------------------------------------------------------
# Description : Vue globale de l'alternant
# Auth requise : Oui
#
# Réponse 200 :
#   {
#     "today": {
#       "events_count": 4,
#       "events": [ ... ],               ← format Event (top 5 prochains)
#       "tasks_urgent_count": 2
#     },
#     "school": {
#       "next_exams": [
#         { "title": "Examen Mécanique", "date": "2026-03-20", "source": "ent" }
#       ],
#       "pending_assignments": [
#         { "title": "Rendu TP Physique", "due_date": "2026-03-18", "source": "ent" }
#       ]
#     },
#     "work": {
#       "open_tickets": 3,
#       "tickets": [
#         {
#           "id": "PROJ-42",
#           "title": "Fix login bug",
#           "status": "in_progress",
#           "priority": "high",
#           "url": "https://company.atlassian.net/browse/PROJ-42"
#         }
#       ]
#     },
#     "documents_indexed": 128,
#     "warnings": [],
#     "sources_status": {
#       "teams": "connected",
#       "jira": "connected",
#       "ent": "connected",
#       "google_calendar": "auth_expired"
#     }
#   }

# --------------------------------------------------------------------------
# GET /dashboard/tasks
# --------------------------------------------------------------------------
# Description : Toutes les tâches de l'utilisateur (Jira/Linear)
# Auth requise : Oui
#
# Query params :
#   status   : string (optionnel) — "todo" | "in_progress" | "done" | null (= toutes)
#   priority : string (optionnel) — "low" | "medium" | "high" | "critical" | null
#
# Réponse 200 :
#   {
#     "tasks": [
#       {
#         "id": "PROJ-42",
#         "title": "Fix login bug",
#         "status": "in_progress",
#         "priority": "high",
#         "project": "AlternApp",
#         "assignee": "Arsène Dupont",
#         "due_date": "2026-03-15",
#         "url": "https://company.atlassian.net/browse/PROJ-42",
#         "source": "jira"
#       },
#       ...
#     ],
#     "total": 8,
#     "warnings": []
#   }


# ============================================================================
# 6. HEALTH & SYSTÈME
# ============================================================================

# --------------------------------------------------------------------------
# GET /health
# --------------------------------------------------------------------------
# Description : Healthcheck du backend
# Auth requise : Non
#
# Réponse 200 :
#   {
#     "status": "ok",
#     "version": "1.0.0",
#     "timestamp": "2026-03-15T09:00:00Z"
#   }


# ============================================================================
# 7. INTERFACE BASECONNECTOR (Partie 1 ↔ Partie 3)
# ============================================================================
# Ce contrat définit comment le backend (P1) appelle les connecteurs (P3).
# Ce n'est PAS une API REST — c'est une interface Python interne.
# ============================================================================

# class BaseConnector(ABC):
#
#     name: str
#     # Identifiant unique : "microsoft_teams", "microsoft_onedrive",
#     # "microsoft_outlook", "jira", "linear", "ent_lise", "google_calendar"
#
#     def authenticate(self, tokens: dict) -> bool:
#         """
#         Reçoit les tokens OAuth de l'utilisateur.
#         Retourne True si les tokens sont valides.
#         tokens = {
#             "microsoft_access_token": "eyJ...",
#             "google_access_token": "ya29...",
#             "jira_email": "user@company.com",
#             "jira_api_token": "ATATT3x..."
#         }
#         """
#
#     def fetch_events(self, start: datetime, end: datetime) -> list[Event]:
#         """
#         Retourne les événements entre start et end.
#         Retourne [] si pas applicable (ex: Jira n'a pas d'événements directs).
#         """
#
#     def fetch_tasks(self) -> list[Task]:
#         """
#         Retourne les tâches/tickets assignés.
#         Retourne [] si pas applicable (ex: Google Calendar n'a pas de tâches).
#         """
#
#     def fetch_files(self, path: str = "/") -> list[File]:
#         """
#         Retourne les fichiers à un chemin donné.
#         Retourne [] si pas applicable (ex: Jira n'a pas de fichiers).
#         """
#
#     def search(self, query: str) -> list[SearchResult]:
#         """
#         Recherche dans le service.
#         Retourne [] si pas applicable.
#         """
#
#     def get_status(self) -> ConnectorStatus:
#         """
#         Retourne l'état du connecteur :
#         CONNECTED | UNAVAILABLE | AUTH_EXPIRED | PARSE_ERROR
#         """


# ============================================================================
# 8. TYPES PARTAGÉS (shared/types.py)
# ============================================================================
# Ces types sont utilisés par Partie 1 ET Partie 3.
# Toute modification doit être validée par les deux.
# ============================================================================

# class ConnectorStatus(Enum):
#     CONNECTED = "connected"
#     UNAVAILABLE = "unavailable"
#     AUTH_EXPIRED = "auth_expired"
#     PARSE_ERROR = "parse_error"
#
# @dataclass
# class Event:
#     id: str
#     title: str
#     start: datetime
#     end: datetime
#     source: str            # "teams", "outlook", "google_calendar", "ent", "jira"
#     location: str | None = None
#     description: str | None = None
#     metadata: dict | None = None
#
# @dataclass
# class Task:
#     id: str
#     title: str
#     status: str            # "todo", "in_progress", "done"
#     priority: str          # "low", "medium", "high", "critical"
#     project: str | None = None
#     assignee: str | None = None
#     due_date: datetime | None = None
#     url: str | None = None
#     source: str = ""       # "jira", "linear"
#
# @dataclass
# class File:
#     id: str
#     name: str
#     path: str
#     size: int
#     modified_at: datetime
#     source: str            # "onedrive_pro", "onedrive_perso"
#     mime_type: str | None = None
#     is_folder: bool = False
#
# @dataclass
# class SearchResult:
#     id: str
#     content: str
#     source: str
#     score: float
#     metadata: dict | None = None


# ============================================================================
# 9. MATRICE DE RESPONSABILITÉ
# ============================================================================
#
# Endpoint                    │ P1 Backend │ P2 Frontend │ P3 Connecteurs
# ────────────────────────────┼────────────┼─────────────┼───────────────
# POST /auth/login/microsoft  │ Implémente │ Consomme    │ —
# POST /auth/login/google     │ Implémente │ Consomme    │ —
# GET  /auth/callback/*       │ Implémente │ Redirigé    │ —
# GET  /auth/me               │ Implémente │ Consomme    │ —
# POST /auth/logout           │ Implémente │ Consomme    │ —
# POST /chat                  │ Implémente │ Consomme    │ —
# POST /chat/upload           │ Implémente │ Consomme    │ —
# GET  /chat/history          │ Implémente │ Consomme    │ —
# GET  /chat/history/:id      │ Implémente │ Consomme    │ —
# GET  /chat/documents        │ Implémente │ Consomme    │ —
# DELETE /chat/documents      │ Implémente │ Consomme    │ —
# DELETE /chat/documents/:fn  │ Implémente │ Consomme    │ —
# GET  /agenda/events         │ Implémente │ Consomme    │ Fournit données
# GET  /agenda/today          │ Implémente │ Consomme    │ Fournit données
# GET  /documents/tree        │ Implémente │ Consomme    │ Fournit données
# GET  /documents/search      │ Implémente │ Consomme    │ —
# GET  /dashboard/summary     │ Implémente │ Consomme    │ Fournit données
# GET  /dashboard/tasks       │ Implémente │ Consomme    │ Fournit données
# GET  /health                │ Implémente │ —           │ —
# BaseConnector interface     │ Définit    │ —           │ Implémente
# shared/types.py             │ Co-définit │ —           │ Co-définit
#
# ============================================================================


# ============================================================================
# 10. RÈGLES DE VERSIONING & MODIFICATIONS
# ============================================================================
#
# 1. Ce fichier est dans le repo Git à la racine : alternapp/CONTRAT_API.txt
#
# 2. Processus de modification :
#    a. Le dev qui veut modifier crée une branche : update/api-contract-xxx
#    b. Il modifie CE fichier
#    c. Il crée une PR et tag les 2 autres devs
#    d. La PR est mergée uniquement si les 3 approuvent
#
# 3. Règles de rétrocompatibilité :
#    - Ajouter un champ optionnel dans une réponse → OK (non-breaking)
#    - Ajouter un endpoint → OK (communiquer)
#    - Modifier un champ existant → BREAKING → discussion obligatoire
#    - Supprimer un endpoint ou un champ → INTERDIT sans migration
#
# 4. Convention de nommage :
#    - Endpoints : /resource/action (kebab-case si besoin)
#    - Champs JSON : snake_case (user_id, created_at, chunks_count)
#    - Dates : ISO 8601 avec timezone (2026-03-15T09:00:00Z)
#    - IDs : UUID v4 (sauf IDs externes comme Jira : PROJ-42)
#
# ============================================================================


# ============================================================================
# 11. WORKFLOW GIT
# ============================================================================
#
# Branches :
#   main                       ← protégée, PR obligatoire
#   feat/backend-xxx           ← Partie 1
#   feat/frontend-xxx          ← Partie 2
#   feat/connector-xxx         ← Partie 3
#   update/api-contract-xxx    ← modifications du contrat (les 3)
#
# Règles :
#   - Ne JAMAIS push directement sur main
#   - PR avec au moins 1 review avant merge
#   - Modifications du contrat API = review des 3
#   - Commits en français avec préfixes : feat:, fix:, refactor:, test:, docs:
#
# ============================================================================