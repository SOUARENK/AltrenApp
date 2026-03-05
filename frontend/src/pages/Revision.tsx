import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Brain, FileText, Trash2, Eye, Trophy, FolderOpen,
  ChevronRight, CheckCircle2, XCircle,
} from 'lucide-react';
import { FlashCard } from '../components/revision/FlashCard';
import { QuizView } from '../components/revision/QuizView';
import type { FlashCard as FlashCardType, QuizQuestion } from '../types';

/* ─── Persistent types ─────────────────────────────────────────────────── */
interface SavedSheet { id: string; name: string; filename: string; createdAt: string; }
interface QuizResult { id: string; filename: string; score: number; total: number; createdAt: string; }

/* ─── Helpers ───────────────────────────────────────────────────────────── */
function loadGenerated(): { mode: 'flashcard' | 'quiz'; items: any[]; filename?: string } | null {
  try {
    const raw = localStorage.getItem('revision_generated');
    if (!raw) return null;
    localStorage.removeItem('revision_generated');
    return JSON.parse(raw);
  } catch { return null; }
}

function loadSheets(): SavedSheet[] {
  try {
    const raw = JSON.parse(localStorage.getItem('revision_sheets') ?? '[]') as any[];
    return raw.map(({ id, name, filename, createdAt }) => ({ id, name, filename, createdAt }));
  } catch { return []; }
}

function loadResults(): QuizResult[] {
  try { return JSON.parse(localStorage.getItem('revision_quiz_results') ?? '[]'); }
  catch { return []; }
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
}

function pctColor(pct: number) {
  if (pct >= 80) return { bg: '#14532d33', border: '#16a34a55', text: '#4ade80' };
  if (pct >= 60) return { bg: '#78350f33', border: '#d9770655', text: '#fb923c' };
  return { bg: '#7f1d1d33', border: '#ef444455', text: '#f87171' };
}

/* ─── Component ─────────────────────────────────────────────────────────── */
type View = 'hub' | 'flashcards' | 'quiz';

