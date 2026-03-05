"""
Service de gestion des conversations et messages (Supabase).
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
            raise ValueError("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante.")
        _supabase = create_client(url, key)
    return _supabase


def create_conversation(title: str, user_id: str | None = None) -> str:
    client = _get_client()
    data: dict = {"title": title}
    if user_id:
        data["user_id"] = user_id
    result = client.table("conversations").insert(data).execute()
    conversation_id = result.data[0]["id"]
    logger.info("Conversation créée : %s", conversation_id)
    return conversation_id


def add_message(
    conversation_id: str,
    role: str,
    content: str,
    sources: list | None = None,
) -> str:
    """Ajoute un message et retourne son UUID."""
    client = _get_client()
    record: dict = {"conversation_id": conversation_id, "role": role, "content": content}
    if sources is not None:
        record["sources"] = sources

    result = client.table("messages").insert(record).execute()
    message_id = result.data[0]["id"]

    client.table("conversations").update({"updated_at": "now()"}).eq("id", conversation_id).execute()
    return message_id


def get_conversations(user_id: str | None = None) -> list[dict]:
    client = _get_client()
    query = client.table("conversations").select("id, title, created_at, updated_at").order("updated_at", desc=True)
    if user_id:
        query = query.eq("user_id", user_id)
    result = query.execute()
    conversations = result.data or []

    enriched = []
    for conv in conversations:
        msg_result = (
            client.table("messages")
            .select("id", count="exact")
            .eq("conversation_id", conv["id"])
            .execute()
        )
        enriched.append({**conv, "message_count": msg_result.count or 0})
    return enriched


def get_conversation_messages(conversation_id: str) -> list[dict]:
    client = _get_client()
    result = (
        client.table("messages")
        .select("id, role, content, sources, created_at")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .execute()
    )
    return result.data or []


def delete_conversation(conversation_id: str) -> bool:
    """Supprime une conversation et tous ses messages."""
    client = _get_client()
    # Supprimer les messages en premier (évite erreur FK si pas de CASCADE)
    client.table("messages").delete().eq("conversation_id", conversation_id).execute()
    # Supprimer la conversation
    result = client.table("conversations").delete().eq("id", conversation_id).execute()
    deleted = bool(result.data)
    if deleted:
        logger.info("Conversation supprimée : %s", conversation_id)
    return deleted


def get_conversation_with_messages(conversation_id: str) -> dict | None:
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
