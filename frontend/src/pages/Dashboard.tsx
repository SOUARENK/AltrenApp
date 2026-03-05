import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardSummary, getDashboardTasks } from '../services/api';
import type { DashboardData, Task } from '../types';
import {
  MessageSquare, Calendar, FolderOpen, BookOpen,
  Clock, CheckCircle2, AlertCircle, Wifi, WifiOff,
} from 'lucide-react';

const TODAY = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

const QUICK_LINKS = [
  { to: '/chat', icon: MessageSquare, label: 'Chat IA', desc: 'Poser une question', color: '#2563eb' },
  { to: '/agenda', icon: Calendar, label: 'Agenda', desc: 'Voir la semaine', color: '#7c3aed' },
  { to: '/files', icon: FolderOpen, label: 'Fichiers', desc: 'Cours & documents', color: '#d97706' },
  { to: '/revision', icon: BookOpen, label: 'Révision', desc: 'Flashcards & QCM', color: '#16a34a' },
];

function SkeletonLine({ w = 'w-full' }: { w?: string }) {
  return <div className={`h-4 rounded ${w} animate-pulse`} style={{ backgroundColor: '#1f1f1f' }} />;
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 gap-2">
      <span className="text-2xl opacity-40">{icon}</span>
      <p className="text-xs text-slate-600 text-center">{text}</p>
    </div>
  );
}

function formatEventTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  const [summary, setSummary] = useState<DashboardData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.allSettled([getDashboardSummary(), getDashboardTasks()])
      .then(([summaryRes, tasksRes]) => {
        if (!alive) return;
        if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
        if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const todayEvents = summary?.today?.meetings ?? [];
  const todayCourses = summary?.today?.courses ?? [];
  const allTodayEvents = [...todayEvents, ...todayCourses];
  const exams = summary?.upcomingExams ?? [];
  const outlookConnected = allTodayEvents.length > 0;

  return (
    <div className="p-6 space-y-6" style={{ backgroundColor: '#0d0d0d', minHeight: '100%' }}>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 capitalize">{TODAY}</p>
          <h1 className="text-2xl font-semibold text-white mt-0.5">
            {greeting}, {user?.name?.split(' ')[0]} 👋
          </h1>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          {loading ? (
            <span className="text-xs text-slate-600">Chargement…</span>
          ) : outlookConnected ? (
            <><Wifi size={13} style={{ color: '#16a34a' }} /><span className="text-xs text-slate-600">Connecté</span></>
          ) : (
            <><WifiOff size={13} style={{ color: '#64748b' }} /><span className="text-xs text-slate-600">Outlook non lié</span></>
          )}
        </div>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {QUICK_LINKS.map(({ to, icon: Icon, label, desc, color }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="rounded-xl p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: '#141414', border: '1px solid #1f1f1f' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
              style={{ backgroundColor: `${color}22` }}
            >
              <Icon size={16} style={{ color }} />
            </div>
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
          </button>
        ))}
      </div>

      {/* Today + Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Aujourd'hui */}
        <div className="rounded-xl p-4" style={{ backgroundColor: '#141414', border: '1px solid #1f1f1f' }}>
          <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <Clock size={15} style={{ color: '#2563eb' }} /> Aujourd'hui
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <SkeletonLine key={i} w={i === 2 ? 'w-4/5' : 'w-full'} />)}
            </div>
          ) : allTodayEvents.length === 0 ? (
            <EmptyState icon="📅" text="Aucun événement aujourd'hui — connectez Outlook dans les paramètres" />
          ) : (
            <div className="space-y-2.5">
              {allTodayEvents.map((ev, i) => {
                const color = ev.source === 'ecole' ? '#16a34a' : '#2563eb';
                const tag = ev.source === 'ecole' ? 'École' : 'Entreprise';
                return (
                  <div key={ev.id ?? i} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-500 w-10 shrink-0">
                      {formatEventTime(ev.start)}
                    </span>
                    <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200 truncate">{ev.title}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${color}22`, color }}>
                        {tag}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tâches */}
        <div className="rounded-xl p-4" style={{ backgroundColor: '#141414', border: '1px solid #1f1f1f' }}>
          <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <CheckCircle2 size={15} style={{ color: '#16a34a' }} /> À faire
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <SkeletonLine key={i} w={i === 3 ? 'w-3/4' : 'w-full'} />)}
            </div>
          ) : tasks.length === 0 ? (
            <EmptyState icon="✅" text="Aucune tâche en cours" />
          ) : (
            <div className="space-y-2.5">
              {tasks.slice(0, 5).map(task => {
                const urgent = task.priority === 'urgent' || task.priority === 'high';
                return (
                  <div key={task.id} className="flex items-start gap-3">
                    <div
                      className="w-4 h-4 rounded border mt-0.5 shrink-0"
                      style={{ borderColor: urgent ? '#ef4444' : '#2a2a2a' }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-200">{task.title}</p>
                      <p className="text-xs mt-0.5 flex items-center gap-1"
                        style={{ color: urgent ? '#ef4444' : '#64748b' }}>
                        {urgent && <AlertCircle size={11} />}
                        {task.dueDate ?? task.status}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Prochains examens */}
      <div className="rounded-xl p-4" style={{ backgroundColor: '#141414', border: '1px solid #1f1f1f' }}>
        <h2 className="text-sm font-semibold text-slate-200 mb-3">📅 Prochains examens</h2>
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonLine key={i} />)}</div>
        ) : exams.length === 0 ? (
          <EmptyState icon="📖" text="Aucun examen — connectez votre ENT pour synchroniser" />
        ) : (
          <div className="space-y-2">
            {exams.map((exam, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-slate-300">{exam.subject}</span>
                <span className="text-xs text-slate-500">{exam.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
