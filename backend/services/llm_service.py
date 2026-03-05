"""
Génération de réponse via GPT-4o-mini avec niveaux de précision et rendu Markdown.
"""

import logging
import os

import tiktoken
from openai import OpenAI

logger = logging.getLogger(__name__)

LLM_MODEL = "gpt-4o-mini"
CONTEXT_TOKEN_LIMIT = 6000
NO_CONTEXT_RESPONSE = "Je ne trouve pas l'information dans les documents fournis."

_PRECISION_INSTRUCTIONS = {
    1: "Réponds de manière très concise en 2-3 phrases maximum. Va directement à l'essentiel.",
    2: (
        "Réponds de manière claire et équilibrée. "
        "Utilise des listes à puces si la réponse contient plusieurs éléments. "
        "Mets en gras les points importants."
    ),
    3: (
        "Réponds de manière exhaustive et bien structurée. "
        "Utilise des titres (##), tableaux Markdown et listes. "
        "Cite des extraits du contexte entre guillemets."
    ),
}

_BASE_SYSTEM_PROMPT = """\
Tu dois répondre UNIQUEMENT à partir du contexte fourni ci-dessous.
Si la réponse n'est pas dans le contexte, réponds exactement :
"Je ne trouve pas l'information dans les documents fournis."
N'invente rien. Ne complète pas avec tes connaissances générales.

Formate ta réponse en Markdown :
- Tableaux pour les données tabulaires
- Listes à puces pour les énumérations
- **Gras** pour les termes importants
- Titres ## pour structurer les longues réponses

{precision_instruction}"""

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY manquante dans les variables d'environnement.")
        _client = OpenAI(api_key=api_key)
    return _client


def build_context(chunks: list[dict]) -> str:
    enc = tiktoken.get_encoding("cl100k_base")
    parts: list[str] = []

    for chunk in chunks:
        meta = chunk.get("metadata") or {}
        filename = meta.get("filename", "document")
        page = meta.get("page", "?")
        section = f"[Document: {filename} | Page: {page}]\n{chunk['content']}"
        parts.append(section)

    context = "\n\n".join(parts)
    tokens = enc.encode(context)
    if len(tokens) > CONTEXT_TOKEN_LIMIT:
        context = enc.decode(tokens[:CONTEXT_TOKEN_LIMIT])
        logger.warning("Contexte tronqué à %d tokens.", CONTEXT_TOKEN_LIMIT)

    return context


def generate_answer(question: str, chunks: list[dict], precision: int = 2) -> str:
    if not chunks:
        logger.info("Aucun chunk pertinent — réponse de refus.")
        return NO_CONTEXT_RESPONSE

    precision = max(1, min(3, precision))
    client = _get_client()
    context = build_context(chunks)

    system_prompt = _BASE_SYSTEM_PROMPT.format(
        precision_instruction=_PRECISION_INSTRUCTIONS[precision]
    )
    user_message = f"Contexte extrait des documents :\n---\n{context}\n---\n\nQuestion : {question}"

    response = client.chat.completions.create(
        model=LLM_MODEL,
        temperature=0,
        top_p=1,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    )

    answer = response.choices[0].message.content or NO_CONTEXT_RESPONSE
    logger.info("Réponse générée (précision=%d, %d chars).", precision, len(answer))
    return answer
