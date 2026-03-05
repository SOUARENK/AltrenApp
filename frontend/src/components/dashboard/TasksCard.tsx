import { CheckSquare } from 'lucide-react';
import type { Task } from '../../types';
import { SkeletonLoader } from '../shared/SkeletonLoader';

const PRIORITY_COLORS: Record<Task['priority'], string> = {
  low: '#64748b',
  medium: '#d97706',
  high: '#ef4444',
  urgent: '#dc2626',
};

const PRIORITY_LABELS: Record<Task['priority'], string> = {
  low: 'Faible',
  medium: 'Moyen',
  high: 'Élevé',
  urgent: 'Urgent',
};

interface TasksCardProps {
  tasks: Task[];
  isLoading?: boolean;
}

export function TasksCard({ tasks, isLoading }: TasksCardProps) {
  const urgent = tasks.filter(t => t.priority === 'urgent' || t.priority === 'high');

  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
    >
      <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <CheckSquare size={16} style={{ color: '#2563eb' }} />
        Tâches urgentes
        {!isLoading && urgent.length > 0 && (
          <span
            className="ml-auto text-xs rounded-full px-2 py-0.5"
            style={{ backgroundColor: 'var(--color-error-border)', color: 'var(--color-error-text)' }}
          >
            {urgent.length}
          </span>
        )}
      </h3>
      {isLoading ? (
        <SkeletonLoader lines={4} />
      ) : urgent.length === 0 ? (
        <p className="text-xs text-slate-600">Aucune tâche urgente</p>
      ) : (
        <div className="space-y-2">
          {urgent.slice(0, 5).map(task => (
            <div key={task.id} className="flex items-start gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-200 truncate">{task.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs" style={{ color: PRIORITY_COLORS[task.priority] }}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                  {task.dueDate && (
                    <span className="text-xs text-slate-600">
                      {new Date(task.dueDate).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
