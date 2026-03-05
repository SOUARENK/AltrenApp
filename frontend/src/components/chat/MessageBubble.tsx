import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../../types';
import { SourcesAccordion } from './SourcesAccordion';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
          style={
            isUser
              ? { backgroundColor: '#2563eb', color: 'white', borderBottomRightRadius: '4px', whiteSpace: 'pre-wrap' }
              : { backgroundColor: '#1f1f1f', color: '#f1f5f9', borderBottomLeftRadius: '4px' }
          }
        >
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1 text-white">{children}</h1>,
                h2: ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1 text-white">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1 text-slate-200">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
                li: ({ children }) => <li className="text-slate-200">{children}</li>,
                code: ({ inline, children }: any) =>
                  inline ? (
                    <code className="rounded px-1 py-0.5 text-xs font-mono" style={{ backgroundColor: '#0d0d0d', color: '#60a5fa' }}>
                      {children}
                    </code>
                  ) : (
                    <code className="block rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto mb-2" style={{ backgroundColor: '#0d0d0d', color: '#a5f3fc' }}>
                      {children}
                    </code>
                  ),
                pre: ({ children }) => <>{children}</>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 pl-3 my-2 italic text-slate-400" style={{ borderColor: '#2563eb' }}>
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto mb-2">
                    <table className="w-full text-xs border-collapse" style={{ borderColor: '#2a2a2a' }}>
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => <thead style={{ backgroundColor: '#0d0d0d' }}>{children}</thead>,
                tbody: ({ children }) => <tbody>{children}</tbody>,
                tr: ({ children }) => <tr style={{ borderBottom: '1px solid #2a2a2a' }}>{children}</tr>,
                th: ({ children }) => (
                  <th className="px-3 py-2 text-left font-semibold text-slate-300" style={{ border: '1px solid #2a2a2a' }}>
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2 text-slate-300" style={{ border: '1px solid #2a2a2a' }}>
                    {children}
                  </td>
                ),
                hr: () => <hr className="my-3" style={{ borderColor: '#2a2a2a' }} />,
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80" style={{ color: '#60a5fa' }}>
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="px-1 mt-1 w-full">
            <SourcesAccordion sources={message.sources} />
          </div>
        )}

        <span className="text-xs mt-1 px-1" style={{ color: '#475569' }}>
          {new Date(message.timestamp).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}
