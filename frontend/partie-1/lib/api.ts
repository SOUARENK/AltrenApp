import type {
  ChatApiResponse,
  Conversation,
  ConversationDetail,
  IndexedFile,
  IngestApiResponse,
  OutlookStatus,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function sendQuestion(
  question: string,
  precision: number = 2,
  conversationId?: string | null
): Promise<ChatApiResponse> {
  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, precision, conversation_id: conversationId ?? null }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail ?? `Erreur serveur (${res.status})`);
  }

  return res.json() as Promise<ChatApiResponse>;
}

export async function getDocuments(): Promise<IndexedFile[]> {
  const res = await fetch(`${API_URL}/documents`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  return res.json() as Promise<IndexedFile[]>;
}

export async function uploadFile(file: File, theme?: string, subfolder?: string): Promise<IngestApiResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (theme) formData.append("theme", theme);
  if (subfolder) formData.append("subfolder", subfolder);

  const res = await fetch(`${API_URL}/ingest`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail ?? `Erreur upload (${res.status})`);
  }

  return res.json() as Promise<IngestApiResponse>;
}

// Compatibilité avec l'ancien nom
export const uploadPdf = uploadFile;

export async function deleteFile(filename: string): Promise<void> {
  const res = await fetch(`${API_URL}/documents/${encodeURIComponent(filename)}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail ?? `Erreur suppression (${res.status})`);
  }
}

export async function moveFile(
  filename: string,
  theme: string | null,
  subfolder: string | null
): Promise<void> {
  const res = await fetch(`${API_URL}/documents/${encodeURIComponent(filename)}/move`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme, subfolder }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail ?? `Erreur déplacement (${res.status})`);
  }
}

export async function getConversations(): Promise<Conversation[]> {
  const res = await fetch(`${API_URL}/chat/history`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  return res.json() as Promise<Conversation[]>;
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  const res = await fetch(`${API_URL}/chat/history/${id}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail ?? `Erreur (${res.status})`);
  }
  return res.json() as Promise<ConversationDetail>;
}

export async function getOutlookStatus(): Promise<OutlookStatus> {
  const res = await fetch(`${API_URL}/outlook/status`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return { connected: false };
  return res.json() as Promise<OutlookStatus>;
}

export async function syncOutlook(): Promise<{ mail_count: number; event_count: number; chunks_inserted: number }> {
  const res = await fetch(`${API_URL}/outlook/sync`, {
    method: "POST",
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail ?? `Erreur sync (${res.status})`);
  }
  return res.json();
}

export function getOutlookAuthUrl(): string {
  return `${API_URL}/auth/outlook`;
}

// ---------------------------------------------------------------------------
// Connexions directes Email + Calendrier
// ---------------------------------------------------------------------------

export interface EmailConnection {
  id: string;
  connected: true;
  address: string;
  last_sync?: string;
}

export interface CalendarConnection {
  id: string;
  connected: true;
  label: string;
  last_sync?: string;
}

export interface ConnectionsStatus {
  email: EmailConnection[];
  calendar: CalendarConnection[];
}

export async function getConnectionsStatus(): Promise<ConnectionsStatus> {
  try {
    const res = await fetch(`${API_URL}/connect/status`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { email: [], calendar: [] };
    return res.json() as Promise<ConnectionsStatus>;
  } catch {
    return { email: [], calendar: [] };
  }
}

export async function connectEmail(
  email: string,
  password: string,
  imapServer?: string
): Promise<{ id: string; email: string }> {
  const res = await fetch(`${API_URL}/connect/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, imap_server: imapServer ?? null }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? `Erreur (${res.status})`);
  }
  return res.json();
}

export async function connectCalendar(icsUrl: string): Promise<{ id: string }> {
  const res = await fetch(`${API_URL}/connect/calendar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ics_url: icsUrl }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? `Erreur (${res.status})`);
  }
  return res.json();
}

export async function syncEmail(): Promise<{ count: number; chunks_inserted: number }> {
  const res = await fetch(`${API_URL}/connect/sync/email`, { method: "POST", signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? `Erreur (${res.status})`);
  }
  return res.json();
}

export async function syncCalendar(): Promise<{ count: number; chunks_inserted: number }> {
  const res = await fetch(`${API_URL}/connect/sync/calendar`, { method: "POST", signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? `Erreur (${res.status})`);
  }
  return res.json();
}

export async function disconnectEmail(id: string): Promise<void> {
  await fetch(`${API_URL}/connect/email/${id}`, { method: "DELETE", signal: AbortSignal.timeout(10_000) });
}

export async function disconnectCalendar(id: string): Promise<void> {
  await fetch(`${API_URL}/connect/calendar/${id}`, { method: "DELETE", signal: AbortSignal.timeout(10_000) });
}
