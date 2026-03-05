"""
Routes de gestion des documents — GET/DELETE /documents + POST /ingest.
"""

import logging
import time

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from models.schemas import IngestResponse, MoveRequest
from services.classifier_service import classify_theme
from services.rag_engine import (
    chunk_pages,
    delete_all_documents,
    delete_by_filename,
    extract_pages,
    generate_embeddings,
    insert_chunks,
    is_supported,
    list_documents,
    update_file_metadata,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Documents"])

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


@router.get("/documents")
async def get_documents():
    """Retourne la liste des fichiers indexés avec leur nombre de chunks."""
    try:
        return list_documents()
    except Exception as exc:
        logger.exception("Erreur liste documents : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur lors de la lecture des documents.") from exc


@router.delete("/documents")
async def clear_documents():
    """Supprime tous les documents indexés de la base vectorielle."""
    try:
        deleted = delete_all_documents()
        return {"deleted": deleted, "message": f"{deleted} chunk(s) supprimé(s)."}
    except Exception as exc:
        logger.exception("Erreur suppression documents : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur lors de la suppression.") from exc


@router.delete("/documents/{filename}")
async def delete_document(filename: str):
    """Supprime tous les chunks d'un fichier spécifique."""
    try:
        deleted = delete_by_filename(filename)
        if deleted == 0:
            raise HTTPException(status_code=404, detail=f"Fichier '{filename}' introuvable.")
        return {"deleted": deleted, "filename": filename}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Erreur suppression '%s' : %s", filename, exc)
        raise HTTPException(status_code=500, detail="Erreur lors de la suppression.") from exc


@router.patch("/documents/{filename}/move")
async def move_document(filename: str, body: MoveRequest):
    """Déplace un fichier vers un autre thème ou sous-dossier."""
    try:
        updated = update_file_metadata(filename, theme=body.theme, subfolder=body.subfolder)
        if updated == 0:
            raise HTTPException(status_code=404, detail=f"Fichier '{filename}' introuvable.")
        return {"updated": updated, "filename": filename, "theme": body.theme, "subfolder": body.subfolder}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Erreur déplacement '%s' : %s", filename, exc)
        raise HTTPException(status_code=500, detail="Erreur lors du déplacement.") from exc


@router.post("/ingest", response_model=IngestResponse)
async def ingest_document(
    file: UploadFile = File(...),
    theme: str | None = Form(None),
    subfolder: str | None = Form(None),
) -> IngestResponse:
    """
    Ingère un document : extraction → classification → chunking → embeddings → stockage.
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
                detail="Impossible d'extraire du texte de ce fichier. Vérifiez que le fichier n'est pas vide ou protégé.",
            )
        logger.info("'%s' : %d page(s) extraite(s).", filename, len(pages))

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
        logger.info("Ingestion OK : %d chunks en %d ms pour '%s'.", inserted, elapsed_ms, filename)

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
        logger.exception("Erreur inattendue dans /ingest : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur interne du serveur.") from exc
