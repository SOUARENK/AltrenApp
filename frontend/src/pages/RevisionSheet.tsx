import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Printer } from 'lucide-react';

export function RevisionSheet() {
  const navigate = useNavigate();
  const [html, setHtml] = useState<string | null>(null);
  const [name, setName] = useState<string>('Fiche de révision');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('revision_sheet');
      if (stored) {
        setHtml(stored);
        localStorage.removeItem('revision_sheet');
        const match = stored.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (match) setName(match[1].trim());
      }
    } catch {
      setHtml(null);
    }
  }, []);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win || !html) return;
    win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${name}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 2rem;
      color: #1a1a1a;
      max-width: 900px;
      margin: 0 auto;
      line-height: 1.6;
    }
    h1 { margin-top: 0; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
    img { max-width: 100%; height: auto; }
    @media print {
      @page { margin: 1.5cm; size: A4; }
      body { padding: 0; }
    }
  </style>
</head>
<body>${html}</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  if (!html) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" style={{ backgroundColor: 'var(--color-bg)' }}>
        <p className="text-4xl">📄</p>
        <p className="text-slate-400 text-sm">Aucune fiche générée.</p>
        <button
          onClick={() => navigate('/files')}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          ← Aller dans Fichiers pour en générer une
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-6 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-card)' }}
      >
        <button
          onClick={() => navigate('/files')}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={15} />
          Fichiers
        </button>

        <div className="w-px h-4 mx-1" style={{ backgroundColor: 'var(--color-border)' }} />

        <h1 className="text-sm font-semibold text-slate-200 flex-1 truncate">{name}</h1>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors text-white"
          style={{ backgroundColor: '#2563eb' }}
          title="Ouvrir le dialogue d'impression / export PDF"
        >
          <Printer size={13} />
          Imprimer / PDF
        </button>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          style={{ backgroundColor: 'var(--color-input)', border: '1px solid var(--color-input-border)', color: 'var(--color-text)' }}
          title="Exporter en PDF"
        >
          <Download size={13} />
          Exporter
        </button>
      </div>

      {/* Sheet content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto my-8 px-6">
          <div
            ref={containerRef}
            className="rounded-2xl overflow-hidden shadow-xl"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--color-border)',
              padding: '2rem',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              fontSize: '14px',
              lineHeight: '1.7',
              color: '#1a1a1a',
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}
