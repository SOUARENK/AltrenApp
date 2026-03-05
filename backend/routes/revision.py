"""
Routes Révision — Génération de flashcards et QCM à partir des documents indexés.
"""

import hashlib
import json
import logging
import os
import time
from threading import Lock

from fastapi import APIRouter, HTTPException
from openai import OpenAI, RateLimitError

from models.schemas import RevisionRequest, RevisionResponse
from services.rag_engine import _get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Révision"])

_llm: OpenAI | None = None

# ── Cache mémoire (évite de régénérer le même contenu) ───────────────────────
_cache: dict[str, dict] = {}
_cache_lock = Lock()
_CACHE_TTL = 3600  # 1 heure


def _get_llm() -> OpenAI:
    global _llm
    if _llm is None:
        key = os.getenv("OPENAI_API_KEY")
        if not key:
            raise ValueError("OPENAI_API_KEY manquante.")
        _llm = OpenAI(api_key=key)
    return _llm


def _cache_get(key: str) -> dict | None:
    with _cache_lock:
        entry = _cache.get(key)
        if entry and (time.time() - entry["ts"]) < _CACHE_TTL:
            return entry["data"]
        if entry:
            del _cache[key]
    return None


def _cache_set(key: str, data: dict) -> None:
    with _cache_lock:
        _cache[key] = {"data": data, "ts": time.time()}


def _make_cache_key(filename: str | None, theme: str | None, subfolder: str | None,
                   mode: str, difficulty: str) -> str:
    raw = f"{filename}|{theme}|{subfolder}|{mode}|{difficulty}"
    return hashlib.md5(raw.encode()).hexdigest()


def _llm_call(messages: list, temperature: float, max_tokens: int,
              model: str = "gpt-4o-mini", max_retries: int = 4) -> str:
    """Appel OpenAI avec retry exponentiel sur RateLimitError."""
    client = _get_llm()
    for attempt in range(max_retries):
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return (resp.choices[0].message.content or "").strip()
        except RateLimitError as exc:
            if attempt == max_retries - 1:
                raise
            wait = min(10 * 2 ** attempt, 60)  # 10s, 20s, 40s, 60s max
            logger.warning("Rate limit OpenAI, nouvelle tentative dans %ds (%d/%d)…", wait, attempt + 1, max_retries - 1)
            time.sleep(wait)
    raise RuntimeError("Max retries dépassé")


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
    difficulty = body.difficulty if body.difficulty in _DIFFICULTY_COUNT else "easy"

    # ── Vérification du cache ─────────────────────────────────────────────────
    cache_key = _make_cache_key(body.filename, body.theme, body.subfolder, body.mode, difficulty)
    cached = _cache_get(cache_key)
    if cached:
        logger.info("Cache hit pour %s/%s/%s", body.filename or body.theme, body.mode, difficulty)
        return RevisionResponse(**cached)

    chunks = _fetch_chunks(body.filename, body.theme, body.subfolder)
    if not chunks:
        raise HTTPException(status_code=404, detail="Aucun document trouvé pour ce filtre.")

    # ── Mode fiche de révision HTML ──────────────────────────────────────────
    if body.mode == "summary":
        text = "\n\n".join(chunks)[:14000]
        prompt = _SUMMARY_PROMPT.format(text=text)
        try:
            html = _llm_call(
                messages=[
                    {"role": "system", "content": "Tu es un expert pédagogue. Tu génères des fiches de révision visuelles, colorées et claires en HTML avec styles inline uniquement."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.6,
                max_tokens=4000,
            )
            if html.startswith("```"):
                html = html.split("```")[1]
                if html.startswith("html"):
                    html = html[4:]
            html = html.strip()
            result = {"mode": "summary", "items": [], "html": html}
            _cache_set(cache_key, result)
            return RevisionResponse(**result)
        except RateLimitError as exc:
            logger.error("Rate limit OpenAI épuisé : %s", exc)
            raise HTTPException(
                status_code=429,
                detail="Limite de requêtes OpenAI atteinte. Réessaie dans quelques minutes ou vérifie ton quota sur platform.openai.com."
            ) from exc
        except Exception as exc:
            logger.exception("Erreur génération fiche : %s", exc)
            raise HTTPException(status_code=500, detail=f"Erreur génération : {type(exc).__name__} — {exc}") from exc

    # ── Mode flashcard / quiz ────────────────────────────────────────────────
    count = _DIFFICULTY_COUNT[difficulty]
    text_limit = 6000 if difficulty == "easy" else 10000 if difficulty == "medium" else 14000
    text = "\n\n".join(chunks)[:text_limit]

    prompts = _FLASHCARD_PROMPTS if body.mode == "flashcard" else _QUIZ_PROMPTS
    prompt = prompts[difficulty].format(count=count, text=text)

    try:
        raw = _llm_call(
            messages=[
                {"role": "system", "content": "Tu es un assistant pédagogique expert en création de contenu de révision."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=3000,
        )
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        items = json.loads(raw.strip())

    except json.JSONDecodeError as exc:
        logger.error("JSON invalide reçu d'OpenAI : %s", exc)
        raise HTTPException(status_code=500, detail="Réponse OpenAI invalide.") from exc
    except RateLimitError as exc:
        logger.error("Rate limit OpenAI épuisé : %s", exc)
        raise HTTPException(
            status_code=429,
            detail="Limite de requêtes OpenAI atteinte. Réessaie dans quelques minutes ou vérifie ton quota sur platform.openai.com."
        ) from exc
    except Exception as exc:
        logger.exception("Erreur génération révision : %s", exc)
        raise HTTPException(status_code=500, detail=f"Erreur génération : {type(exc).__name__} — {exc}") from exc

    result = {"mode": body.mode, "items": items, "html": None}
    _cache_set(cache_key, result)
    return RevisionResponse(mode=body.mode, items=items)
