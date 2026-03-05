import { useState, useCallback } from 'react';
import { sendQuestion, uploadPDF, getChatHistory, getConversation, deleteConversation } from '../services/api';
import type { Message, Conversation, ChatMode, UploadResponse } from '../types';
import type { Precision } from '../components/chat/ChatInput';

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [history, setHistory] = useState<Conversation[]>([]);
  const [mode, setMode] = useState<ChatMode>('general');
  const [precision, setPrecision] = useState<Precision>(2);

  const send = useCallback(async (question: string) => {
    if (!question.trim() || isLoading) return;
    setError(null);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await sendQuestion(question, mode, conversationId, precision);
      setConversationId(res.conversationId);
      setMessages(prev => [...prev, res.message]);
    } catch (err: any) {
      setError(err.message ?? 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, mode, conversationId, precision]);

  const upload = useCallback(async (file: File): Promise<UploadResponse | null> => {
    setError(null);
    try {
      return await uploadPDF(file);
    } catch (err: any) {
      setError(err.message ?? 'Erreur lors de l\'upload');
      return null;
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const h = await getChatHistory();
      setHistory(h);
    } catch {
      // silencieux
    }
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    setError(null);
    try {
      const conv = await getConversation(id);
      setMessages(conv.messages);
      setConversationId(id);
    } catch (err: any) {
      setError(err.message ?? 'Impossible de charger la conversation');
    }
  }, []);

  const removeConversation = useCallback(async (id: string) => {
    try {
      await deleteConversation(id);
      // Mise à jour optimiste immédiate
      setHistory(prev => prev.filter(c => c.id !== id));
      // Re-sync depuis le serveur pour confirmer la suppression
      const fresh = await getChatHistory();
      setHistory(fresh);
      return true;
    } catch (err: any) {
      setError(err.message ?? 'Erreur lors de la suppression');
      return false;
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    mode,
    setMode,
    precision,
    setPrecision,
    send,
    upload,
    history,
    loadHistory,
    loadConversation,
    removeConversation,
    clearMessages,
  };
}
