import { AlertCircle, X } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorMessage({ message, onDismiss }: ErrorMessageProps) {
  return (
    <div
      className="flex items-start gap-3 rounded-lg p-3 text-sm"
      style={{ backgroundColor: '#1a0a0a', border: '1px solid #7f1d1d', color: '#fca5a5' }}
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 opacity-70 hover:opacity-100">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
