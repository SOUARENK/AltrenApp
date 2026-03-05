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


_SUMMARY_PROMPT = """\
À partir du texte suivant, génère une fiche de révision complète et pédagogique au format HTML.
Respecte impérativement ces règles :

1. Utilise UNIQUEMENT des styles inline (pas de classes CSS, pas de <style>).
2. Structure obligatoire :
   - Un <h1> avec le titre du cours, fond coloré (#2563eb), texte blanc, padding, border-radius.
   - Plusieurs sections <h2> thématiques (fond #1e3a5f, texte blanc, padding 8px 12px, border-radius 6px).
   - Des sous-sections <h3> si nécessaire (couleur #2563eb, border-left 3px solid #2563eb, padding-left 8px).
3. Encadrés spéciaux (div avec border-radius:8px, padding:12px, margin:12px 0) :
   - Points clés : fond #dbeafe, bordure gauche 4px solid #2563eb.
   - Définitions importantes : fond #ede9fe, bordure gauche 4px solid #7c3aed.
   - À retenir : fond #fef9c3, bordure gauche 4px solid #d97706.
   - Erreurs communes : fond #fee2e2, bordure gauche 4px solid #dc2626.
4. Tableaux comparatifs si pertinent : <table> avec border-collapse:collapse, thead fond #2563eb texte blanc, lignes alternées #f8fafc/#ffffff, cellules bordurées.
5. Listes <ul>/<ol> pour les énumérations, avec emojis si ça aide (📌 🔑 ⚠️ ✅).
6. Termes importants en <strong> ou <span style="color:#2563eb;font-weight:600">.
7. Un bloc "📝 Résumé en bref" en bas (fond #f0fdf4, bordure #16a34a, liste des 5-8 points essentiels).

Réponds UNIQUEMENT avec le HTML (sans <html>, <head>, <body>, sans markdown).

Texte source :
{text}"""

@router.post("/revision/generate", response_model=RevisionResponse)
async def generate_revision(body: RevisionRequest):
    """Génère des flashcards, un QCM ou une fiche de révision HTML."""
    chunks = _fetch_chunks(body.filename, body.theme, body.subfolder)
    if not chunks:
        raise HTTPException(status_code=404, detail="Aucun document trouvé pour ce filtre.")

    # ── Mode fiche de révision HTML ──────────────────────────────────────────
    if body.mode == "summary":
        text = "\n\n".join(chunks)[:14000]
        prompt = _SUMMARY_PROMPT.format(text=text)
        try:
            client = _get_llm()
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Tu es un expert pédagogue. Tu génères des fiches de révision visuelles, colorées et claires en HTML avec styles inline uniquement."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.6,
                max_tokens=4000,
            )
            html = (resp.choices[0].message.content or "").strip()
            if html.startswith("```"):
                html = html.split("```")[1]
                if html.startswith("html"):
                    html = html[4:]
            return RevisionResponse(mode="summary", items=[], html=html.strip())
        except Exception as exc:
            logger.exception("Erreur génération fiche : %s", exc)
            raise HTTPException(status_code=500, detail=f"Erreur génération : {type(exc).__name__} — {exc}") from exc

    # ── Mode flashcard / quiz ────────────────────────────────────────────────
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
        raw = (resp.choices[0].message.content or "[]").strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        items = json.loads(raw.strip())

    except json.JSONDecodeError as exc:
        logger.error("JSON invalide reçu d'OpenAI : %s", exc)
        raise HTTPException(status_code=500, detail="Réponse OpenAI invalide.") from exc
    except Exception as exc:
        logger.exception("Erreur génération révision : %s", exc)
        raise HTTPException(status_code=500, detail=f"Erreur génération : {type(exc).__name__} — {exc}") from exc

    return RevisionResponse(mode=body.mode, items=items)
