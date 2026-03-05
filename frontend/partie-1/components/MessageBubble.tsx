"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/types";

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs rounded-xl px-4 py-2 max-w-lg text-center">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} mb-4`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
          isUser ? "bg-blue-600 text-white" : "bg-zinc-700 text-zinc-300"
        }`}
      >
        {isUser ? "U" : "AI"}
      </div>

      {/* Bulle */}
      <div className={`max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-blue-600 text-white rounded-br-sm"
              : "bg-zinc-800 text-zinc-100 rounded-bl-sm"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className="break-words min-w-0">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1 first:mt-0">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-sm font-bold mt-2 mb-1 first:mt-0">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h3>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5 pl-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5 pl-1">{children}</ol>,
                  li: ({ children }) => <li>{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                  em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
                  pre: ({ children }) => (
                    <pre className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs my-2 overflow-x-auto whitespace-pre-wrap">
                      {children}
                    </pre>
                  ),
                  code: ({ children, className }) => (
                    <code className={`font-mono text-xs ${className ? "" : "bg-zinc-900 rounded px-1 py-0.5"} ${className ?? ""}`}>
                      {children}
                    </code>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="min-w-full text-xs border-collapse">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-zinc-700">{children}</thead>,
                  th: ({ children }) => (
                    <th className="border border-zinc-600 px-2 py-1 text-left font-semibold whitespace-nowrap">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-zinc-600 px-2 py-1">{children}</td>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-zinc-500 pl-3 text-zinc-400 italic my-1">{children}</blockquote>
                  ),
                  hr: () => <hr className="border-zinc-600 my-2" />,
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">
                      {children}
                    </a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="w-full">
            <button
              onClick={() => setSourcesOpen(!sourcesOpen)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
            >
              <span>{sourcesOpen ? "▾" : "▸"}</span>
              <span>Sources ({message.sources.length})</span>
            </button>

            {sourcesOpen && (
              <div className="mt-1 space-y-1">
                {message.sources.map((src, i) => (
                  <div
                    key={i}
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-400"
                  >
                    <div className="flex items-center gap-2 mb-1 text-zinc-500">
                      <span className="font-medium text-zinc-300">{src.filename}</span>
                      <span>p.{src.page}</span>
                      <span className="ml-auto">{(src.similarity * 100).toFixed(0)}% similaire</span>
                    </div>
                    <p className="leading-relaxed">{src.excerpt}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-xs text-zinc-600" suppressHydrationWarning>
          {message.timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}
