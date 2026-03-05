"""
Schémas Pydantic pour la validation des entrées/sorties de l'API.
"""

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000, description="Question de l'utilisateur")
    precision: int = Field(default=2, ge=1, le=3, description="Niveau de précision : 1=concis, 2=normal, 3=détaillé")
    conversation_id: str | None = Field(default=None, description="UUID de la conversation existante (optionnel)")


class Source(BaseModel):
    filename: str
    page: int
    similarity: float
    excerpt: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]
    chunks_found: int
    conversation_id: str


class IngestResponse(BaseModel):
    success: bool
    chunks_ingested: int
    filename: str
    processing_time_ms: int
    theme: str = "autre"


class MoveRequest(BaseModel):
    theme: str | None = None
    subfolder: str | None = None


class MessageSchema(BaseModel):
    id: str
    role: str
    content: str
    sources: list[Source] | None = None
    created_at: str


class ConversationSummary(BaseModel):
    id: str
    title: str | None
    created_at: str
    updated_at: str
    message_count: int


class ConversationDetail(BaseModel):
    id: str
    title: str | None
    created_at: str
    updated_at: str
    messages: list[MessageSchema]
