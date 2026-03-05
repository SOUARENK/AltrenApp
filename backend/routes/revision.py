"""
Routes Révision — Génération de flashcards et QCM à partir des documents indexés.
"""

import json
import logging
import os

from fastapi import APIRouter, HTTPException
from openai import OpenAI

from models.schemas import RevisionRequest, RevisionResponse
from services.rag_engine import _get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Révision"])

_llm: OpenAI | None = None


def _get_llm() -> OpenAI:
    global _llm
    if _llm is None:
        key = os.getenv("OPENAI_API_KEY")
        if not key:
            raise ValueError("OPENAI_API_KEY manquante.")
        _llm = OpenAI(api_key=key)
    return _llm


def _fetch_chunks(filename: str | None, theme: str | None, subfolder: str | None) -> list[str]:
    """Récupère les contenus de chunks depuis Supabase selon le filtre."""
    client = _get_supabase_client()
    query = client.table("documents").select("content, metadata")

    if filename:
        query = query.filter("metadata->>filename", "eq", filename)
    elif subfolder and theme:
        query = query.filter("metadata->>theme", "eq", theme).filter("metadata->>subfolder", "eq", subfolder)
    elif theme:
        query = query.filter("metadata->>theme", "eq", theme)

    result = query.limit(60).execute()
    return [row["content"] for row in (result.data or []) if row.get("content")]


_FLASHCARD_PROMPTS = {
    "easy": """\
À partir du texte suivant, génère exactement {count} flashcards simples en JSON.
Les questions doivent porter sur des définitions ou faits directs, faciles à mémoriser.
Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown, sans explication :
[{{"id": "1", "question": "...", "answer": "..."}}]

Texte source :
{text}""",
    "medium": """\
À partir du texte suivant, génère exactement {count} flashcards de niveau intermédiaire en JSON.
Les questions doivent tester la compréhension des concepts et leurs relations.
Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown, sans explication :
[{{"id": "1", "question": "...", "answer": "..."}}]

Texte source :
{text}""",
    "hard": """\
À partir du texte suivant, génère exactement {count} flashcards difficiles en JSON.
Les questions doivent nécessiter analyse, synthèse ou application des concepts dans des cas concrets.
 Les réponses doivent être détaillées et précises.
Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown, sans explication :
[{{"id": "1", "question": "...", "answer": "..."}}]

Texte source :
{text}""",
}

_QUIZ_PROMPTS = {
    "easy": """\
À partir du texte suivant, génère exactement {count} questions QCM simples en JSON.
Les questions portent sur des faits directs avec des options clairement distinctes.
Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown, sans explication :
[{{"id":"1","question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}}]

Texte source :
{text}""",
    "medium": """\
À partir du texte suivant, génère exactement {count} questions QCM de niveau intermédiaire en JSON.
Les questions testent la compréhension et l'application des concepts. Les distracteurs doivent être plausibles.
Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown, sans explication :
[{{"id":"1","question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}}]

Texte source :
{text}""",
    "hard": """\
À partir du texte suivant, génère exactement {count} questions QCM difficiles en JSON.
Les questions exigent analyse, comparaison ou raisonnement avancé. Les options doivent être proches et subtiles.
Les explications doivent être détaillées et pédagogiques.
Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown, sans explication :
[{{"id":"1","question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}}]

Texte source :
{text}""",
}


_DIFFICULTY_COUNT = {"easy": 5, "medium": 10, "hard": 15}


@router.post("/revision/generate", response_model=RevisionResponse)
async def generate_revision(body: RevisionRequest):
    """Génère des flashcards ou un QCM à partir d'un fichier, dossier ou thème."""
    chunks = _fetch_chunks(body.filename, body.theme, body.subfolder)
    if not chunks:
        raise HTTPException(status_code=404, detail="Aucun document trouvé pour ce filtre.")

    difficulty = body.difficulty if body.difficulty in _DIFFICULTY_COUNT else "easy"
    count = _DIFFICULTY_COUNT[difficulty]
    text_limit = 6000 if difficulty == "easy" else 10000 if difficulty == "medium" else 14000
    text = "\n\n".join(chunks)[:text_limit]

    prompts = _FLASHCARD_PROMPTS if body.mode == "flashcard" else _QUIZ_PROMPTS
    prompt = prompts[difficulty].format(count=count, text=text)

    try:
        client = _get_llm()
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Tu es un assistant pédagogique expert en création de contenu de révision."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=3000,
        )
        raw = resp.choices[0].message.content or "[]"

        # Nettoyer si GPT ajoute du markdown
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        items = json.loads(raw)

    except json.JSONDecodeError as exc:
        logger.error("JSON invalide reçu d'OpenAI : %s", exc)
        raise HTTPException(status_code=500, detail="Réponse OpenAI invalide.") from exc
    except Exception as exc:
        logger.exception("Erreur génération révision : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur génération.") from exc

    return RevisionResponse(mode=body.mode, items=items)
