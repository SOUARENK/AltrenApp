"""
Routes Documents — gestion des documents indexés + tree + search sémantique.
"""

import logging
import os
import time
import uuid

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")

from models.schemas import (
    DocumentSearchResponse,
    DocumentTreeResponse,
    FileItem,
    IngestResponse,
    MoveRequest,
    SearchResultItem,
)
from services.classifier_service import classify_theme
from services.rag_engine import (
    chunk_pages,
    delete_all_documents,
    delete_by_filename,
    extract_pages,
    generate_embedding,
    generate_embeddings,
    insert_chunks,
    is_supported,
    list_documents,
    search_similar_chunks,
    update_file_metadata,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Documents"])

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


@router.get("/documents/tree", response_model=DocumentTreeResponse)
async def get_document_tree(path: str = "/"):
    """
    Retourne l'arborescence des documents indexés, formatée pour le frontend.
    Chaque fichier indexé dans Supabase est représenté comme un FileItem.
    """
    try:
        docs = list_documents()

        # Grouper par thème (= dossiers racine) et sous-dossier
        theme_folders: dict[str, dict] = {}
        file_items: list[FileItem] = []

        for doc in docs:
            theme = doc.get("theme", "entreprise")
            subfolder = doc.get("subfolder")
            filename = doc.get("name", "document")

            # Créer le dossier thème si besoin
            if theme not in theme_folders:
                theme_folders[theme] = True
                theme_labels = {
                    "entreprise": "Entreprise",
                    "ecole": "École",
                    "administratif": "Administratif",
                    "partage": "Partagé",
                    "outlook_mail": "Mails Outlook",
                    "outlook_calendrier": "Calendrier Outlook",
                }
                file_items.append(FileItem(
                    id=f"folder-{theme}",
                    name=theme_labels.get(theme, theme.capitalize()),
                    path=f"/{theme}",
                    is_folder=True,
                    source="onedrive_pro",
                ))

            # Ajouter le fichier
            doc_path = f"/{theme}/{subfolder}/{filename}" if subfolder else f"/{theme}/{filename}"
            file_items.append(FileItem(
                id=f"doc-{uuid.uuid4().hex[:8]}-{filename[:20]}",
                name=filename,
                path=doc_path,
                is_folder=False,
                size=None,
                mime_type="application/octet-stream",
                modified_at=None,
                source="onedrive_pro" if theme == "entreprise" else "onedrive_perso",
            ))

        # Filtrer par path si demandé
        if path != "/":
            file_items = [f for f in file_items if f.path.startswith(path)]

        return DocumentTreeResponse(files=file_items)

    except Exception as exc:
        logger.exception("Erreur /documents/tree : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur récupération arborescence.") from exc


@router.get("/documents/search", response_model=DocumentSearchResponse)
async def search_documents(q: str = ""):
    """Recherche sémantique dans les documents indexés via pgvector."""
    if not q.strip():
        return DocumentSearchResponse(results=[], query=q)

    try:
        query_embedding = generate_embedding(q.strip())
        chunks = search_similar_chunks(query_embedding, top_k=10, threshold=0.2)

        results = [
            SearchResultItem(
                filename=c.get("metadata", {}).get("filename", "document"),
                content=(c.get("content", "")[:400] + "...") if len(c.get("content", "")) > 400 else c.get("content", ""),
                similarity=round(float(c.get("similarity", 0)), 3),
                page=c.get("metadata", {}).get("page"),
            )
            for c in chunks
        ]

        logger.info("Recherche '%s' : %d résultats.", q, len(results))
        return DocumentSearchResponse(results=results, query=q)

    except ValueError as exc:
        raise HTTPException(status_code=503, detail="Service non configuré.") from exc
    except Exception as exc:
        logger.exception("Erreur /documents/search : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur recherche.") from exc


@router.get("/documents")
async def get_documents():
    """Retourne la liste des fichiers indexés (usage interne/admin)."""
    try:
        docs = list_documents()
        for doc in docs:
            doc["has_file"] = os.path.isfile(os.path.join(UPLOADS_DIR, doc["name"]))
        return docs
    except Exception as exc:
        logger.exception("Erreur liste documents : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur lecture documents.") from exc


@router.delete("/documents")
async def clear_documents():
    """Supprime tous les documents indexés."""
    try:
        deleted = delete_all_documents()
        return {"deleted": deleted, "message": f"{deleted} chunk(s) supprimé(s)."}
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Erreur suppression.") from exc


@router.delete("/documents/file")
async def delete_document(filename: str = Query(..., description="Nom du fichier à supprimer")):
    """Supprime tous les chunks d'un fichier."""
    try:
        deleted = delete_by_filename(filename)
        if deleted == 0:
            raise HTTPException(status_code=404, detail=f"Fichier '{filename}' introuvable.")
        return {"deleted": deleted, "filename": filename}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Erreur suppression.") from exc


@router.patch("/documents/move")
async def move_document(filename: str = Query(..., description="Nom du fichier à déplacer"), body: MoveRequest = ...):
    """Déplace un fichier vers un autre thème ou sous-dossier."""
    try:
        updated = update_file_metadata(filename, theme=body.theme, subfolder=body.subfolder)
        if updated == 0:
            raise HTTPException(status_code=404, detail=f"Fichier '{filename}' introuvable.")
        return {"updated": updated, "filename": filename}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Erreur déplacement.") from exc


@router.post("/ingest", response_model=IngestResponse)
async def ingest_document(
    file: UploadFile = File(...),
    theme: str | None = Form(None),
    subfolder: str | None = Form(None),
) -> IngestResponse:
    """Ingère un document complet dans la base vectorielle."""
    start = time.time()
    filename = file.filename or "document"

    if not is_supported(filename):
        raise HTTPException(status_code=400, detail="Format non supporté.")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 50 MB).")

    dest = os.path.join(UPLOADS_DIR, filename)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as f:
        f.write(file_bytes)

    try:
        pages = extract_pages(file_bytes, filename)
        if not pages:
            raise HTTPException(status_code=400, detail="Impossible d'extraire du texte.")

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
        raise HTTPException(status_code=503, detail="Service non configuré.") from exc
    except Exception as exc:
        logger.exception("Erreur /ingest : %s", exc)
        raise HTTPException(status_code=500, detail="Erreur interne.") from exc
