import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

const MAX_CHARS = 2000;

export type Precision = 1 | 2 | 3;

const PRECISION_OPTIONS: { value: Precision; label: string }[] = [
  { value: 1, label: 'Concis' },
  { value: 2, label: 'Normal' },
  { value: 3, label: 'Détaillé' },
];

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  precision: Precision;
  onPrecisionChange: (p: Precision) => void;
}

export function ChatInput({ onSend, disabled = false, precision, onPrecisionChange }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (e.target.value.length <= MAX_CHARS) setValue(e.target.value);
  };

  const canSend = value.trim().length > 0 && !disabled;
  const charsLeft = MAX_CHARS - value.length;

  return (
    <div className="space-y-2">
      {/* Sélecteur de précision */}
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: '#475569' }}>Précision :</span>
        <div className="flex gap-1">
          {PRECISION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onPrecisionChange(opt.value)}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: precision === opt.value ? '#2563eb' : '#1f1f1f',
                color: precision === opt.value ? 'white' : '#64748b',
                border: `1px solid ${precision === opt.value ? '#2563eb' : '#2a2a2a'}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Zone de saisie */}
      <div
        className="flex items-end gap-2 rounded-2xl px-4 py-3 transition-colors"
        style={{ backgroundColor: '#1f1f1f', border: '1px solid #2a2a2a' }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Posez votre question…"
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-slate-600 text-slate-100"
          style={{ lineHeight: '1.5', maxHeight: '160px' }}
        />
        {charsLeft < 300 && (
          <span className="text-xs self-end mb-0.5" style={{ color: charsLeft < 100 ? '#ef4444' : '#475569' }}>
            {charsLeft}
          </span>
        )}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-opacity"
          style={{
            backgroundColor: '#2563eb',
            opacity: canSend ? 1 : 0.3,
            cursor: canSend ? 'pointer' : 'not-allowed',
          }}
          aria-label="Envoyer"
        >
          <Send size={14} color="white" />
        </button>
      </div>
      <p className="text-center text-xs" style={{ color: '#334155' }}>
        Réponses basées sur les documents indexés · Shift+Entrée pour aller à la ligne
      </p>
    </div>
  );
}
