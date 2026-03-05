"""
Schémas Pydantic — validation des entrées/sorties de l'API.
"""

from pydantic import BaseModel, Field


# ── Chat ────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    precision: int = Field(default=2, ge=1, le=3)
    conversation_id: str | None = None
    mode: str | None = "general"


class Source(BaseModel):
    filename: str
    page: int
    similarity: float
    content: str  # excerpt envoyé au frontend sous la clé "content"


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]
    chunks_found: int
    conversation_id: str
    message_id: str


class UploadResponse(BaseModel):
    success: bool
    filename: str
    chunks_count: int
    message: str


class IngestResponse(BaseModel):
    success: bool
    chunks_ingested: int
    filename: str
    processing_time_ms: int
    theme: str = "autre"


class MoveRequest(BaseModel):
    theme: str | None = None
    subfolder: str | None = None


# ── Conversation ─────────────────────────────────────────────────────────────

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


# ── Auth ─────────────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: str
    name: str
    email: str


class AuthUrlResponse(BaseModel):
    auth_url: str
    state: str


# ── Agenda ───────────────────────────────────────────────────────────────────

class AgendaEvent(BaseModel):
    id: str
    title: str
    start: str
    end: str
    source: str
    location: str | None = None
    description: str | None = None


class AgendaEventsResponse(BaseModel):
    events: list[AgendaEvent]


class UrgentTask(BaseModel):
    id: str
    title: str
    due_date: str | None = None
    priority: str
    status: str


class AgendaTodayResponse(BaseModel):
    events: list[AgendaEvent]
    urgent_tasks: list[UrgentTask]
    date: str


# ── Dashboard ─────────────────────────────────────────────────────────────────

class JiraTicket(BaseModel):
    id: str
    title: str
    status: str
    priority: str


class DashboardSummaryResponse(BaseModel):
    today: dict
    school: dict
    work: dict


class DashboardTasksResponse(BaseModel):
    tasks: list[UrgentTask]


# ── Documents ─────────────────────────────────────────────────────────────────

class FileItem(BaseModel):
    id: str
    name: str
    path: str
    is_folder: bool
    size: int | None = None
    mime_type: str | None = None
    modified_at: str | None = None
    source: str = "onedrive_pro"


class DocumentTreeResponse(BaseModel):
    files: list[FileItem]


class SearchResultItem(BaseModel):
    filename: str
    content: str
    similarity: float
    page: int | None = None


class DocumentSearchResponse(BaseModel):
    results: list[SearchResultItem]
    query: str


# ── Révision ─────────────────────────────────────────────────────────────────

class RevisionRequest(BaseModel):
    mode: str = Field(..., pattern="^(flashcard|quiz)$")
    filename: str | None = None
    theme: str | None = None
    subfolder: str | None = None
    count: int = Field(default=5, ge=3, le=15)
    difficulty: str = Field(default="easy", pattern="^(easy|medium|hard)$")


class RevisionResponse(BaseModel):
    mode: str
    items: list[dict]
