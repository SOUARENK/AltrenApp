"""
Modèles de données pour les conversations et messages.

Phase 1 : user_id nullable (Phase 3 ajoutera l'authentification OAuth).
"""

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ConversationModel:
    id: str
    title: str | None
    user_id: str | None  # nullable jusqu'à Phase 3
    created_at: datetime
    updated_at: datetime


@dataclass
class MessageModel:
    id: str
    conversation_id: str
    role: str  # 'user' | 'assistant'
    content: str
    sources: list | None
    created_at: datetime
