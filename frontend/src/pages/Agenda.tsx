import { useEffect } from 'react';
import { useAgenda } from '../hooks/useAgenda';
import { CalendarView } from '../components/agenda/CalendarView';
import { ErrorMessage } from '../components/shared/ErrorMessage';

function getWeekRange(): [string, string] {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return [start.toISOString(), end.toISOString()];
}

export function Agenda() {
  const { events, isLoading, error, fetchEvents } = useAgenda();

  useEffect(() => {
    const [start, end] = getWeekRange();
    fetchEvents(start, end);
  }, [fetchEvents]);

  return (
    <div className="p-6" style={{ backgroundColor: 'var(--color-bg)', minHeight: '100%' }}>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-semibold text-white">Agenda</h1>
        <div className="flex items-center gap-3 ml-4 text-xs">
          {[
            { label: 'Entreprise', color: '#2563eb' },
            { label: 'École', color: '#16a34a' },
            { label: 'Personnel', color: '#64748b' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: '#2563eb',
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        >
          <CalendarView events={events} onRangeChange={fetchEvents} />
        </div>
      )}
    </div>
  );
}
