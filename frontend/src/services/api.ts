import type {
  ChatResponse,
  UploadResponse,
  Conversation,
  AgendaEvent,
  TodaySummary,
  DashboardData,
  Task,
  FileItem,
  SearchResult,
  User,
  ChatMode,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8001';
const TIMEOUT_MS = 30_000;

let _token: string | null = null;

export function setToken(token: string | null) {
  _token = token;
}

function getHeaders(extra?: Record<string, string>): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  return headers;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: options.headers ?? getHeaders(),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.detail ?? body.message ?? `Erreur ${res.status}`);
      (err as any).status = res.status;
      throw err;
    }

    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Auth ────────────────────────────────────────────────────

export async function loginMicrosoft(): Promise<{ url: string }> {
  const res = await request<{ auth_url: string; state: string }>('/auth/login/microsoft', { method: 'POST', headers: getHeaders() });
  return { url: res.auth_url };
}

export async function loginGoogle(): Promise<{ url: string }> {
  const res = await request<{ auth_url: string; state: string }>('/auth/login/google', { method: 'POST', headers: getHeaders() });
  return { url: res.auth_url };
}

export async function getMe(): Promise<User> {
  const res = await request<any>('/auth/me');
  return { id: res.id, name: res.name, email: res.email };
}

export async function logout(): Promise<void> {
  await request<void>('/auth/logout', { method: 'POST', headers: getHeaders() });
  setToken(null);
}

// ── Chat ────────────────────────────────────────────────────

export async function sendQuestion(
  question: string,
  mode: ChatMode = 'general',
  conversationId?: string,
  precision: number = 2
): Promise<ChatResponse> {
  const res = await request<any>('/chat', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ question, mode, conversation_id: conversationId ?? null, precision }),
  });
  return {
    message: {
      id: res.message_id,
      role: 'assistant',
      content: res.answer,
      sources: (res.sources ?? []).map((s: any) => ({
        title: s.filename,
        excerpt: s.content,
        url: undefined,
      })),
      timestamp: new Date().toISOString(),
    },
    conversationId: res.conversation_id,
  };
}

export async function uploadPDF(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {};
    if (_token) headers['Authorization'] = `Bearer ${_token}`;
    const res = await fetch(`${BASE_URL}/chat/upload`, {
      method: 'POST', headers, body: formData, signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.detail ?? `Erreur ${res.status}`);
      (err as any).status = res.status;
      throw err;
    }
    const data = await res.json();
    return { success: true, filename: data.filename, chunks: data.chunks_count, message: data.message };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getChatHistory(): Promise<Conversation[]> {
  const res = await request<any>('/chat/history');
  return (res.conversations ?? []).map((c: any) => ({
    id: c.id,
    title: c.title,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    messages: [],
  }));
}

export async function deleteConversation(id: string): Promise<void> {
  await request<void>(`/chat/history/${id}`, { method: 'DELETE', headers: getHeaders() });
}

export async function getConversation(id: string): Promise<Conversation> {
  const res = await request<any>(`/chat/history/${id}`);
  return {
    id: res.id,
    title: res.title,
    createdAt: res.created_at,
    updatedAt: res.updated_at,
    messages: (res.messages ?? []).map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sources: m.sources ? m.sources.map((s: any) => ({ title: s.filename, excerpt: s.content })) : undefined,
      timestamp: m.created_at,
    })),
  };
}

// ── Agenda ──────────────────────────────────────────────────

export async function getAgendaEvents(start: string, end: string): Promise<AgendaEvent[]> {
  const res = await request<any>(`/agenda/events?start=${start}&end=${end}`);
  return (res.events ?? []).map((e: any) => ({
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end,
    source: e.source === 'ent' || e.source === 'google_calendar' ? 'ecole' : e.source === 'jira' ? 'perso' : 'entreprise',
    description: e.description,
    location: e.location,
  }));
}

export async function getAgendaToday(): Promise<TodaySummary> {
  const res = await request<any>('/agenda/today');
  const toEvent = (e: any): AgendaEvent => ({
    id: e.id, title: e.title, start: e.start, end: e.end,
    source: e.source === 'ent' ? 'ecole' : 'entreprise',
    description: e.description, location: e.location,
  });
  return {
    meetings: (res.events ?? []).filter((e: any) => e.source !== 'ent').map(toEvent),
    courses: (res.events ?? []).filter((e: any) => e.source === 'ent').map(toEvent),
    tasks: (res.urgent_tasks ?? []).map((t: any) => ({
      id: t.id, title: t.title, dueDate: t.due_date,
      priority: t.priority === 'high' ? 'urgent' : t.priority,
      status: t.status, source: 'jira' as const,
    })),
  };
}

// ── Dashboard ───────────────────────────────────────────────

export async function getDashboardSummary(): Promise<DashboardData> {
  const res = await request<any>('/dashboard/summary');
  const toEvent = (e: any): AgendaEvent => ({
    id: e.id, title: e.title, start: e.start, end: e.end,
    source: e.source === 'ent' ? 'ecole' : 'entreprise',
    description: e.description, location: e.location,
  });
  return {
    today: {
      meetings: (res.today?.events ?? []).filter((e: any) => e.source !== 'ent').map(toEvent),
      courses: (res.today?.events ?? []).filter((e: any) => e.source === 'ent').map(toEvent),
      tasks: [],
    },
    upcomingExams: (res.school?.next_exams ?? []).map((e: any, i: number) => ({
      id: `exam-${i}`, subject: e.title, date: e.date,
    })),
    recentGrades: [],
    jiraTickets: (res.work?.tickets ?? []).map((t: any) => ({
      id: t.id, key: t.id, title: t.title, status: t.status, priority: t.priority,
    })),
    upcomingDeadlines: [],
    weekView: (res.today?.events ?? []).map(toEvent),
  };
}

