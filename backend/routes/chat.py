"""
Routes Chat — POST /chat, POST /chat/upload, GET /chat/history, GET /chat/history/{id}
Format de réponse adapté au contrat frontend.
"""

import logging
import time

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from models.schemas import (
    ChatRequest,
    ChatResponse,
    ConversationDetail,
    ConversationSummary,
    MessageSchema,
    Source,
    UploadResponse,
)
from services.classifier_service import classify_theme
from services.conversation_service import (
    add_message,
    create_conversation,
    delete_conversation,
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
    """Pose une question au chatbot RAG et retourne une réponse avec sources."""
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
                content=(c.get("content", "")[:300] + "...") if len(c.get("content", "")) > 300 else c.get("content", ""),
            )
            for c in chunks
        ]

        if not conversation_id:
            title = question[:80] + ("…" if len(question) > 80 else "")
            conversation_id = create_conversation(title=title)

        add_message(conversation_id, role="user", content=question)
        sources_data = [s.model_dump() for s in sources]
        message_id = add_message(conversation_id, role="assistant", content=answer, sources=sources_data)

        return ChatResponse(
            answer=answer,
            sources=sources,
            chunks_found=len(chunks),
            conversation_id=conversation_id,
            message_id=message_id,
        )

    except ValueError as exc:
        logger.error("Erreur de configuration : %s", exc)
        raise HTTPException(status_code=503, detail="Service non configuré correctement.") from exc
    except Exception as exc:
        logger.exception("Erreur inattendue /chat : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur interne du serveur.") from exc


@router.get("/chat/history")
async def get_history():
    """Retourne toutes les conversations sous forme {conversations: [...]}."""
    try:
        conversations = get_conversations()
        return {"conversations": [ConversationSummary(**c).model_dump() for c in conversations]}
    except Exception as exc:
        logger.exception("Erreur historique : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur récupération historique.") from exc


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
                sources=[
                    Source(**{**s, "content": s.get("content", s.get("excerpt", ""))})
                    for s in (m.get("sources") or [])
                ],
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
        logger.exception("Erreur conversation %s : %s", conversation_id, exc)
        raise HTTPException(status_code=500, detail="Erreur interne du serveur.") from exc


@router.delete("/chat/history/{conversation_id}")
async def delete_conversation_route(conversation_id: str):
    """Supprime une conversation et tous ses messages."""
    try:
        deleted = delete_conversation(conversation_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Conversation introuvable.")
        return {"message": "Conversation supprimée."}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Erreur suppression conversation %s : %s", conversation_id, exc)
        raise HTTPException(status_code=500, detail="Erreur interne du serveur.") from exc


@router.post("/chat/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    theme: str | None = Form(None),
    subfolder: str | None = Form(None),
) -> UploadResponse:
    """Ingère un document (PDF, DOCX, PPTX, TXT, CSV) dans la base vectorielle."""
    start = time.time()
    filename = file.filename or "document"

    if not is_supported(filename):
        raise HTTPException(
            status_code=400,
            detail="Format non supporté. Formats acceptés : PDF, DOCX, PPTX, TXT, CSV, PNG, JPG.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"Fichier trop volumineux (max 50 MB).")

    try:
        pages = extract_pages(file_bytes, filename)
        if not pages:
            raise HTTPException(status_code=400, detail="Impossible d'extraire du texte de ce fichier.")

        if theme:
            detected_theme = theme
            detected_subfolder = subfolder or None
        else:
            full_text = " ".join(p["text"] for p in pages[:3])
            detected_theme, detected_subfolder = classify_theme(full_text)

        chunks = chunk_pages(pages, filename=filename)
        if not chunks:
            raise HTTPException(status_code=400, detail="Aucun chunk créé.")

        for chunk in chunks:
            chunk["metadata"]["theme"] = detected_theme
            if detected_subfolder:
                chunk["metadata"]["subfolder"] = detected_subfolder

        embeddings = generate_embeddings([c["content"] for c in chunks])
        inserted = insert_chunks(chunks, embeddings)

        elapsed_ms = int((time.time() - start) * 1000)
        logger.info("Upload OK : %d chunks en %d ms pour '%s'.", inserted, elapsed_ms, filename)

        return UploadResponse(
            success=True,
            filename=filename,
            chunks_count=inserted,
            message=f"{inserted} chunks indexés en {elapsed_ms}ms (thème: {detected_theme})",
        )

    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=503, detail="Service non configuré.") from exc
    except Exception as exc:
        logger.exception("Erreur /chat/upload : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur interne du serveur.") from exc
