export interface Source {
  filename: string;
  page: number;
  similarity: number;
  excerpt: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  sources?: Source[];
}

export interface ChatApiResponse {
  answer: string;
  sources: Source[];
  chunks_found: number;
  conversation_id: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  created_at: string;
}

export interface ConversationDetail {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  messages: ConversationMessage[];
}

export interface OutlookStatus {
  connected: boolean;
  email?: string;
  last_sync?: string;
  mail_count?: number;
  event_count?: number;
}

export interface IngestApiResponse {
  success: boolean;
  chunks_ingested: number;
  filename: string;
  processing_time_ms: number;
  theme: string;
}

export interface IndexedFile {
  name: string;
  chunks: number;
  theme: string;
  subfolder?: string | null;
}

export const THEME_LABELS: Record<string, string> = {
  entreprise: "Entreprise",
  ecole: "École",
  administratif: "Administratif",
  partage: "Partagé",
};

export const THEME_KEYS = ["entreprise", "ecole", "administratif", "partage"] as const;
export type ThemeKey = typeof THEME_KEYS[number];

export const THEME_SUBFOLDERS: Record<string, string[]> = {
  entreprise: ["Projets", "Réunions & Comptes-rendus", "Livrables & Rapports", "Ressources techniques"],
  ecole: ["Cours par matière", "Devoirs & Rendus", "Examens & Révisions", "Rapport d'alternance"],
  administratif: ["Contrat alternance", "Candidatures écoles ingénieurs", "Documents personnels"],
  partage: ["Rapports d'alternance finaux"],
};
