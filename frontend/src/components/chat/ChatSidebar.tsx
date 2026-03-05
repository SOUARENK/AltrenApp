import { useRef } from 'react';
import { Plus, Upload, MessageSquare, Trash2, FolderOpen } from 'lucide-react';
import type { Conversation, ChatMode } from '../../types';

const MODES: { value: ChatMode; label: string }[] = [
  { value: 'general', label: 'Général' },
  { value: 'entreprise', label: 'Entreprise' },
  { value: 'revision', label: 'Révision' },
  { value: 'redaction', label: 'Rédaction' },
];

function groupByDate(convs: Conversation[]): { label: string; items: Conversation[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86_400_000;
  const weekAgo = today - 7 * 86_400_000;

  const groups: Record<string, Conversation[]> = {
    "Aujourd'hui": [],
    'Hier': [],
    'Cette semaine': [],
    'Plus ancien': [],
  };

  for (const c of convs) {
    const d = new Date(c.updatedAt ?? c.createdAt);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (day >= today) groups["Aujourd'hui"].push(c);
    else if (day >= yesterday) groups['Hier'].push(c);
    else if (day >= weekAgo) groups['Cette semaine'].push(c);
    else groups['Plus ancien'].push(c);
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

interface ChatSidebarProps {
  history: Conversation[];
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onUpload: (file: File) => void;
  currentId?: string;
}

export function ChatSidebar({
  history,
  mode,
  onModeChange,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onUpload,
  currentId,
}: ChatSidebarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(f => onUpload(f));
    e.target.value = '';
  };

  const groups = groupByDate(history);

  return (
    <div
      className="flex flex-col h-full"
      style={{ width: '240px', borderRight: '1px solid var(--color-border)', backgroundColor: 'var(--color-card)' }}
    >
      {/* Header */}
      <div className="px-3 pt-4 pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <p className="text-xs font-semibold text-slate-400 tracking-wide mb-3">AlternApp</p>
        <button
          onClick={onNewChat}
          className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors text-white"
          style={{ backgroundColor: 'color-mix(in srgb, #2563eb 15%, var(--color-card))', border: '1px solid #2563eb33' }}
        >
          <Plus size={15} style={{ color: '#60a5fa' }} />
          Nouvelle conversation
        </button>
      </div>

      {/* Mode */}
      <div className="p-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Mode</p>
        <div className="grid grid-cols-2 gap-1">
          {MODES.map(m => (
            <button
              key={m.value}
              onClick={() => onModeChange(m.value)}
              className="rounded-md px-2 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: mode === m.value ? '#2563eb' : 'transparent',
                color: mode === m.value ? 'white' : '#64748b',
                border: `1px solid ${mode === m.value ? '#2563eb' : 'var(--color-border)'}`,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {history.length === 0 ? (
          <p className="text-xs text-slate-600 px-2 pt-4 text-center">
            Aucune conversation.<br />Posez une question pour commencer.
          </p>
        ) : (
          groups.map(({ label, items }) => (
            <div key={label} className="mb-3 mt-3">
              <p className="text-xs text-slate-600 px-2 mb-1">{label}</p>
              {items.map(conv => (
                <div
                  key={conv.id}
                  className="group flex items-center gap-1 rounded-lg px-2 py-2 transition-colors"
                  style={{ backgroundColor: currentId === conv.id ? 'var(--color-border)' : 'transparent' }}
                >
                  <button
                    onClick={() => onSelectConversation(conv.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left text-sm"
                    style={{ color: currentId === conv.id ? 'var(--color-text)' : '#64748b' }}
                  >
                    <MessageSquare size={13} className="shrink-0" />
                    <span className="truncate">{conv.title ?? 'Sans titre'}</span>
                  </button>
                  <button
                    onClick={() => onDeleteConversation(conv.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:text-red-400"
                    style={{ color: '#64748b' }}
                    title="Supprimer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Bottom actions */}
      <div className="px-2 py-3 space-y-1" style={{ borderTop: '1px solid var(--color-border)' }}>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors hover:bg-white/5"
        >
          <Upload size={14} /> Importer un fichier
        </button>
        <button
          onClick={() => folderRef.current?.click()}
          className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors hover:bg-white/5"
        >
          <FolderOpen size={14} /> Importer un dossier
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.pptx,.txt,.csv"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={folderRef}
          type="file"
          className="hidden"
          // @ts-ignore — webkitdirectory non-standard mais supporté par tous les navigateurs modernes
          webkitdirectory=""
          multiple
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
