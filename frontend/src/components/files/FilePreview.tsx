import { X, Download, ExternalLink } from 'lucide-react';
import type { FileItem } from '../../types';

interface FilePreviewProps {
  file: FileItem | null;
  onClose: () => void;
}

export function FilePreview({ file, onClose }: FilePreviewProps) {
  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-slate-600">Sélectionnez un fichier pour le prévisualiser</p>
      </div>
    );
  }

  const isPDF = file.mimeType === 'application/pdf';
  const isImage = file.mimeType?.startsWith('image/');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid #1f1f1f' }}
      >
        <h3 className="text-sm font-medium text-slate-300 truncate">{file.name}</h3>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          {file.path && (
            <a
              href={file.path}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Ouvrir"
            >
              <ExternalLink size={16} />
            </a>
          )}
          {file.path && (
            <a
              href={file.path}
              download={file.name}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Télécharger"
            >
              <Download size={16} />
            </a>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isPDF && file.path ? (
          <iframe
            src={file.path}
            className="w-full h-full rounded-lg"
            style={{ minHeight: '500px', border: '1px solid #1f1f1f' }}
            title={file.name}
          />
        ) : isImage && file.path ? (
          <img
            src={file.path}
            alt={file.name}
            className="max-w-full max-h-full rounded-lg mx-auto block"
            style={{ border: '1px solid #1f1f1f' }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <p className="text-slate-500 text-sm">Prévisualisation non disponible pour ce type de fichier</p>
            {file.path && (
              <a
                href={file.path}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white"
                style={{ backgroundColor: '#2563eb' }}
              >
                <ExternalLink size={14} />
                Ouvrir dans une nouvelle fenêtre
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
