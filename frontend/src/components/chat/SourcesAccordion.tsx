import type { Source } from '../../types';
import { FileText, ExternalLink } from 'lucide-react';

interface SourcesAccordionProps {
  sources: Source[];
}

export function SourcesAccordion({ sources }: SourcesAccordionProps) {
  if (!sources.length) return null;

  return (
    <details className="mt-2 text-xs" style={{ color: '#64748b' }}>
      <summary
        className="cursor-pointer select-none hover:text-slate-300 transition-colors py-1"
        style={{ listStyle: 'none' }}
      >
        {sources.length} source{sources.length > 1 ? 's' : ''}
      </summary>
      <div className="mt-2 space-y-1.5 pl-2" style={{ borderLeft: '2px solid #1f1f1f' }}>
        {sources.map((src, i) => (
          <div key={i} className="flex items-start gap-2">
            <FileText size={12} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-slate-400 truncate">{src.title}</p>
              {src.excerpt && (
                <p className="text-slate-600 mt-0.5 line-clamp-2">{src.excerpt}</p>
              )}
              {src.url && (
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-500 hover:text-blue-400 mt-0.5"
                >
                  <ExternalLink size={10} />
                  <span>Ouvrir</span>
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
