"use client";

import { useRef, useEffect, type KeyboardEvent, type ChangeEvent } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  precision: number;
  onPrecisionChange: (p: number) => void;
}

const MAX_LENGTH = 2000;

const PRECISION_OPTIONS = [
  { value: 1, label: "Concis" },
  { value: 2, label: "Normal" },
  { value: 3, label: "Détaillé" },
];

export default function ChatInput({ value, onChange, onSend, disabled = false, precision, onPrecisionChange }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize du textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) onSend();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    if (e.target.value.length <= MAX_LENGTH) {
      onChange(e.target.value);
    }
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="border-t border-zinc-800 px-4 py-4 bg-zinc-950">
      <div className="max-w-3xl mx-auto space-y-2">
        {/* Sélecteur de précision */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600">Précision :</span>
          <div className="flex gap-1">
            {PRECISION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onPrecisionChange(opt.value)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  precision === opt.value
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Barre de saisie */}
        <div className="flex items-end gap-2 bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 focus-within:border-zinc-500 transition-colors">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Posez votre question..."
            rows={1}
            disabled={disabled}
            className="flex-1 bg-transparent text-zinc-100 text-sm placeholder-zinc-600 resize-none outline-none leading-relaxed max-h-30 disabled:opacity-50"
          />

          {/* Compteur de caractères */}
          {value.length > MAX_LENGTH * 0.8 && (
            <span className={`text-xs self-end mb-0.5 ${value.length >= MAX_LENGTH ? "text-red-400" : "text-zinc-600"}`}>
              {value.length}/{MAX_LENGTH}
            </span>
          )}

          {/* Bouton envoyer */}
          <button
            onClick={onSend}
            disabled={!canSend}
            className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-30 hover:bg-blue-500 disabled:cursor-not-allowed"
            aria-label="Envoyer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>

        <p className="text-center text-xs text-zinc-700">
          Les réponses sont basées uniquement sur les documents indexés. Shift+Entrée pour sauter une ligne.
        </p>
      </div>
    </div>
  );
}
