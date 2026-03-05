import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AgendaEvent } from '../../types';
import { EventModal } from './EventModal';

const SOURCE_COLORS: Record<string, string> = {
  entreprise: '#2563eb',
  ecole: '#16a34a',
  perso: '#64748b',
};

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);
const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface CalendarViewProps {
  events: AgendaEvent[];
  onRangeChange: (start: string, end: string) => void;
}

export function CalendarView({ events, onRangeChange }: CalendarViewProps) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selected, setSelected] = useState<AgendaEvent | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const navigate = (dir: -1 | 1) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + dir * 7);
    setWeekStart(next);
    const end = new Date(next);
    end.setDate(end.getDate() + 6);
    onRangeChange(next.toISOString(), end.toISOString());
  };

  const eventsForDay = (day: Date) =>
    events.filter(ev => {
      const evDate = new Date(ev.start);
      return (
        evDate.getFullYear() === day.getFullYear() &&
        evDate.getMonth() === day.getMonth() &&
        evDate.getDate() === day.getDate()
      );
    });

  const today = new Date();

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-sm font-medium text-slate-300">
          {weekDays[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
          {' – '}
          {weekDays[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </h2>
        <button
          onClick={() => navigate(1)}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-8 mb-2">
            <div />
            {weekDays.map((day, i) => {
              const isToday =
                day.getDate() === today.getDate() &&
                day.getMonth() === today.getMonth() &&
                day.getFullYear() === today.getFullYear();
              return (
                <div key={i} className="text-center pb-2">
                  <p className="text-xs text-slate-500">{DAYS_SHORT[i]}</p>
                  <div
                    className={`mx-auto w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium ${
                      isToday ? 'text-white' : 'text-slate-300'
                    }`}
                    style={isToday ? { backgroundColor: '#2563eb' } : {}}
                  >
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-8">
            <div className="space-y-0">
              {HOURS.map(h => (
                <div
                  key={h}
                  className="text-right pr-2 text-xs text-slate-600"
                  style={{ height: '48px', lineHeight: '48px' }}
                >
                  {`${h}h`}
                </div>
              ))}
            </div>

            {weekDays.map((day, di) => (
              <div key={di} className="relative" style={{ borderLeft: '1px solid var(--color-border)' }}>
                {HOURS.map(h => (
                  <div
                    key={h}
                    style={{ height: '48px', borderBottom: '1px solid var(--color-card2)' }}
                  />
                ))}
                {eventsForDay(day).map(ev => {
                  const start = new Date(ev.start);
                  const end = new Date(ev.end);
                  const top = (start.getHours() - 7 + start.getMinutes() / 60) * 48;
                  const duration = (end.getTime() - start.getTime()) / 3600000;
                  const height = Math.max(duration * 48, 20);
                  return (
                    <button
                      key={ev.id}
                      onClick={() => setSelected(ev)}
                      className="absolute left-0.5 right-0.5 rounded text-left px-1 overflow-hidden text-xs"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: `${SOURCE_COLORS[ev.source]}33`,
                        borderLeft: `2px solid ${SOURCE_COLORS[ev.source]}`,
                        color: SOURCE_COLORS[ev.source],
                      }}
                    >
                      <p className="font-medium truncate">{ev.title}</p>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <EventModal event={selected} onClose={() => setSelected(null)} />
    </>
  );
}
