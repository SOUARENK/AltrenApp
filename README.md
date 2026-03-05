# AlternApp

Application de gestion de l'alternance — assistant IA pour centraliser cours, mails, agenda et révisions.

## Stack

- **Frontend** : React 19 + Vite + TypeScript + TailwindCSS
- **Backend** : FastAPI + Uvicorn + Python 3.11
- **Base de données** : Supabase (PostgreSQL + pgvector)
- **IA** : OpenAI GPT-4o-mini (chat, RAG, génération QCM/flashcards)

## Fonctionnalités

- 📁 Indexation et recherche de documents (PDF, DOCX)
- 💬 Chatbot RAG sur les documents indexés
- 🧠 Génération de flashcards et QCM avec niveaux de difficulté
- 📅 Agenda synchronisé (ICS / Google Calendar)
- 📧 Connexion messagerie Outlook via IMAP

## Lancement

### Backend
```bash
cd backend
.venv\Scripts\uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Configuration

Copier `backend/.env.example` en `backend/.env` et remplir les variables :
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
