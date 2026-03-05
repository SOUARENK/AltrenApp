import { Clock } from 'lucide-react';
import type { AgendaEvent } from '../../types';
import { SkeletonLoader } from '../shared/SkeletonLoader';

const SOURCE_COLORS: Record<string, string> = {
  entreprise: '#2563eb',
  ecole: '#16a34a',
  perso: '#64748b',
};

interface TodayCardProps {
  meetings: AgendaEvent[];
  courses: AgendaEvent[];
  isLoading?: boolean;
}

export function TodayCard({ meetings, courses, isLoading }: TodayCardProps) {
  const allEvents = [...meetings, ...courses].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
    >
      <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <Clock size={16} style={{ color: '#2563eb' }} />
        Aujourd'hui
      </h3>
      {isLoading ? (
        <SkeletonLoader lines={3} />
      ) : allEvents.length === 0 ? (
        <p className="text-xs text-slate-600">Aucun événement aujourd'hui</p>
      ) : (
        <div className="space-y-2">
          {allEvents.map(ev => (
            <div key={ev.id} className="flex items-start gap-2">
              <div
                className="w-1 rounded-full shrink-0 mt-1"
                style={{ height: '32px', backgroundColor: SOURCE_COLORS[ev.source] ?? '#64748b' }}
              />
              <div className="min-w-0">
                <p className="text-sm text-slate-200 truncate">{ev.title}</p>
                <p className="text-xs text-slate-500">
                  {new Date(ev.start).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' – '}
                  {new Date(ev.end).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
