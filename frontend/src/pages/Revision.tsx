import { useState, useRef } from 'react';
import { Upload, FileText, Files } from 'lucide-react';
import { uploadPDF } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { FlashCard } from '../components/revision/FlashCard';
import { QuizView } from '../components/revision/QuizView';
import { ErrorMessage } from '../components/shared/ErrorMessage';
import type { FlashCard as FlashCardType, QuizQuestion } from '../types';

type Mode = 'home' | 'flashcards' | 'quiz';

function loadGenerated(): { mode: 'flashcard' | 'quiz'; items: any[] } | null {
  try {
    const raw = localStorage.getItem('revision_generated');
    if (!raw) return null;
    localStorage.removeItem('revision_generated');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function Revision() {
  const navigate = useNavigate();
  const generated = useRef(loadGenerated());

  const initialCards: FlashCardType[] = generated.current?.mode === 'flashcard'
    ? generated.current.items.map((it: any, i: number) => ({ id: String(i), question: it.question, answer: it.answer }))
    : [];

  const initialQuiz: QuizQuestion[] = generated.current?.mode === 'quiz'
    ? generated.current.items.map((it: any, i: number) => ({
        id: String(i), question: it.question, options: it.options,
        correctIndex: it.correctIndex, explanation: it.explanation,
      }))
    : [];

  const initialMode: Mode = generated.current?.mode === 'flashcard' ? 'flashcards'
    : generated.current?.mode === 'quiz' ? 'quiz' : 'home';

  const [mode, setMode] = useState<Mode>(initialMode);
  const [cards, setCards] = useState<FlashCardType[]>(initialCards);
  const [quiz] = useState<QuizQuestion[]>(initialQuiz);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      const res = await uploadPDF(file);
      setUploadMsg(`✅ ${res.filename} — ${res.chunks} fragments indexés`);
    } catch (err: any) {
      setError(err.message ?? 'Erreur lors de l\'upload');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleKnow = (id: string) => setCards(prev => prev.filter(c => c.id !== id));
  const handleReview = (id: string) => setCards(prev => {
    const card = prev.find(c => c.id === id)!;
    return [...prev.filter(c => c.id !== id), card];
  });

  if (mode === 'flashcards') {
    return (
      <div className="p-6" style={{ backgroundColor: 'var(--color-bg)', minHeight: '100%' }}>
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setMode('home')} className="text-slate-500 hover:text-white transition-colors text-sm">
            ← Retour
          </button>
          <h1 className="text-xl font-semibold text-white">Flashcards</h1>
          <span className="text-xs text-slate-500 ml-auto">{cards.length} carte{cards.length > 1 ? 's' : ''} restante{cards.length > 1 ? 's' : ''}</span>
        </div>
        {cards.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🎉</p>
            <p className="text-lg font-medium text-slate-200">Toutes les cartes maîtrisées !</p>
            <button onClick={() => setMode('home')} className="mt-4 text-sm text-blue-400 hover:text-blue-300">
              Retour à l'accueil
            </button>
          </div>
        ) : (
          <FlashCard card={cards[0]} onKnow={handleKnow} onReview={handleReview} />
        )}
      </div>
    );
  }

  if (mode === 'quiz') {
    return (
      <div className="p-6" style={{ backgroundColor: 'var(--color-bg)', minHeight: '100%' }}>
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setMode('home')} className="text-slate-500 hover:text-white transition-colors text-sm">
            ← Retour
          </button>
          <h1 className="text-xl font-semibold text-white">QCM</h1>
        </div>
        {quiz.length === 0 ? (
          <p className="text-slate-500 text-sm">Aucune question générée. Sélectionne un fichier depuis la page Fichiers.</p>
        ) : (
          <QuizView questions={quiz} onComplete={(score) => console.log('Score:', score)} />
        )}
      </div>
    );
  }

  return (
    <div className="p-6" style={{ backgroundColor: 'var(--color-bg)', minHeight: '100%' }}>
      <h1 className="text-xl font-semibold text-white mb-6">Mode Révision</h1>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}
      {uploadMsg && (
        <div className="rounded-lg px-4 py-3 text-sm mb-4" style={{ backgroundColor: 'var(--color-card2)', color: '#22c55e', border: '1px solid #166534' }}>
          {uploadMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => navigate('/files')}
          className="rounded-xl p-5 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ backgroundColor: 'var(--color-card)', border: '2px dashed #2563eb' }}
        >
          <Files size={24} className="mb-3" style={{ color: '#2563eb' }} />
          <h3 className="text-sm font-semibold text-slate-200">Générer depuis un fichier</h3>
          <p className="text-xs text-slate-500 mt-1">Clique sur 🧠 ou 📖 à côté d'un fichier</p>
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={isUploading}
          className="rounded-xl p-5 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ backgroundColor: 'var(--color-card)', border: '1px dashed var(--color-input-border)' }}
        >
          <Upload size={24} className="mb-3" style={{ color: '#d97706' }} />
          <h3 className="text-sm font-semibold text-slate-200">
            {isUploading ? 'Upload en cours…' : 'Importer un cours'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">PDF → indexé dans la base</p>
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
        </button>
      </div>

      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <FileText size={16} style={{ color: '#2563eb' }} />
          Comment générer des fiches ?
        </h3>
        <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
          <li>Va dans <strong className="text-slate-400">Fichiers</strong></li>
          <li>Passe la souris sur un fichier indexé</li>
          <li>Clique sur <strong className="text-slate-400">🧠 Flashcards</strong> ou <strong className="text-slate-400">📖 QCM</strong></li>
          <li>Tu seras redirigé automatiquement ici</li>
        </ol>
      </div>
    </div>
  );
}
