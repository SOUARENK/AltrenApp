import { useState } from 'react';
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown } from 'lucide-react';
import type { FileItem } from '../../types';

interface FileNodeProps {
  item: FileItem;
  onSelect: (item: FileItem) => void;
  selectedId?: string;
}

function FileNode({ item, onSelect, selectedId }: FileNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const isFolder = item.type === 'folder';
  const isSelected = item.id === selectedId;

  const toggle = () => {
    if (isFolder) setExpanded(e => !e);
    else onSelect(item);
  };

  return (
    <div>
      <button
        onClick={toggle}
        className="flex items-center gap-2 w-full text-left rounded-lg px-2 py-1.5 text-sm transition-colors"
        style={{
          backgroundColor: isSelected ? 'rgba(37,99,235,0.15)' : 'transparent',
          color: isSelected ? '#93c5fd' : '#94a3b8',
        }}
      >
        {isFolder ? (
          <>
            {expanded ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
            {expanded ? <FolderOpen size={16} className="shrink-0 text-yellow-500" /> : <Folder size={16} className="shrink-0 text-yellow-500" />}
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            <FileText size={16} className="shrink-0 text-blue-400" />
          </>
        )}
        <span className="truncate">{item.name}</span>
        {item.size && !isFolder && (
          <span className="ml-auto text-xs text-slate-600 shrink-0">
            {formatSize(item.size)}
          </span>
        )}
      </button>
      {isFolder && expanded && item.children && (
        <div className="ml-4">
          {item.children.map(child => (
            <FileNode key={child.id} item={child} onSelect={onSelect} selectedId={selectedId} />
          ))}
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}Mo`;
}

interface FileTreeProps {
  items: FileItem[];
  onSelect: (item: FileItem) => void;
  selectedId?: string;
}

export function FileTree({ items, onSelect, selectedId }: FileTreeProps) {
  return (
    <div className="py-1">
      {items.length === 0 ? (
        <p className="text-xs text-slate-600 px-3 py-2">Aucun fichier</p>
      ) : (
        items.map(item => (
          <FileNode key={item.id} item={item} onSelect={onSelect} selectedId={selectedId} />
        ))
      )}
    </div>
  );
}
