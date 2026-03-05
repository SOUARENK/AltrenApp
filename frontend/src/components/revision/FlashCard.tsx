import { useState } from 'react';
import { RotateCcw, Check, X } from 'lucide-react';
import type { FlashCard as FlashCardType } from '../../types';

interface FlashCardProps {
  card: FlashCardType;
  onKnow: (id: string) => void;
  onReview: (id: string) => void;
}

export function FlashCard({ card, onKnow, onReview }: FlashCardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className="w-full max-w-lg cursor-pointer select-none"
        style={{ perspective: '1000px' }}
        onClick={() => setFlipped(f => !f)}
      >
        <div
          className="relative w-full transition-transform duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            height: '240px',
          }}
        >
          <div
            className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-6 text-center"
            style={{
              backgroundColor: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              backfaceVisibility: 'hidden',
            }}
          >
            <p className="text-xs text-slate-500 mb-4 uppercase tracking-wider">Question</p>
            <p className="text-lg font-medium text-slate-200">{card.question}</p>
            <p className="text-xs text-slate-600 mt-4">Cliquez pour voir la réponse</p>
          </div>

          <div
            className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-6 text-center"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-accent) 12%, var(--color-card))',
              border: '1px solid color-mix(in srgb, var(--color-accent) 35%, var(--color-border))',
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <p className="text-xs mb-4 uppercase tracking-wider" style={{ color: 'var(--color-accent)' }}>Réponse</p>
            <p className="text-base leading-relaxed" style={{ color: 'var(--color-text)' }}>{card.answer}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => setFlipped(false)}
          className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
          title="Retourner"
        >
          <RotateCcw size={18} />
        </button>
        {flipped && (
          <>
            <button
              onClick={() => { setFlipped(false); onReview(card.id); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error-text)', border: '1px solid var(--color-error-border)' }}
            >
              <X size={16} />
              À revoir
            </button>
            <button
              onClick={() => { setFlipped(false); onKnow(card.id); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success-text)', border: '1px solid var(--color-success-border)' }}
            >
              <Check size={16} />
              Je sais
            </button>
          </>
        )}
      </div>
    </div>
  );
}
