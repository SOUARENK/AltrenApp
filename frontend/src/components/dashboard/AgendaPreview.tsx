import { Calendar } from 'lucide-react';
import type { AgendaEvent } from '../../types';
import { SkeletonLoader } from '../shared/SkeletonLoader';

const SOURCE_COLORS: Record<string, string> = {
  entreprise: '#2563eb',
  ecole: '#16a34a',
  perso: '#64748b',
};

const SOURCE_BG: Record<string, string> = {
  entreprise: 'rgba(37,99,235,0.15)',
  ecole: 'rgba(22,163,74,0.15)',
  perso: 'rgba(100,116,139,0.15)',
};

interface AgendaPreviewProps {
  events: AgendaEvent[];
  isLoading?: boolean;
}

export function AgendaPreview({ events, isLoading }: AgendaPreviewProps) {
  const upcoming = events
    .filter(e => new Date(e.start) >= new Date())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 4);

  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
    >
      <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <Calendar size={16} style={{ color: '#2563eb' }} />
        Prochains événements
      </h3>
      {isLoading ? (
        <SkeletonLoader lines={3} />
      ) : upcoming.length === 0 ? (
        <p className="text-xs text-slate-600">Aucun événement à venir</p>
      ) : (
        <div className="space-y-2">
          {upcoming.map(ev => (
            <div
              key={ev.id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5"
              style={{ backgroundColor: SOURCE_BG[ev.source] }}
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: SOURCE_COLORS[ev.source] }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-200 truncate">{ev.title}</p>
              </div>
              <span className="text-xs text-slate-500 shrink-0">
                {new Date(ev.start).toLocaleDateString('fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