export async function getDashboardTasks(): Promise<Task[]> {
  const res = await request<any>('/dashboard/tasks');
  return (res.tasks ?? []).map((t: any) => ({
    id: t.id, title: t.title, dueDate: t.due_date,
    priority: t.priority === 'critical' ? 'urgent' : t.priority,
    status: t.status, source: 'jira' as const,
  }));
}

// ── Documents ───────────────────────────────────────────────

export async function getDocumentList(): Promise<any[]> {
  return request<any[]>('/documents');
}

export async function deleteDocument(filename: string): Promise<void> {
  await request<void>(`/documents/file?filename=${encodeURIComponent(filename)}`, { method: 'DELETE', headers: getHeaders() });
}

export async function moveDocument(filename: string, theme: string, subfolder: string | null): Promise<void> {
  await request<void>(`/documents/move?filename=${encodeURIComponent(filename)}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ theme, subfolder }),
  });
}

export async function ingestFile(file: File, theme?: string, subfolder?: string): Promise<{ filename: string; chunks: number }> {
  const form = new FormData();
  form.append('file', file);
  if (theme) form.append('theme', theme);
  if (subfolder) form.append('subfolder', subfolder);
  const headers: Record<string, string> = {};
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  const res = await fetch(`${BASE_URL}/ingest`, { method: 'POST', headers, body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Erreur ${res.status}`);
  }
  const data = await res.json();
  return { filename: data.filename, chunks: data.chunks_ingested };
}

export interface RevisionResult {
  mode: 'flashcard' | 'quiz';
  items: any[];
}

export async function generateRevision(params: {
  mode: 'flashcard' | 'quiz';
  filename?: string;
  theme?: string;
  subfolder?: string;
  count?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}): Promise<RevisionResult> {
  return request<RevisionResult>('/revision/generate', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(params),
  });
}

export async function getDocumentTree(path = '/'): Promise<FileItem[]> {
  const res = await request<any>(`/documents/tree?path=${encodeURIComponent(path)}`);
  return (res.files ?? []).map((f: any) => ({
    id: f.id, name: f.name, type: f.is_folder ? 'folder' : 'file',
    path: f.path, size: f.size, mimeType: f.mime_type,
    modifiedAt: f.modified_at,
    source: f.source === 'onedrive_perso' ? 'perso' : 'pro',
  }));
}

export async function searchDocuments(query: string): Promise<SearchResult[]> {
  const res = await request<any>(`/documents/search?q=${encodeURIComponent(query)}`);
  return (res.results ?? []).map((r: any, i: number) => ({
    id: `result-${i}`, filename: r.filename, excerpt: r.content,
    score: r.similarity, path: `/${r.filename}`,
  }));
}

// ── Outlook ───────────────────────────────────────────────────────────────

export interface OutlookStatus {
  connected: boolean;
  email?: string;
  last_sync?: string;
}

export async function getOutlookStatus(): Promise<OutlookStatus> {
  try { return await request<OutlookStatus>('/outlook/status'); }
  catch { return { connected: false }; }
}

export async function connectOutlookImap(email: string, password: string): Promise<{ message: string; email: string }> {
  return request('/outlook/connect', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ email, password }),
  });
}

export async function syncOutlook(): Promise<{ emails_count: number; events_count: number }> {
  return request('/outlook/sync', { method: 'POST', headers: getHeaders() });
}

export async function disconnectOutlook(): Promise<void> {
  return request('/outlook/disconnect', { method: 'DELETE', headers: getHeaders() });
}

// ── Connexions Email / Calendrier ─────────────────────────────────────────

export interface EmailConnection { id: string; connected: true; address: string; last_sync?: string }
export interface CalendarConnection { id: string; connected: true; label: string; last_sync?: string }
export interface ConnectionsStatus { email: EmailConnection[]; calendar: CalendarConnection[] }

export async function getConnectionsStatus(): Promise<ConnectionsStatus> {
  try { return await request<ConnectionsStatus>('/connect/status'); }
  catch { return { email: [], calendar: [] }; }
}

export async function connectEmail(email: string, password: string, imapServer?: string) {
  return request<{ id: string; email: string }>('/connect/email', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ email, password, imap_server: imapServer ?? null }),
  });
}

export async function connectCalendar(icsUrl: string) {
  return request<{ id: string }>('/connect/calendar', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ ics_url: icsUrl }),
  });
}

export async function syncEmail() {
  return request<{ count: number; chunks_inserted: number }>('/connect/sync/email', { method: 'POST', headers: getHeaders() });
}

export async function syncCalendar() {
  return request<{ count: number; chunks_inserted: number }>('/connect/sync/calendar', { method: 'POST', headers: getHeaders() });
}

export async function disconnectEmail(id: string) {
  return request<void>(`/connect/email/${id}`, { method: 'DELETE', headers: getHeaders() });
}

export async function disconnectCalendar(id: string) {
  return request<void>(`/connect/calendar/${id}`, { method: 'DELETE', headers: getHeaders() });
}
