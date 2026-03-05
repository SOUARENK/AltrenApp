import { X, MapPin, Clock } from 'lucide-react';
import type { AgendaEvent } from '../../types';

const SOURCE_LABELS: Record<string, string> = {
  entreprise: 'Entreprise',
  ecole: 'École',
  perso: 'Personnel',
};

const SOURCE_COLORS: Record<string, string> = {
  entreprise: '#2563eb',
  ecole: '#16a34a',
  perso: '#64748b',
};

interface EventModalProps {
  event: AgendaEvent | null;
  onClose: () => void;
}

export function EventModal({ event, onClose }: EventModalProps) {
  if (!event) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 relative"
        style={{ backgroundColor: '#141414', border: '1px solid #1f1f1f' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <div
            className="text-xs font-medium rounded-full px-2 py-0.5"
            style={{
              backgroundColor: `${SOURCE_COLORS[event.source]}22`,
              color: SOURCE_COLORS[event.source],
            }}
          >
            {SOURCE_LABELS[event.source]}
          </div>
        </div>

        <h2 className="text-lg font-semibold text-white mt-2 mb-4">{event.title}</h2>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3 text-slate-400">
            <Clock size={16} className="shrink-0" />
            <span>
              {new Date(event.start).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
              {!event.allDay && (
                <>
                  {' · '}
                  {new Date(event.start).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' – '}
                  {new Date(event.end).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </>
              )}
            </span>
          </div>

          {event.location && (
            <div className="flex items-center gap-3 text-slate-400">
              <MapPin size={16} className="shrink-0" />
              <span>{event.location}</span>
            </div>
          )}

          {event.description && (
            <p className="text-slate-400 leading-relaxed mt-3 pt-3" style={{ borderTop: '1px solid #1f1f1f' }}>
              {event.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
