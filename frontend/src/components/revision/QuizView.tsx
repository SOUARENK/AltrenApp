import { useState } from 'react';
import { CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import type { QuizQuestion } from '../../types';

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
            backgroundColor: pct >= 60 ? '#052e16' : '#450a0a',
            color: pct >= 60 ? '#86efac' : '#fca5a5',
            border: `2px solid ${pct >= 60 ? '#166534' : '#7f1d1d'}`,
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
        <div className="flex-1 rounded-full h-1" style={{ backgroundColor: '#1f1f1f' }}>
          <div
            className="rounded-full h-1 transition-all"
            style={{ width: `${((current + 1) / questions.length) * 100}%`, backgroundColor: '#2563eb' }}
          />
        </div>
      </div>

      <p className="text-base font-medium text-slate-200 leading-relaxed">{question.question}</p>

      <div className="space-y-2">
        {question.options.map((opt, i) => {
          let bg = '#141414';
          let border = '#1f1f1f';
          let color = '#94a3b8';

          if (selected !== null) {
            if (i === question.correctIndex) { bg = '#052e16'; border = '#166534'; color = '#86efac'; }
            else if (i === selected) { bg = '#450a0a'; border = '#7f1d1d'; color = '#fca5a5'; }
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
                  style={{ backgroundColor: '#1f1f1f', color: '#64748b' }}
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
              style={{ backgroundColor: '#0f172a', color: '#93c5fd', border: '1px solid #1e3a5f' }}
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
