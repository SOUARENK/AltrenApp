import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardSummary, getDashboardTasks } from '../services/api';
import type { DashboardData, Task } from '../types';
import {
  MessageSquare, Calendar, FolderOpen, BookOpen,
  Clock, CheckCircle2, AlertCircle, Wifi, WifiOff,
  GripVertical, Plus, Trash2, X, Check,
} from 'lucide-react';

const TODAY = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

const QUICK_LINKS = [
  { to: '/chat', icon: MessageSquare, label: 'Chat IA', desc: 'Poser une question', color: '#2563eb' },
  { to: '/agenda', icon: Calendar, label: 'Agenda', desc: 'Voir la semaine', color: '#7c3aed' },
  { to: '/files', icon: FolderOpen, label: 'Fichiers', desc: 'Cours & documents', color: '#d97706' },
  { to: '/revision', icon: BookOpen, label: 'Révision', desc: 'Flashcards & QCM', color: '#16a34a' },
];

interface LocalTask { id: string; text: string; done: boolean; dueDate?: string; dueTime?: string; }

function isNearDeadline(dueDate?: string): boolean {
  if (!dueDate) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
  const diff = (due.getTime() - today.getTime()) / 86400000;
  return diff >= 0 && diff <= 1;
}

function formatTaskDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); }
  catch { return iso; }
}