export function Revision() {
  const navigate = useNavigate();
  const generated = useRef(loadGenerated());

  /* Inline flashcard / quiz state */
  const initialCards: FlashCardType[] = generated.current?.mode === 'flashcard'
    ? generated.current.items.map((it: any, i: number) => ({ id: String(i), question: it.question, answer: it.answer }))
    : [];
  const initialQuiz: QuizQuestion[] = generated.current?.mode === 'quiz'
    ? generated.current.items.map((it: any, i: number) => ({
        id: String(i), question: it.question, options: it.options,
        correctIndex: it.correctIndex, explanation: it.explanation,
      }))
    : [];
  const sourceFilename = generated.current?.filename ?? 'Document';
  const initialView: View = generated.current?.mode === 'flashcard' ? 'flashcards'
    : generated.current?.mode === 'quiz' ? 'quiz' : 'hub';

  const [view, setView] = useState<View>(initialView);
  const [cards, setCards] = useState<FlashCardType[]>(initialCards);

  /* Persistent hub data */
  const [savedSheets, setSavedSheets] = useState<SavedSheet[]>(loadSheets);
  const [quizResults, setQuizResults] = useState<QuizResult[]>(loadResults);

  /* ── Flashcard handlers ── */
  const handleKnow = (id: string) => setCards(prev => prev.filter(c => c.id !== id));
  const handleReview = (id: string) => setCards(prev => {
    const card = prev.find(c => c.id === id)!;
    return [...prev.filter(c => c.id !== id), card];
  });

  /* ── Quiz completion ── */
  const handleQuizComplete = (score: number) => {
    const result: QuizResult = {
      id: crypto.randomUUID(),
      filename: sourceFilename,
      score,
      total: initialQuiz.length,
      createdAt: new Date().toISOString(),
    };
    const updated = [result, ...quizResults];
    setQuizResults(updated);
    localStorage.setItem('revision_quiz_results', JSON.stringify(updated));
  };

  /* ── Delete helpers ── */
  const deleteSheet = (id: string) => {
    const full = JSON.parse(localStorage.getItem('revision_sheets') ?? '[]');
    const next = full.filter((s: any) => s.id !== id);
    localStorage.setItem('revision_sheets', JSON.stringify(next));
    setSavedSheets(prev => prev.filter(s => s.id !== id));
  };
  const deleteResult = (id: string) => {
    const next = quizResults.filter(r => r.id !== id);
    setQuizResults(next);
    localStorage.setItem('revision_quiz_results', JSON.stringify(next));
  };

  /* ── View a saved sheet ── */
  const openSheet = (id: string) => {
    localStorage.setItem('revision_sheet_current_id', id);
    navigate('/revision/sheet');
  };

  /* ════════════════════ FLASHCARDS VIEW ════════════════════ */
  if (view === 'flashcards') {
    return (
      <div className="p-6" style={{ backgroundColor: 'var(--color-bg)', minHeight: '100%' }}>
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setView('hub')} className="text-slate-500 hover:text-white transition-colors text-sm">
            ← Retour
          </button>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Brain size={20} style={{ color: '#7c3aed' }} /> Flashcards
          </h1>
          <span className="text-xs text-slate-500 ml-auto">{cards.length} carte{cards.length !== 1 ? 's' : ''} restante{cards.length !== 1 ? 's' : ''}</span>
        </div>
        {cards.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🎉</p>
            <p className="text-lg font-medium text-slate-200">Toutes les cartes maîtrisées !</p>
            <button onClick={() => setView('hub')} className="mt-4 text-sm text-blue-400 hover:text-blue-300">
              Retour à la Révision
            </button>
          </div>
        ) : (
          <FlashCard card={cards[0]} onKnow={handleKnow} onReview={handleReview} />
        )}
      </div>
    );
  }

  /* ════════════════════ QUIZ VIEW ════════════════════ */
  if (view === 'quiz') {
    return (
      <div className="p-6" style={{ backgroundColor: 'var(--color-bg)', minHeight: '100%' }}>
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setView('hub')} className="text-slate-500 hover:text-white transition-colors text-sm">
            ← Retour
          </button>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Trophy size={20} style={{ color: '#d97706' }} /> QCM
          </h1>
          {sourceFilename && (
            <span className="text-xs text-slate-500 ml-auto flex items-center gap-1">
              <FileText size={12} /> {sourceFilename}
            </span>
          )}
        </div>
        {initialQuiz.length === 0 ? (
          <p className="text-slate-500 text-sm">Aucune question générée. Génère un QCM depuis la page Fichiers.</p>
        ) : (
          <QuizView questions={initialQuiz} onComplete={handleQuizComplete} />
        )}
      </div>
    );
  }

  /* ════════════════════ HUB VIEW ════════════════════ */
  return (
    <div className="p-6 space-y-8" style={{ backgroundColor: 'var(--color-bg)', minHeight: '100%' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <BookOpen size={22} style={{ color: '#16a34a' }} /> Révision
          </h1>
          <p className="text-xs text-slate-500 mt-1">Fiches générées, résultats QCM et flashcards</p>
        </div>
        <button
          onClick={() => navigate('/files')}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ backgroundColor: '#16a34a22', border: '1px solid #16a34a55', color: '#4ade80' }}
        >
          <FolderOpen size={15} />
          Générer depuis Fichiers
          <ChevronRight size={14} />
        </button>
      </div>

      {/* ── Fiches de révision ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <FileText size={16} style={{ color: '#2563eb' }} />
          <h2 className="text-sm font-semibold text-slate-200">Fiches de révision</h2>
          {savedSheets.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#2563eb22', color: '#60a5fa' }}>
              {savedSheets.length}
            </span>
          )}
        </div>

        {savedSheets.length === 0 ? (
          <div
            className="rounded-xl p-8 flex flex-col items-center gap-3 text-center"
            style={{ backgroundColor: 'var(--color-card)', border: '1px dashed var(--color-border)' }}
          >
            <FileText size={28} className="opacity-20" style={{ color: '#60a5fa' }} />
            <p className="text-sm text-slate-500">Aucune fiche générée</p>
            <p className="text-xs text-slate-600">Génère une fiche depuis un fichier en cliquant sur 📖 dans la page Fichiers</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedSheets.map(sheet => (
              <div
                key={sheet.id}
                className="rounded-xl p-4 flex flex-col gap-3 group"
                style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#2563eb22' }}>
                    <FileText size={17} style={{ color: '#60a5fa' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-200 truncate">{sheet.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                      <FolderOpen size={10} /> {sheet.filename}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-600">{formatDate(sheet.createdAt)}</p>
                <div className="flex items-center gap-2 mt-auto">
                  <button
                    onClick={() => openSheet(sheet.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors"
                    style={{ backgroundColor: '#2563eb22', border: '1px solid #2563eb44', color: '#60a5fa' }}
                  >
                    <Eye size={13} /> Voir la fiche
                  </button>
                  <button
                    onClick={() => deleteSheet(sheet.id)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                    style={{ color: '#64748b' }}
                    title="Supprimer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Résultats QCM ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={16} style={{ color: '#d97706' }} />
          <h2 className="text-sm font-semibold text-slate-200">Résultats QCM</h2>
          {quizResults.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#d9770622', color: '#fb923c' }}>
              {quizResults.length}
            </span>
          )}
        </div>

        {quizResults.length === 0 ? (
          <div
            className="rounded-xl p-8 flex flex-col items-center gap-3 text-center"
            style={{ backgroundColor: 'var(--color-card)', border: '1px dashed var(--color-border)' }}
          >
            <Trophy size={28} className="opacity-20" style={{ color: '#fb923c' }} />
            <p className="text-sm text-slate-500">Aucun résultat QCM</p>
            <p className="text-xs text-slate-600">Génère un QCM depuis un fichier en cliquant sur 🧠 dans la page Fichiers</p>
          </div>
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
          >
            {quizResults.map((result, idx) => {
              const pct = Math.round((result.score / result.total) * 100);
              const c = pctColor(pct);
              return (
                <div
                  key={result.id}
                  className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-white/5"
                  style={{ borderTop: idx > 0 ? '1px solid var(--color-border)' : 'none' }}
                >
                  {/* Score badge */}
                  <div
                    className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 font-bold text-sm"
                    style={{ backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.text }}
                  >
                    {pct}%
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate flex items-center gap-1.5">
                      <FolderOpen size={12} className="shrink-0 opacity-60" />
                      {result.filename}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 size={11} style={{ color: '#4ade80' }} />
                        {result.score}/{result.total} correctes
                      </span>
                      <span>·</span>
                      <span>{pct >= 80 ? 'Excellent !' : pct >= 60 ? 'Bien' : 'À retravailler'}</span>
                    </p>
                  </div>

                  {/* Date */}
                  <span className="text-xs text-slate-600 shrink-0 hidden sm:block">{formatDate(result.createdAt)}</span>

                  {/* Result icon */}
                  {pct >= 60
                    ? <CheckCircle2 size={16} className="shrink-0" style={{ color: '#4ade80' }} />
                    : <XCircle size={16} className="shrink-0" style={{ color: '#f87171' }} />
                  }

                  {/* Delete */}
                  <button
                    onClick={() => deleteResult(result.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                    style={{ color: '#64748b' }}
                    title="Supprimer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
