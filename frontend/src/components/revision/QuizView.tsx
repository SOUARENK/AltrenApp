import { useState } from 'react';
import { CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import type { QuizQuestion } from '../../types';
import { incrementQuiz } from '../../utils/profileStats';

interface QuizViewProps {
  questions: QuizQuestion[];
  onComplete: (score: number) => void;
}

export function QuizView({ questions, onComplete }: QuizViewProps) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const question = questions[current];

  const handleSelect = (index: number) => {
    if (selected !== null) return;
    setSelected(index);
    if (index === question.correctIndex) setScore(s => s + 1);
  };

  const handleNext = () => {
    if (current + 1 >= questions.length) {
      setFinished(true);
      incrementQuiz();
      onComplete(score + (selected === question.correctIndex ? 0 : 0));
    } else {
      setCurrent(c => c + 1);
      setSelected(null);
    }
  };

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
          style={{
            backgroundColor: pct >= 60 ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
            color: pct >= 60 ? 'var(--color-success-text)' : 'var(--color-error-text)',
            border: `2px solid ${pct >= 60 ? 'var(--color-success-border)' : 'var(--color-error-border)'}`,
          }}
        >
          {pct}%
        </div>
        <div>
          <p className="text-xl font-semibold text-slate-200">{score}/{questions.length} correctes</p>
          <p className="text-sm text-slate-500 mt-1">
            {pct >= 80 ? 'Excellent travail !' : pct >= 60 ? 'Bien, continuez !' : 'À retravailler'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">
          Question {current + 1}/{questions.length}
        </span>
        <div className="flex-1 rounded-full h-1" style={{ backgroundColor: 'var(--color-input)' }}>
          <div
            className="rounded-full h-1 transition-all"
            style={{ width: `${((current + 1) / questions.length) * 100}%`, backgroundColor: '#2563eb' }}
          />
        </div>
      </div>

      <p className="text-base font-medium text-slate-200 leading-relaxed">{question.question}</p>

      <div className="space-y-2">
        {question.options.map((opt, i) => {
          let bg = 'var(--color-card)';
          let border = 'var(--color-border)';
          let color = 'var(--color-muted2)';

          if (selected !== null) {
            if (i === question.correctIndex) { bg = 'var(--color-success-bg)'; border = 'var(--color-success-border)'; color = 'var(--color-success-text)'; }
            else if (i === selected) { bg = 'var(--color-error-bg)'; border = 'var(--color-error-border)'; color = 'var(--color-error-text)'; }
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              className="flex items-center gap-3 w-full text-left rounded-xl px-4 py-3 text-sm transition-all"
              style={{ backgroundColor: bg, border: `1px solid ${border}`, color }}
            >
              {selected !== null && i === question.correctIndex && <CheckCircle size={16} className="shrink-0" />}
              {selected !== null && i === selected && i !== question.correctIndex && <XCircle size={16} className="shrink-0" />}
              {(selected === null || (i !== question.correctIndex && i !== selected)) && (
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                  style={{ backgroundColor: 'var(--color-input)', color: '#64748b' }}
                >
                  {String.fromCharCode(65 + i)}
                </span>
              )}
              {opt}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <div>
          {question.explanation && (
            <p
              className="text-xs rounded-lg px-3 py-2 mb-3"
              style={{ backgroundColor: 'var(--color-card)', color: '#93c5fd', border: '1px solid var(--color-border)' }}
            >
              {question.explanation}
            </p>
          )}
          <button
            onClick={handleNext}
            className="flex items-center gap-2 w-full justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#2563eb' }}
          >
            {current + 1 >= questions.length ? 'Voir les résultats' : 'Question suivante'}
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
