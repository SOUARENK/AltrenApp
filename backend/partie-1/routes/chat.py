"""
Routes chat — POST /chat + POST /chat/upload + GET /chat/history.
"""

import logging
import time

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from models.schemas import (
    ChatRequest,
    ChatResponse,
    ConversationDetail,
    ConversationSummary,
    IngestResponse,
    MessageSchema,
    Source,
)
from services.classifier_service import classify_theme
from services.conversation_service import (
    add_message,
    create_conversation,
    get_conversation_with_messages,
    get_conversations,
)
from services.llm_service import generate_answer
from services.rag_engine import (
    chunk_pages,
    extract_pages,
    generate_embedding,
    generate_embeddings,
    insert_chunks,
    is_supported,
    search_similar_chunks,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Chat"])

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """
    Pose une question et obtient une réponse basée sur les documents indexés.

    Si conversation_id est fourni, ajoute les messages à cette conversation.
    Sinon, crée une nouvelle conversation avec un titre généré depuis la question.
    """
    question = request.question.strip()
    precision = request.precision
    conversation_id = request.conversation_id

    try:
        query_embedding = generate_embedding(question)
        chunks = search_similar_chunks(query_embedding)
        answer = generate_answer(question, chunks, precision=precision)

        sources = [
            Source(
                filename=c.get("metadata", {}).get("filename", ""),
                page=int(c.get("metadata", {}).get("page", 0)),
                similarity=round(float(c.get("similarity", 0)), 3),
                excerpt=(c.get("content", "")[:200] + "...") if len(c.get("content", "")) > 200 else c.get("content", ""),
            )
            for c in chunks
        ]

        # Créer ou réutiliser une conversation
        if not conversation_id:
            title = question[:80] + ("…" if len(question) > 80 else "")
            conversation_id = create_conversation(title=title)

        # Sauvegarder les messages
        add_message(conversation_id, role="user", content=question)
        sources_data = [s.model_dump() for s in sources]
        add_message(conversation_id, role="assistant", content=answer, sources=sources_data)

        return ChatResponse(
            answer=answer,
            sources=sources,
            chunks_found=len(chunks),
            conversation_id=conversation_id,
        )

    except ValueError as exc:
        logger.error("Erreur de configuration : %s", exc)
        raise HTTPException(status_code=503, detail="Service non configuré correctement.") from exc
    except Exception as exc:
        logger.exception("Erreur inattendue dans /chat : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur interne du serveur.") from exc


@router.get("/chat/history", response_model=list[ConversationSummary])
async def get_history() -> list[ConversationSummary]:
    """Retourne toutes les conversations avec leur nombre de messages."""
    try:
        conversations = get_conversations()
        return [ConversationSummary(**c) for c in conversations]
    except Exception as exc:
        logger.exception("Erreur récupération historique : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur lors de la récupération de l'historique.") from exc


@router.get("/chat/history/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(conversation_id: str) -> ConversationDetail:
    """Retourne une conversation avec tous ses messages."""
    try:
        conv = get_conversation_with_messages(conversation_id)
        if conv is None:
            raise HTTPException(status_code=404, detail="Conversation introuvable.")

        messages = [
            MessageSchema(
                id=m["id"],
                role=m["role"],
                content=m["content"],
                sources=[Source(**s) for s in (m.get("sources") or [])],
                created_at=m["created_at"],
            )
            for m in conv["messages"]
        ]

        return ConversationDetail(
            id=conv["id"],
            title=conv.get("title"),
            created_at=conv["created_at"],
            updated_at=conv["updated_at"],
            messages=messages,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Erreur récupération conversation %s : %s", conversation_id, exc)
        raise HTTPException(status_code=500, detail="Erreur interne du serveur.") from exc


@router.post("/chat/upload", response_model=IngestResponse)
async def upload_document(
    file: UploadFile = File(...),
    theme: str | None = Form(None),
    subfolder: str | None = Form(None),
) -> IngestResponse:
    """
    Ingère un document via l'interface chat.

    Alias de POST /ingest — même pipeline : extraction → classification → chunking → embeddings → stockage.
    """
    start = time.time()
    filename = file.filename or "document"

    if not is_supported(filename):
        raise HTTPException(
            status_code=400,
            detail="Format non supporté. Formats acceptés : PDF, DOCX, PPTX, TXT, CSV, PNG, JPG, BMP, TIFF.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Le fichier dépasse {MAX_FILE_SIZE // (1024 * 1024)} MB.",
        )

    try:
        pages = extract_pages(file_bytes, filename)
        if not pages:
            raise HTTPException(
                status_code=400,
                detail="Impossible d'extraire du texte de ce fichier.",
            )

        if theme:
            detected_theme = theme
            detected_subfolder = subfolder or None
        else:
            full_text = " ".join(p["text"] for p in pages[:3])
            detected_theme, detected_subfolder = classify_theme(full_text)

        chunks = chunk_pages(pages, filename=filename)
        if not chunks:
            raise HTTPException(status_code=400, detail="Aucun chunk créé à partir de ce fichier.")

        for chunk in chunks:
            chunk["metadata"]["theme"] = detected_theme
            if detected_subfolder:
                chunk["metadata"]["subfolder"] = detected_subfolder

        texts = [c["content"] for c in chunks]
        embeddings = generate_embeddings(texts)
        inserted = insert_chunks(chunks, embeddings)

        elapsed_ms = int((time.time() - start) * 1000)
        logger.info("Upload OK : %d chunks en %d ms pour '%s'.", inserted, elapsed_ms, filename)

        return IngestResponse(
            success=True,
            chunks_ingested=inserted,
            filename=filename,
            processing_time_ms=elapsed_ms,
            theme=detected_theme,
        )

    except HTTPException:
        raise
    except ValueError as exc:
        logger.error("Erreur de configuration : %s", exc)
        raise HTTPException(status_code=503, detail="Service non configuré correctement.") from exc
    except Exception as exc:
        logger.exception("Erreur inattendue dans /chat/upload : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur interne du serveur.") from exc