function SkeletonLine({ w = 'w-full' }: { w?: string }) {
  return <div className={`h-4 rounded ${w} animate-pulse`} style={{ backgroundColor: 'var(--color-border)' }} />;
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
  const [localTasks, setLocalTasks] = useState<LocalTask[]>(() => {
    try { return JSON.parse(localStorage.getItem('dashboard_tasks') ?? '[]'); } catch { return []; }
  });
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');
  const dragSrcIdx = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem('dashboard_tasks', JSON.stringify(localTasks));
  }, [localTasks]);

  const addTask = () => {
    if (!newTaskText.trim()) return;
    const id = crypto.randomUUID();
    const task: LocalTask = { id, text: newTaskText.trim(), done: false, dueDate: newTaskDate || undefined, dueTime: newTaskTime || undefined };
    setLocalTasks(prev => [task, ...prev]);
    if (newTaskDate) {
      try {
        const stored = JSON.parse(localStorage.getItem('local_agenda_events') ?? '[]');
        const t = newTaskTime || '08:00';
        const [h, m] = t.split(':').map(Number);
        const endH = String(h + 1 < 24 ? h + 1 : 23).padStart(2, '0');
        stored.push({ id: `task-${id}`, title: `📋 ${newTaskText.trim()}`, start: `${newTaskDate}T${t}:00`, end: `${newTaskDate}T${endH}:${String(m).padStart(2,'0')}:00`, source: 'perso', description: 'Tâche depuis le tableau de bord' });
        localStorage.setItem('local_agenda_events', JSON.stringify(stored));
      } catch {}
    }
    setNewTaskText('');
    setNewTaskDate('');
    setNewTaskTime('');
    setAddingTask(false);
  };
  const toggleTask = (id: string) => setLocalTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const deleteTask = (id: string) => {
    setLocalTasks(prev => prev.filter(t => t.id !== id));
    try {
      const stored = JSON.parse(localStorage.getItem('local_agenda_events') ?? '[]');
      localStorage.setItem('local_agenda_events', JSON.stringify(stored.filter((e: any) => e.id !== `task-${id}`)));
    } catch {}
  };
  const handleDragStart = (idx: number) => { dragSrcIdx.current = idx; };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const src = dragSrcIdx.current;
    if (src === null || src === idx) return;
    setLocalTasks(prev => {
      const arr = [...prev];
      const [item] = arr.splice(src, 1);
      arr.splice(idx, 0, item);
      return arr;
    });
    dragSrcIdx.current = idx;
  };

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
    <div className="p-6 space-y-6" style={{ backgroundColor: 'var(--color-bg)', minHeight: '100%' }}>

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
            style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
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

      {/* 3 colonnes égales: Aujourd'hui | À faire | Prochains examens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* Col 1: Aujourd'hui */}
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
          <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <Clock size={15} style={{ color: '#2563eb' }} /> Aujourd'hui
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <SkeletonLine key={i} w={i === 2 ? 'w-4/5' : 'w-full'} />)}
            </div>
          ) : allTodayEvents.length === 0 ? (
            <EmptyState icon="📅" text="Aucun événement — connectez Outlook dans les paramètres" />
          ) : (
            <div className="space-y-2.5">
              {allTodayEvents.map((ev, i) => {
                const color = ev.source === 'ecole' ? '#16a34a' : '#2563eb';
                const tag = ev.source === 'ecole' ? 'École' : 'Entreprise';
                return (
                  <div key={ev.id ?? i} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-500 w-10 shrink-0">{formatEventTime(ev.start)}</span>
                    <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200 truncate">{ev.title}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${color}22`, color }}>{tag}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Col 2: À faire */}
        <div
          className="rounded-xl p-4 flex flex-col"
          style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', minHeight: '360px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <CheckCircle2 size={15} style={{ color: '#16a34a' }} /> À faire
            </h2>
            <button
              onClick={() => setAddingTask(v => !v)}
              className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:opacity-80"
              style={{ backgroundColor: '#16a34a22', border: '1px solid #16a34a55' }}
              title="Ajouter une tâche"
            >
              <Plus size={13} style={{ color: '#16a34a' }} />
            </button>
          </div>

          {/* Inline add form */}
          {addingTask && (
            <div
              className="mb-3 rounded-lg p-3 space-y-2"
              style={{ backgroundColor: 'var(--color-input)', border: '1px solid var(--color-input-border)' }}
            >
              <input
                autoFocus
                value={newTaskText}
                onChange={e => setNewTaskText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addTask();
                  if (e.key === 'Escape') { setAddingTask(false); setNewTaskText(''); setNewTaskDate(''); setNewTaskTime(''); }
                }}
                placeholder="Nouvelle tâche…"
                className="w-full bg-transparent text-sm outline-none"
                style={{ color: 'var(--color-text)' }}
              />
              <div className="space-y-1.5">
                <p className="text-xs" style={{ color: '#475569' }}>Date limite (optionnelle)</p>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={newTaskDate}
                    onChange={e => setNewTaskDate(e.target.value)}
                    className="flex-1 text-xs rounded px-2 py-1 outline-none"
                    style={{ colorScheme: 'dark', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text)' }}
                  />
                  <input
                    type="time"
                    value={newTaskTime}
                    onChange={e => setNewTaskTime(e.target.value)}
                    disabled={!newTaskDate}
                    className="w-24 text-xs rounded px-2 py-1 outline-none"
                    style={{ colorScheme: 'dark', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-input-border)', color: newTaskDate ? 'var(--color-text)' : '#475569', opacity: newTaskDate ? 1 : 0.4 }}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={addTask} className="text-xs font-medium px-2 py-1 rounded" style={{ color: '#16a34a', backgroundColor: '#16a34a22' }}>
                  Ajouter
                </button>
                <button
                  onClick={() => { setAddingTask(false); setNewTaskText(''); setNewTaskDate(''); setNewTaskTime(''); }}
                  className="text-xs px-2 py-1 rounded transition-colors hover:text-white"
                  style={{ color: '#64748b' }}
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Task list */}
          {loading ? (
            <div className="space-y-3 flex-1">
              {[1, 2, 3].map(i => <SkeletonLine key={i} w={i === 3 ? 'w-3/4' : 'w-full'} />)}
            </div>
          ) : localTasks.length === 0 && tasks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon="✅" text="Aucune tâche — clique sur + pour en ajouter" />
            </div>
          ) : (
            <div className="space-y-1 flex-1 overflow-y-auto">

              {/* Local tasks: interactive, draggable */}
              {localTasks.map((task, idx) => {
                const near = isNearDeadline(task.dueDate);
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDragEnd={() => { dragSrcIdx.current = null; }}
                    className="group flex items-start gap-2 rounded-lg px-2.5 py-2 transition-colors cursor-grab active:cursor-grabbing"
                    style={{ backgroundColor: near && !task.done ? '#7f1d1d22' : 'var(--color-input)', border: near && !task.done ? '1px solid #ef444433' : '1px solid transparent' }}
                  >
                    <GripVertical size={13} className="shrink-0 opacity-0 group-hover:opacity-30 transition-opacity mt-0.5" style={{ color: '#94a3b8' }} />
                    {/* Custom checkbox: 20% opacity when unchecked */}
                    <div
                      onClick={() => toggleTask(task.id)}
                      className="shrink-0 w-4 h-4 rounded cursor-pointer flex items-center justify-center mt-0.5 transition-all"
                      style={{
                        border: '1.5px solid #64748b',
                        backgroundColor: task.done ? '#16a34a' : 'transparent',
                        opacity: task.done ? 1 : 0.2,
                      }}
                    >
                      {task.done && <Check size={9} style={{ color: 'white' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span
                        className="text-sm select-none block"
                        style={{
                          color: near && !task.done ? '#fca5a5' : task.done ? '#64748b' : 'var(--color-text)',
                          textDecoration: task.done ? 'line-through' : 'none',
                        }}
                      >
                        {task.text}
                      </span>
                      {task.dueDate && (
                        <span className="text-xs" style={{ color: near && !task.done ? '#ef4444' : '#64748b' }}>
                          📅 {formatTaskDate(task.dueDate)}{task.dueTime ? ` à ${task.dueTime}` : ''}{near && !task.done ? ' — Bientôt !' : ''}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 mt-0.5"
                      style={{ color: '#64748b' }}
                      title="Supprimer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}

              {/* Separator */}
              {localTasks.length > 0 && tasks.length > 0 && (
                <div className="flex items-center gap-2 py-2">
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
                  <span className="text-xs" style={{ color: '#475569' }}>Agenda</span>
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
                </div>
              )}

              {/* Backend tasks (read-only) */}
              {tasks.slice(0, 5).map(task => {
                const urgent = task.priority === 'urgent' || task.priority === 'high';
                return (
                  <div key={task.id} className="flex items-start gap-2 rounded-lg px-2.5 py-2">
                    <div className="w-4 h-4 rounded border mt-0.5 shrink-0" style={{ borderColor: urgent ? '#ef4444' : 'var(--color-input-border)', opacity: 0.2 }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-200">{task.title}</p>
                      <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: urgent ? '#ef4444' : '#64748b' }}>
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

        {/* Col 3: Prochains examens */}
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
          <h2 className="text-sm font-semibold text-slate-200 mb-3">📅 Prochains examens</h2>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonLine key={i} />)}</div>
          ) : exams.length === 0 ? (
            <EmptyState icon="📖" text="Aucun examen — connectez votre ENT" />
          ) : (
            <div className="space-y-2">
              {exams.map((exam, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-300 truncate">{exam.subject}</span>
                  <span className="text-xs text-slate-500 shrink-0">{exam.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
