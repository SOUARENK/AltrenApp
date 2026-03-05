export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp: string;
}

export interface Source {
  title: string;
  url?: string;
  excerpt?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export type ChatMode = 'general' | 'entreprise' | 'revision' | 'redaction';

export interface ChatResponse {
  message: Message;
  conversationId: string;
}

export interface UploadResponse {
  success: boolean;
  filename: string;
  chunks: number;
  message: string;
}

export interface AgendaEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  source: 'entreprise' | 'ecole' | 'perso';
  description?: string;
  location?: string;
  allDay?: boolean;
}

export interface TodaySummary {
  meetings: AgendaEvent[];
  courses: AgendaEvent[];
  tasks: Task[];
}

export interface Task {
  id: string;
  title: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'done';
  source: 'jira' | 'school' | 'personal';
}

export interface DashboardData {
  today: TodaySummary;
  upcomingExams: Exam[];
  recentGrades: Grade[];
  jiraTickets: JiraTicket[];
  upcomingDeadlines: Deadline[];
  weekView: AgendaEvent[];
}

export interface Exam {
  id: string;
  subject: string;
  date: string;
  location?: string;
}

export interface Grade {
  id: string;
  subject: string;
  grade: number;
  maxGrade: number;
  date: string;
}

export interface JiraTicket {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
}

export interface Deadline {
  id: string;
  title: string;
  dueDate: string;
  source: 'jira' | 'school';
}

export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  size?: number;
  mimeType?: string;
  modifiedAt?: string;
  children?: FileItem[];
  source: 'pro' | 'perso';
}

export interface SearchResult {
  id: string;
  filename: string;
  excerpt: string;
  score: number;
  path: string;
}

export interface FlashCard {
  id: string;
  question: string;
  answer: string;
  nextReview?: string;
  interval?: number;
  easeFactor?: number;
  repetitions?: number;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}
