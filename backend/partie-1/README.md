# 🤖 RAG Chatbot — Guide d'installation pas à pas

Un chatbot intelligent qui répond **uniquement** à partir de tes documents PDF, grâce à la technologie RAG (Retrieval-Augmented Generation).

## 📐 Architecture du projet

```
rag-chatbot/
├── .env                    ← Tes clés secrètes (NE JAMAIS PARTAGER)
├── .gitignore              ← Fichiers ignorés par Git
├── supabase_setup.sql      ← Script SQL à exécuter dans Supabase
├── README.md               ← Ce fichier
├── backend/
│   ├── main.py             ← Serveur API (FastAPI)
│   └── requirements.txt    ← Dépendances Python
└── frontend/
    ├── package.json        ← Dépendances Node.js
    ├── vite.config.js      ← Configuration Vite
    ├── index.html          ← Page HTML
    └── src/
        ├── main.jsx        ← Point d'entrée React
        └── App.jsx         ← Composant principal (interface chat)
```

## 🔧 Prérequis

Avant de commencer, installe ces outils sur ton ordinateur :

1. **Python 3.10+** → [python.org](https://www.python.org/downloads/)
2. **Node.js 18+** → [nodejs.org](https://nodejs.org/)
3. **Git** → [git-scm.com](https://git-scm.com/)

Vérifie que tout est installé :
```bash
python --version   # Doit afficher 3.10 ou plus
node --version     # Doit afficher 18 ou plus
npm --version      # Installé avec Node.js
```

---

## 🚀 Installation en 5 étapes

### Étape 1 : Configurer Supabase (base de données vectorielle)

1. Va sur [supabase.com](https://supabase.com) et connecte-toi
2. Va dans ton projet → **SQL Editor** (menu de gauche)
3. Clique sur **"New query"**
4. Copie-colle TOUT le contenu du fichier `supabase_setup.sql`
5. Clique sur **"Run"** (▶️)
6. Tu devrais voir ✅ "Success" — la table et la fonction sont créées !

### Étape 2 : Vérifier le fichier .env

Ouvre le fichier `.env` à la racine du projet et vérifie que toutes les valeurs sont correctes :
```
OPENAI_API_KEY=sk-proj-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

⚠️ **Ne partage JAMAIS ce fichier.**

### Étape 3 : Installer et lancer le backend

Ouvre un **terminal** et navigue vers le dossier backend :

```bash
# 1. Va dans le dossier backend
cd rag-chatbot/backend

# 2. Crée un environnement virtuel Python (isole les dépendances)
python -m venv venv

# 3. Active l'environnement virtuel
# Sur Mac/Linux :
source venv/bin/activate
# Sur Windows :
venv\Scripts\activate

# 4. Installe les dépendances
pip install -r requirements.txt

# 5. Lance le serveur
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Tu devrais voir :
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Started reloader process
```

✅ Le backend tourne ! Teste en ouvrant http://localhost:8000 dans ton navigateur.

### Étape 4 : Installer et lancer le frontend

Ouvre un **nouveau terminal** (garde le premier ouvert !) :

```bash
# 1. Va dans le dossier frontend
cd rag-chatbot/frontend

# 2. Installe les dépendances Node.js
npm install

# 3. Lance le serveur de développement
npm run dev
```

Tu devrais voir :
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

### Étape 5 : Utiliser l'application

1. Ouvre **http://localhost:5173** dans ton navigateur
2. Clique sur **"📎 Uploader un PDF"** dans la sidebar
3. Sélectionne un fichier PDF
4. Attends que le traitement soit terminé (chunking + embedding)
5. Pose ta question dans le champ en bas !

---

## 🧠 Comment ça marche ? (Pipeline RAG)

```
PDF → Extraction texte → Chunking → Embedding → Stockage Supabase
                                                          │
Question → Embedding → Recherche similarité → Chunks pertinents
                                                          │
                                          Question + Chunks → LLM → Réponse
```

1. **Upload PDF** : Le texte est extrait puis découpé en morceaux (chunks) de ~500 caractères
2. **Embedding** : Chaque chunk est transformé en vecteur de 1536 nombres par OpenAI
3. **Stockage** : Les vecteurs sont stockés dans Supabase (PostgreSQL + pgvector)
4. **Question** : La question est aussi vectorisée
5. **Recherche** : On cherche les 5 chunks les plus similaires (cosine similarity)
6. **LLM** : Les chunks trouvés + la question sont envoyés à GPT-4o-mini (température 0)
7. **Réponse** : Le LLM répond uniquement à partir du contexte fourni

---

## 🛠️ Dépannage courant

| Problème | Solution |
|----------|----------|
| `ModuleNotFoundError` | Vérifie que tu as activé le venv et fait `pip install -r requirements.txt` |
| `Connection refused` sur le chat | Vérifie que le backend tourne sur le port 8000 |
| `Erreur 401 OpenAI` | Ta clé API est invalide ou expirée → régénère-la |
| Le PDF ne s'uploade pas | Vérifie que c'est bien un .pdf et que le backend est lancé |
| `relation "documents" does not exist` | Tu n'as pas exécuté le script SQL dans Supabase |

---

## 📚 Glossaire pour débutant

- **RAG** : Retrieval-Augmented Generation — technique qui enrichit le LLM avec des documents
- **Chunk** : Morceau de texte découpé pour être traité
- **Embedding** : Représentation numérique (vecteur) du sens d'un texte
- **Vecteur** : Liste de nombres qui représente un texte dans un espace mathématique
- **Similarité cosinus** : Mesure de ressemblance entre deux vecteurs (1 = identique, 0 = différent)
- **LLM** : Large Language Model — modèle d'IA qui génère du texte (ici GPT-4o-mini)
- **pgvector** : Extension PostgreSQL pour stocker et chercher des vecteurs
- **FastAPI** : Framework Python pour créer des APIs web
- **Vite** : Outil de build rapide pour les applications frontend
