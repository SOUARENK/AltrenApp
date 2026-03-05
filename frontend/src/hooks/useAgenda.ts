import { useState, useCallback } from 'react';
import { getAgendaEvents } from '../services/api';
import type { AgendaEvent } from '../types';

export function useAgenda() {
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async (start: string, end: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAgendaEvents(start, end);
      setEvents(data);
    } catch (err: any) {
      setError(err.message ?? 'Erreur lors du chargement de l\'agenda');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { events, isLoading, error, fetchEvents };
}
