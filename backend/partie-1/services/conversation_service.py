"""
Service de gestion des conversations et messages.

Responsabilités :
- Créer et récupérer des conversations depuis Supabase
- Sauvegarder les messages (user + assistant) avec leurs sources
- Retourner l'historique des conversations

Note Phase 1 : user_id est nullable (l'authentification arrive en Phase 3).
"""

import logging
import os

from supabase import Client, create_client

logger = logging.getLogger(__name__)

_supabase: Client | None = None


def _get_client() -> Client:
    global _supabase
    if _supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise ValueError(
                "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante dans les variables d'environnement."
            )
        _supabase = create_client(url, key)
    return _supabase


def create_conversation(title: str, user_id: str | None = None) -> str:
    """
    Crée une nouvelle conversation en base.

    Retourne l'UUID de la conversation créée.
    """
    client = _get_client()
    data = {"title": title}
    if user_id:
        data["user_id"] = user_id

    result = client.table("conversations").insert(data).execute()
    conversation_id = result.data[0]["id"]
    logger.info("Conversation créée : %s ('%s')", conversation_id, title)
    return conversation_id


def add_message(
    conversation_id: str,
    role: str,
    content: str,
    sources: list | None = None,
) -> None:
    """
    Ajoute un message à une conversation existante.

    Args:
        conversation_id: UUID de la conversation
        role: 'user' ou 'assistant'
        content: Texte du message
        sources: Liste de sources (pour les messages assistant), optionnel
    """
    client = _get_client()
    record: dict = {
        "conversation_id": conversation_id,
        "role": role,
        "content": content,
    }
    if sources is not None:
        record["sources"] = sources

    client.table("messages").insert(record).execute()

    # Mettre à jour updated_at de la conversation
    client.table("conversations").update(
        {"updated_at": "now()"}
    ).eq("id", conversation_id).execute()


def get_conversations(user_id: str | None = None) -> list[dict]:
    """
    Retourne la liste de toutes les conversations avec le nombre de messages.

    Phase 1 : sans filtre par user_id (Phase 3 ajoutera l'authentification).
    """
    client = _get_client()
    result = (
        client.table("conversations")
        .select("id, title, created_at, updated_at")
        .order("updated_at", desc=True)
        .execute()
    )
    conversations = result.data or []

    # Ajouter le nombre de messages pour chaque conversation
    enriched = []
    for conv in conversations:
        msg_result = (
            client.table("messages")
            .select("id", count="exact")
            .eq("conversation_id", conv["id"])
            .execute()
        )
        enriched.append({
            **conv,
            "message_count": msg_result.count or 0,
        })

    return enriched


def get_conversation_messages(conversation_id: str) -> list[dict]:
    """
    Retourne tous les messages d'une conversation, dans l'ordre chronologique.
    """
    client = _get_client()
    result = (
        client.table("messages")
        .select("id, role, content, sources, created_at")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .execute()
    )
    return result.data or []


def get_conversation_with_messages(conversation_id: str) -> dict | None:
    """
    Retourne une conversation avec tous ses messages.
    """
    client = _get_client()
    conv_result = (
        client.table("conversations")
        .select("id, title, created_at, updated_at")
        .eq("id", conversation_id)
        .execute()
    )
    if not conv_result.data:
        return None

    conv = conv_result.data[0]
    conv["messages"] = get_conversation_messages(conversation_id)
    return conv
