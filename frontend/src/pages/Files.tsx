import { useEffect, useRef, useState } from 'react';
import { Search, Upload, FolderOpen, Plus, Trash2, MoveRight, X, RefreshCw, CheckSquare, Square, Brain, BookOpen, ExternalLink, MoreVertical, FileText } from 'lucide-react';
import { getDocumentList, deleteDocument, moveDocument, ingestFile, searchDocuments, generateRevision } from '../services/api';
import { incrementSheet } from '../utils/profileStats';
import { useNavigate } from 'react-router-dom';

const FILE_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8001') + '/uploads';

// ── Thèmes ───────────────────────────────────────────────────────────────────

export interface Theme {
  key: string;
  label: string;
  icon: string;
  color: string;
}

type ThemeKey = string;

const DEFAULT_THEMES: Theme[] = [
  { key: 'entreprise',    label: 'Entreprise',    icon: '🏭', color: '#2563eb' },
  { key: 'ecole',         label: 'École',          icon: '🎓', color: '#16a34a' },
  { key: 'administratif', label: 'Administratif',  icon: '📋', color: '#d97706' },
  { key: 'partage',       label: 'Partagé',        icon: '📊', color: '#7c3aed' },
];

const DEFAULT_SUBFOLDERS: Record<string, string[]> = {
  entreprise:    ['Rapports', 'Projets', 'Réunions', 'Formation', 'Contrats'],
  ecole:         ['Cours', 'TD', 'Examens', 'Projets scolaires'],
  administratif: ['RH', 'Paie', 'Congés', 'Contrats'],
  partage:       ['Équipe', 'Clients', 'Partenaires'],
};

const PRESET_COLORS = [
  '#2563eb', '#16a34a', '#d97706', '#7c3aed',
  '#dc2626', '#0891b2', '#db2777', '#65a30d',
  '#0f766e', '#9333ea', '#ca8a04', '#92400e',
];

interface IndexedFile  { name: string; chunks: number; theme: string; subfolder?: string | null; has_file?: boolean }
interface MoveDialog   { filename: string; theme: ThemeKey; subfolder: string }
interface SearchHit    { filename: string; excerpt: string; similarity: number }
interface ImportDialog { files: File[]; theme: ThemeKey; subfolder: string; uploading: boolean; progress: number }
interface BulkMoveState { theme: ThemeKey; subfolder: string; moving: boolean; progress: number }

// ── Composant principal ───────────────────────────────────────────────────────

export function Files() {
  const [files,           setFiles]           = useState<IndexedFile[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [busyFile,        setBusyFile]        = useState<string | null>(null);
  const [moveDialog,      setMoveDialog]      = useState<MoveDialog | null>(null);
  const [themes,          setThemes]          = useState<Theme[]>(() => {
    try { const s = JSON.parse(localStorage.getItem('custom_themes') ?? 'null'); if (s?.length) return s; } catch {}
    return DEFAULT_THEMES;
  });
  const [createThemeModal, setCreateThemeModal] = useState<{ name: string; color: string; icon: string } | null>(null);
  const [expandedThemes,  setExpandedThemes]  = useState<Set<string>>(new Set(DEFAULT_THEMES.map(t => t.key)));
  const [expandedSubs,    setExpandedSubs]    = useState<Set<string>>(new Set());
  const [customSubs,      setCustomSubs]      = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem('custom_subs') ?? '{}'); } catch { return {}; }
  });
  const [deletedSubs,     setDeletedSubs]     = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem('deleted_subs') ?? '{}'); } catch { return {}; }
  });
  const [addingSubFor,    setAddingSubFor]    = useState<string | null>(null);
  const [newSubName,      setNewSubName]      = useState('');
  const [searchQuery,     setSearchQuery]     = useState('');
  const [searchResults,   setSearchResults]   = useState<SearchHit[] | null>(null);
  const [searching,       setSearching]       = useState(false);
  const [uploadMsg,       setUploadMsg]       = useState<string | null>(null);
  const [error,           setError]           = useState<string | null>(null);
  const [importDialog,    setImportDialog]    = useState<ImportDialog | null>(null);
  const [multiSelect,     setMultiSelect]     = useState(false);
  const [selectedFiles,   setSelectedFiles]   = useState<Set<string>>(new Set());
  const [bulkMove,        setBulkMove]        = useState<BulkMoveState | null>(null);
  const [draggedFile,     setDraggedFile]     = useState<string | null>(null);
  const [dropTarget,      setDropTarget]      = useState<string | null>(null);

  const fileRef   = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const subInput  = useRef<HTMLInputElement>(null);
  const navigate  = useNavigate();

  // ── Chargement ──────────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDocumentList();
      setFiles(data);
    } catch (e: any) {
      setError(e.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { localStorage.setItem('custom_themes', JSON.stringify(themes)); }, [themes]);
  useEffect(() => { localStorage.setItem('custom_subs', JSON.stringify(customSubs)); }, [customSubs]);
  useEffect(() => { localStorage.setItem('deleted_subs', JSON.stringify(deletedSubs)); }, [deletedSubs]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleDelete = async (filename: string) => {
    if (!confirm(`Supprimer "${filename}" de la base ?`)) return;
    setBusyFile(filename);
    try {
      await deleteDocument(filename);
      setFiles(prev => prev.filter(f => f.name !== filename));
    } catch (e: any) {
      setError(e.message ?? 'Erreur de suppression');
    } finally {
      setBusyFile(null);
    }
  };

  const openMove = (file: IndexedFile) => {
    const theme = (themes.find((t: Theme) => t.key === file.theme) ? file.theme : (themes[0]?.key ?? 'entreprise')) as ThemeKey;
    const allSubs = getAllSubs(theme);
    setMoveDialog({
      filename: file.name,
      theme,
      subfolder: file.subfolder && allSubs.includes(file.subfolder) ? file.subfolder : allSubs[0] ?? '',
    });
  };

  const handleMove = async () => {
    if (!moveDialog) return;
    setBusyFile(moveDialog.filename);
    try {
      await moveDocument(moveDialog.filename, moveDialog.theme, moveDialog.subfolder || null);
      await load();
      setMoveDialog(null);
    } catch (e: any) {
      setError(e.message ?? 'Erreur de déplacement');
    } finally {
      setBusyFile(null);
    }
  };

  const toggleSelectFile = (name: string) =>
    setSelectedFiles(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });

  const exitMultiSelect = () => { setMultiSelect(false); setSelectedFiles(new Set()); setMoveDialog(null); };

  const openBulkMove = () => {
    if (selectedFiles.size === 0) return;
    const firstTheme = themes[0]?.key ?? 'entreprise';
    setBulkMove({ theme: firstTheme, subfolder: DEFAULT_SUBFOLDERS[firstTheme]?.[0] ?? '', moving: false, progress: 0 });
  };

  const handleCreateTheme = () => {
    if (!createThemeModal) return;
    const name = createThemeModal.name.trim();
    if (!name) return;
    const key = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!key || themes.some((t: Theme) => t.key === key)) return;
    const newTheme: Theme = { key, label: name, icon: createThemeModal.icon || '📁', color: createThemeModal.color };
    setThemes(prev => [...prev, newTheme]);
    setExpandedThemes(prev => new Set([...prev, key]));
    setCreateThemeModal(null);
  };

  const handleDeleteTheme = async (themeKey: string) => {
    const themeLabel = themes.find((t: Theme) => t.key === themeKey)?.label ?? themeKey;
    const themeFiles = files.filter(f => f.theme === themeKey);
    if (!confirm(`Supprimer le dossier « ${themeLabel} » et ses ${themeFiles.length} fichier(s) de la base ?`)) return;
    for (const f of themeFiles) { try { await deleteDocument(f.name); } catch {} }
    setFiles(prev => prev.filter(f => f.theme !== themeKey));
    setThemes(prev => prev.filter((t: Theme) => t.key !== themeKey));
    setCustomSubs(prev => { const n = { ...prev }; delete n[themeKey]; return n; });
    setUploadMsg(`✅ Dossier « ${themeLabel} » supprimé`);
    setTimeout(() => setUploadMsg(null), 4000);
  };

  const handleBulkMove = async () => {
    if (!bulkMove) return;
    const names = Array.from(selectedFiles);
    setBulkMove(prev => prev ? { ...prev, moving: true, progress: 0 } : null);
    let ok = 0;
    for (let i = 0; i < names.length; i++) {
      try {
        await moveDocument(names[i], bulkMove.theme, bulkMove.subfolder || null);
        ok++;
      } catch { }
      setBulkMove(prev => prev ? { ...prev, progress: Math.round(((i + 1) / names.length) * 100) } : null);
    }
    setBulkMove(null);
    setUploadMsg(`✅ ${ok}/${names.length} fichier(s) déplacé(s)`);
    setTimeout(() => setUploadMsg(null), 4000);
    exitMultiSelect();
    await load();
  };

  const handleDropToFolder = async (theme: string, sub: string, filename: string) => {
    const file = files.find(f => f.name === filename);
    if (file?.theme === theme && file?.subfolder === sub) return;
    setBusyFile(filename);
    try {
      await moveDocument(filename, theme, sub || null);
      await load();
      setUploadMsg(`✅ « ${filename} » déplacé vers ${theme} / ${sub}`);
      setTimeout(() => setUploadMsg(null), 3000);
    } catch (e: any) {
      setError(e.message ?? 'Erreur de déplacement');
    } finally {
      setBusyFile(null);
    }
  };

  const handleGenerateRevision = async (file: IndexedFile, mode: 'flashcard' | 'quiz' | 'summary') => {
    const label = mode === 'flashcard' ? 'Flashcards' : mode === 'quiz' ? 'QCM' : 'Fiche de révision';
    setUploadMsg(`⏳ Génération ${label} pour « ${file.name} »…`);
    try {
      const count = mode === 'summary' ? 15 : 10;
      const result = await generateRevision({ mode, filename: file.name, difficulty: 'medium', count });
      if (mode === 'summary') {
        const html = result.html ?? '';
        const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        const sheetName = titleMatch ? titleMatch[1].trim() : file.name;
        const sheet = { id: crypto.randomUUID(), name: sheetName, filename: file.name, html, createdAt: new Date().toISOString() };
        const sheets = JSON.parse(localStorage.getItem('revision_sheets') ?? '[]');
        sheets.unshift(sheet);
        localStorage.setItem('revision_sheets', JSON.stringify(sheets));
        localStorage.setItem('revision_sheet_current_id', sheet.id);
        incrementSheet();
        navigate('/revision/sheet');
      } else {
        localStorage.setItem('revision_generated', JSON.stringify({ ...result, filename: file.name }));
        navigate('/revision');
      }
    } catch (e: any) {
      setError(e.message ?? 'Erreur de génération');
      setUploadMsg(null);
    }
  };

  const handleDeleteFolder = async (theme: string, sub: string) => {
    const folderFiles = files.filter(f => f.theme === theme && f.subfolder === sub);
    if (!confirm(`Supprimer le dossier « ${sub} » et ses ${folderFiles.length} fichier(s) de la base ?`)) return;
    let ok = 0;
    for (const f of folderFiles) {
      try { await deleteDocument(f.name); ok++; } catch { }
    }
    setFiles(prev => prev.filter(f => !(f.theme === theme && f.subfolder === sub)));
    setCustomSubs(prev => ({ ...prev, [theme]: (prev[theme] ?? []).filter(s => s !== sub) }));
    setDeletedSubs(prev => ({ ...prev, [theme]: [...(prev[theme] ?? []), sub] }));
    setUploadMsg(`✅ Dossier « ${sub} » supprimé (${ok} fichier(s))`);
    setTimeout(() => setUploadMsg(null), 4000);
  };

  const handleGenerateFolderRevision = async (theme: string, sub: string, mode: 'flashcard' | 'quiz' | 'summary') => {
    const folderLabel = sub === '__other__' ? 'Non classé' : sub;
    const label = mode === 'flashcard' ? 'Flashcards' : mode === 'quiz' ? 'QCM' : 'Fiche de révision';
    setUploadMsg(`⏳ Génération ${label} pour le dossier « ${folderLabel} »…`);
    try {
      const count = mode === 'summary' ? 15 : 10;
      const result = await generateRevision({
        mode, theme,
        subfolder: sub === '__other__' ? undefined : sub,
        difficulty: 'medium', count,
      });
      if (mode === 'summary') {
        const html = result.html ?? '';
        const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        const folderDisplayName = sub === '__other__' ? 'Non classé' : sub;
        const sheetName = titleMatch ? titleMatch[1].trim() : folderDisplayName;
        const sheet = { id: crypto.randomUUID(), name: sheetName, filename: folderDisplayName, html, createdAt: new Date().toISOString() };
        const sheets = JSON.parse(localStorage.getItem('revision_sheets') ?? '[]');
        sheets.unshift(sheet);
        localStorage.setItem('revision_sheets', JSON.stringify(sheets));
        localStorage.setItem('revision_sheet_current_id', sheet.id);
        incrementSheet();
        navigate('/revision/sheet');
      } else {
        localStorage.setItem('revision_generated', JSON.stringify({ ...result, filename: folderLabel }));
        navigate('/revision');
      }
    } catch (e: any) {
      setError(e.message ?? 'Erreur de génération');
      setUploadMsg(null);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files ?? []).filter(f => f.size > 0);
    e.target.value = '';
    if (fileList.length === 0) return;
    setImportDialog({ files: fileList, theme: 'entreprise', subfolder: DEFAULT_SUBFOLDERS.entreprise[0], uploading: false, progress: 0 });
  };

  const handleImportConfirm = async () => {
    if (!importDialog) return;
    setImportDialog(prev => prev ? { ...prev, uploading: true, progress: 0 } : null);
    let ok = 0;
    for (let i = 0; i < importDialog.files.length; i++) {
      try {
        await ingestFile(importDialog.files[i], importDialog.theme, importDialog.subfolder || undefined);
        ok++;
      } catch { /* continue */ }
      setImportDialog(prev => prev ? { ...prev, progress: Math.round(((i + 1) / importDialog.files.length) * 100) } : null);
    }
    setImportDialog(null);
    setUploadMsg(`✅ ${ok}/${importDialog.files.length} fichier(s) indexé(s) dans ${importDialog.theme}/${importDialog.subfolder}`);
    setTimeout(() => setUploadMsg(null), 5000);
    await load();
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const results = await searchDocuments(searchQuery);
      setSearchResults(results.map(r => ({ filename: r.filename, excerpt: r.excerpt, similarity: r.score })));
    } catch (e: any) {
      setError(e.message ?? 'Erreur de recherche');
    } finally {
      setSearching(false);
    }
  };

  // ── Sous-dossiers ────────────────────────────────────────────────────────────

  const getAllSubs = (theme: string) => {
    const removed = new Set(deletedSubs[theme] ?? []);
    const defaults = (DEFAULT_SUBFOLDERS[theme] ?? []).filter(s => !removed.has(s));
    const custom   = (customSubs[theme] ?? []).filter(s => !removed.has(s));
    return [...defaults, ...custom];
  };

  const startAddSub = (theme: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAddingSubFor(theme);
    setNewSubName('');
    setTimeout(() => subInput.current?.focus(), 50);
  };

  const confirmAddSub = () => {
    const name = newSubName.trim();
    if (name && addingSubFor) {
      setCustomSubs(prev => ({
        ...prev,
        [addingSubFor]: [...(prev[addingSubFor] ?? []), name],
      }));
    }
    setAddingSubFor(null);
    setNewSubName('');
  };

  // ── Toggle expand ────────────────────────────────────────────────────────────

  const toggleTheme = (key: string) =>
    setExpandedThemes(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleSub = (key: string) =>
    setExpandedSubs(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // ── Rendu ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full" style={{ backgroundColor: 'var(--color-bg)' }}>

      {/* ── Panneau gauche (recherche + upload) ─────────────────────────── */}
      <div
        className="flex flex-col shrink-0"
        style={{ width: '260px', borderRight: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}
      >
        <div className="p-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h1 className="text-base font-semibold text-white mb-3">Base de documents</h1>

          {/* Recherche sémantique */}
          <form onSubmit={handleSearch} className="relative mb-3">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#475569' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults(null); }}
              placeholder="Recherche sémantique…"
              disabled={searching}
              className="w-full rounded-lg pl-8 pr-3 py-2 text-xs outline-none text-slate-300 placeholder:text-slate-600 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-input)', border: '1px solid var(--color-input-border)' }}
            />
          </form>

          {/* Boutons import */}
          <div className="space-y-1">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs transition-colors text-slate-400 hover:text-white hover:bg-white/5"
            >
              <Upload size={13} /> Importer un fichier
            </button>
            <button
              onClick={() => folderRef.current?.click()}
              className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs transition-colors text-slate-400 hover:text-white hover:bg-white/5"
            >
              <FolderOpen size={13} /> Importer un dossier
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.pptx,.txt,.csv" multiple className="hidden" onChange={handleUpload} />
          {/* @ts-ignore */}
          <input ref={folderRef} type="file" webkitdirectory="" multiple className="hidden" onChange={handleUpload} />
        </div>

        {/* Résultats de recherche */}
        {searchResults !== null && (
          <div className="flex-1 overflow-y-auto p-2">
            <div className="flex items-center justify-between px-2 mb-2">
              <p className="text-xs text-slate-500">{searchResults.length} résultat(s)</p>
              <button onClick={() => { setSearchResults(null); setSearchQuery(''); }} className="text-slate-600 hover:text-slate-300">
                <X size={13} />
              </button>
            </div>
            {searchResults.length === 0 ? (
              <p className="text-xs text-slate-600 px-2">Aucun document correspondant.</p>
            ) : (
              <div className="space-y-1">
                {searchResults.map((r, i) => (
                  <div key={i} className="rounded-lg px-2 py-2" style={{ backgroundColor: 'var(--color-card)' }}>
                    <p className="text-xs font-medium text-slate-300 truncate">📄 {r.filename}</p>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{r.excerpt}</p>
                    <p className="text-xs mt-1" style={{ color: '#2563eb' }}>Similarité {Math.round(r.similarity * 100)}%</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modale import */}
        {importDialog && (
          <ImportModal
            dialog={importDialog}
            themes={themes}
            getAllSubs={getAllSubs}
            onChangeTheme={theme => setImportDialog(prev => prev ? { ...prev, theme, subfolder: DEFAULT_SUBFOLDERS[theme]?.[0] ?? '' } : null)}
            onChangeSubfolder={sub => setImportDialog(prev => prev ? { ...prev, subfolder: sub } : null)}
            onConfirm={handleImportConfirm}
            onCancel={() => setImportDialog(null)}
          />
        )}

      {createThemeModal && (
          <CreateThemeModal
            value={createThemeModal}
            onChange={setCreateThemeModal}
            onConfirm={handleCreateTheme}
            onCancel={() => setCreateThemeModal(null)}
          />
        )}

      {/* Notifications */}
        {uploadMsg && (
          <div className="mx-3 my-2 rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: 'var(--color-card2)', color: '#22c55e' }}>
            {uploadMsg}
          </div>
        )}
        {error && (
          <div className="mx-3 my-2 rounded-lg px-3 py-2 text-xs flex items-center justify-between" style={{ backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error-text)' }}>
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)}><X size={12} /></button>
          </div>
        )}
      </div>

      {/* ── Panneau principal (arborescence) ──────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <p className="text-sm text-slate-400 flex-1">
            {loading ? 'Chargement…' : multiSelect
              ? `${selectedFiles.size} fichier(s) sélectionné(s)`
              : `${files.length} fichier(s) indexé(s)`}
          </p>

          {/* Bouton sélection multiple */}
          <button
            onClick={() => multiSelect ? exitMultiSelect() : setMultiSelect(true)}
            className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 font-medium transition-all"
            style={multiSelect
              ? { backgroundColor: 'color-mix(in srgb, #2563eb 15%, var(--color-card))', color: '#60a5fa', border: '1px solid #2563eb' }
              : { backgroundColor: 'var(--color-input)', color: '#64748b', border: '1px solid var(--color-input-border)' }}
          >
            {multiSelect ? <CheckSquare size={13} /> : <Square size={13} />}
            {multiSelect ? 'Désélectionner' : 'Sélectionner plusieurs'}
          </button>

          {/* Bouton déplacer la sélection */}
          {multiSelect && selectedFiles.size > 0 && (
            <button
              onClick={openBulkMove}
              className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 font-medium text-white transition-all"
              style={{ backgroundColor: '#2563eb' }}
            >
              <MoveRight size={13} />
              Changer de dossier
            </button>
          )}

          <button
            onClick={() => setCreateThemeModal({ name: '', color: PRESET_COLORS[0], icon: '📁' })}
            className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 font-medium text-white transition-all"
            style={{ backgroundColor: '#2563eb' }}
          >
            <Plus size={13} /> Nouveau dossier
          </button>

          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>

        {/* Modale déplacement multiple */}
        {bulkMove && (
          <BulkMoveModal
            state={bulkMove}
            count={selectedFiles.size}
            themes={themes}
            getAllSubs={getAllSubs}
            onChangeTheme={(t: ThemeKey) => setBulkMove(prev => prev ? { ...prev, theme: t, subfolder: DEFAULT_SUBFOLDERS[t]?.[0] ?? '' } : null)}
            onChangeSubfolder={(s: string) => setBulkMove(prev => prev ? { ...prev, subfolder: s } : null)}
            onConfirm={handleBulkMove}
            onCancel={() => setBulkMove(null)}
          />
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--color-card)' }} />
            ))}
          </div>
        ) : files.length === 0 && searchResults === null ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-4xl mb-4 opacity-40">📂</p>
            <p className="text-slate-400 font-medium">Base de données vide</p>
            <p className="text-slate-600 text-sm mt-2">Importez des fichiers pour commencer</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl">
            {themes.map((theme: Theme) => {
              const themeFiles = files.filter(f => f.theme === theme.key);
              const allSubs = getAllSubs(theme.key);
              const isExpanded = expandedThemes.has(theme.key);

              return (
                <div
                  key={theme.key}
                  className="rounded-2xl overflow-hidden"
                  style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderLeft: `4px solid ${theme.color}` }}
                >
                  {/* En-tête thème */}
                  <div className="flex items-center gap-3 px-5 py-4">
                    <button onClick={() => toggleTheme(theme.key)} className="flex items-center gap-3 flex-1 text-left">
                      <span className="text-2xl">{theme.icon}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-100 text-sm">{theme.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {themeFiles.length} document{themeFiles.length !== 1 ? 's' : ''} · {allSubs.length} dossier{allSubs.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className="text-slate-500 text-sm">{isExpanded ? '▾' : '▸'}</span>
                    </button>
                    <button
                      onClick={e => startAddSub(theme.key, e)}
                      title="Ajouter un sous-dossier"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors shrink-0"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteTheme(theme.key)}
                      title="Supprimer ce dossier"
                      className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 hover:bg-red-500/10"
                      style={{ color: '#ef4444' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Champ nouveau sous-dossier */}
                  {addingSubFor === theme.key && (
                    <div className="px-5 pb-3 flex gap-2">
                      <input
                        ref={subInput}
                        value={newSubName}
                        onChange={e => setNewSubName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') confirmAddSub(); if (e.key === 'Escape') setAddingSubFor(null); }}
                        placeholder="Nom du sous-dossier…"
                        className="flex-1 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                        style={{ backgroundColor: 'var(--color-input)', border: '1px solid var(--color-input-border)' }}
                      />
                      <button onClick={confirmAddSub} className="px-3 rounded-lg text-sm text-white transition-colors" style={{ backgroundColor: '#2563eb' }}>✓</button>
                      <button onClick={() => setAddingSubFor(null)} className="px-3 rounded-lg text-sm text-slate-300 transition-colors" style={{ backgroundColor: 'var(--color-input)' }}>✕</button>
                    </div>
                  )}

                  {/* Sous-dossiers */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--color-border)' }}>
                      {allSubs.map(sub => {
                        const subFiles = themeFiles.filter(f => f.subfolder === sub);
                        const subKey = `${theme.key}/${sub}`;
                        const isSubExpanded = expandedSubs.has(subKey);
                        const isDropTarget = dropTarget === subKey && !!draggedFile;

                        return (
                          <div
                            key={sub}
                            style={{ borderBottom: '1px solid var(--color-card2)' }}
                            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget(subKey); }}
                            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }}
                            onDrop={e => { e.preventDefault(); if (draggedFile) handleDropToFolder(theme.key, sub, draggedFile); setDropTarget(null); setDraggedFile(null); }}
                          >
                            <div
                              className={`group/folder flex items-center transition-colors ${!isDropTarget ? 'hover:bg-white/3' : ''}`}
                              style={isDropTarget ? { backgroundColor: `color-mix(in srgb, ${theme.color} 15%, var(--color-card2))`, outline: `2px dashed ${theme.color}`, outlineOffset: '-2px', borderRadius: '4px' } : undefined}
                            >
                              <button
                                onClick={() => toggleSub(subKey)}
                                className="flex-1 flex items-center gap-3 px-5 py-3"
                              >
                                <span>{subFiles.length > 0 ? '📂' : '📁'}</span>
                                <span className="flex-1 text-left text-sm text-slate-300 font-medium">{sub}</span>
                                {subFiles.length > 0 ? (
                                  <>
                                    <span className="text-xs text-slate-500 rounded-full px-2 py-0.5" style={{ backgroundColor: 'var(--color-input)' }}>{subFiles.length}</span>
                                    <span className="text-xs text-slate-600 ml-1">{isSubExpanded ? '▾' : '▸'}</span>
                                  </>
                                ) : (
                                  <span className="text-xs text-slate-700 italic">vide</span>
                                )}
                              </button>
                              <div className="pr-3 opacity-0 group-hover/folder:opacity-100 transition-opacity">
                                <ContextMenu items={[
                                  { icon: <Brain size={13} />, label: 'Flashcards', onClick: () => handleGenerateFolderRevision(theme.key, sub, 'flashcard') },
                                  { icon: <BookOpen size={13} />, label: 'QCM', onClick: () => handleGenerateFolderRevision(theme.key, sub, 'quiz') },
                                  { icon: <FileText size={13} />, label: 'Fiche de révision', onClick: () => handleGenerateFolderRevision(theme.key, sub, 'summary') },
                                  { separator: true },
                                  { icon: <Trash2 size={13} />, label: 'Supprimer le dossier', onClick: () => handleDeleteFolder(theme.key, sub), danger: true },
                                ]} />
                              </div>
                            </div>

                            {isSubExpanded && subFiles.map(file => (
                              <FileRow
                                key={file.name}
                                file={file}
                                busy={busyFile === file.name}
                                moveDialog={moveDialog}
                                themes={themes}
                                multiSelect={multiSelect}
                                selected={selectedFiles.has(file.name)}
                                isDragging={draggedFile === file.name}
                                onToggleSelect={toggleSelectFile}
                                onDelete={handleDelete}
                                onOpenMove={openMove}
                                onMove={handleMove}
                                onCancelMove={() => setMoveDialog(null)}
                                onChangeMoveTheme={(t) => {
                                  const subs = getAllSubs(t);
                                  setMoveDialog(prev => prev ? { ...prev, theme: t, subfolder: subs[0] ?? '' } : null);
                                }}
                                onChangeMoveSubfolder={(s) => setMoveDialog(prev => prev ? { ...prev, subfolder: s } : null)}
                                getAllSubs={getAllSubs}
                                onGenerateRevision={handleGenerateRevision}
                                onDragStart={setDraggedFile}
                                onDragEnd={() => { setDraggedFile(null); setDropTarget(null); }}
                              />
                            ))}
                          </div>
                        );
                      })}

                      {/* Fichiers non classés */}
                      {(() => {
                        const unclassified = themeFiles.filter(f => !f.subfolder || !allSubs.includes(f.subfolder));
                        if (unclassified.length === 0) return null;
                        const subKey = `${theme.key}/__other__`;
                        const isSubExpanded = expandedSubs.has(subKey);
                        const isDropTarget = dropTarget === subKey && !!draggedFile;
                        return (
                          <div
                            style={{ borderBottom: '1px solid var(--color-card2)' }}
                            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget(subKey); }}
                            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }}
                            onDrop={e => { e.preventDefault(); if (draggedFile) handleDropToFolder(theme.key, '', draggedFile); setDropTarget(null); setDraggedFile(null); }}
                          >
                            <div
                              className={`group/folder flex items-center transition-colors ${!isDropTarget ? 'hover:bg-white/3' : ''}`}
                              style={isDropTarget ? { backgroundColor: `color-mix(in srgb, ${theme.color} 15%, var(--color-card2))`, outline: `2px dashed ${theme.color}`, outlineOffset: '-2px', borderRadius: '4px' } : undefined}
                            >
                              <button onClick={() => toggleSub(subKey)} className="flex-1 flex items-center gap-3 px-5 py-3">
                                <span>📂</span>
                                <span className="flex-1 text-left text-sm text-slate-500 italic">Non classé</span>
                                <span className="text-xs text-slate-600 rounded-full px-2 py-0.5" style={{ backgroundColor: 'var(--color-input)' }}>{unclassified.length}</span>
                                <span className="text-xs text-slate-600 ml-1">{isSubExpanded ? '▾' : '▸'}</span>
                              </button>
                              <div className="pr-3 opacity-0 group-hover/folder:opacity-100 transition-opacity">
                                <ContextMenu items={[
                                  { icon: <Brain size={13} />, label: 'Flashcards', onClick: () => handleGenerateFolderRevision(theme.key, '__other__', 'flashcard') },
                                  { icon: <BookOpen size={13} />, label: 'QCM', onClick: () => handleGenerateFolderRevision(theme.key, '__other__', 'quiz') },
                                  { icon: <FileText size={13} />, label: 'Fiche de révision', onClick: () => handleGenerateFolderRevision(theme.key, '__other__', 'summary') },
                                ]} />
                              </div>
                            </div>
                            {isSubExpanded && unclassified.map(file => (
                              <FileRow
                                key={file.name}
                                file={file}
                                busy={busyFile === file.name}
                                moveDialog={moveDialog}
                                themes={themes}
                                multiSelect={multiSelect}
                                selected={selectedFiles.has(file.name)}
                                isDragging={draggedFile === file.name}
                                onToggleSelect={toggleSelectFile}
                                onDelete={handleDelete}
                                onOpenMove={openMove}
                                onMove={handleMove}
                                onCancelMove={() => setMoveDialog(null)}
                                onChangeMoveTheme={(t) => {
                                  const subs = getAllSubs(t);
                                  setMoveDialog(prev => prev ? { ...prev, theme: t, subfolder: subs[0] ?? '' } : null);
                                }}
                                onGenerateRevision={handleGenerateRevision}
                                onChangeMoveSubfolder={(s) => setMoveDialog(prev => prev ? { ...prev, subfolder: s } : null)}
                                getAllSubs={getAllSubs}
                                onDragStart={setDraggedFile}
                                onDragEnd={() => { setDraggedFile(null); setDropTarget(null); }}
                              />
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modale d'import ──────────────────────────────────────────────────────────

interface ImportModalProps {
  dialog: ImportDialog;
  themes: Theme[];
  getAllSubs: (theme: string) => string[];
  onChangeTheme: (theme: ThemeKey) => void;
  onChangeSubfolder: (sub: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function ImportModal({ dialog, themes, getAllSubs, onChangeTheme, onChangeSubfolder, onConfirm, onCancel }: ImportModalProps) {
  const theme = themes.find((t: Theme) => t.key === dialog.theme) ?? themes[0];
  const subs = getAllSubs(dialog.theme);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget && !dialog.uploading) onCancel(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-5 shadow-2xl"
        style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-input-border)' }}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Choisir la destination</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {dialog.files.length} fichier{dialog.files.length > 1 ? 's' : ''} sélectionné{dialog.files.length > 1 ? 's' : ''}
            </p>
          </div>
          {!dialog.uploading && (
            <button onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Liste des fichiers */}
        <div
          className="rounded-xl px-3 py-2 max-h-36 overflow-y-auto space-y-1"
          style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
        >
          {dialog.files.map(f => (
            <div key={f.name} className="flex items-center gap-2 text-xs text-slate-400">
              <span>📄</span>
              <span className="truncate">{f.name}</span>
              <span className="shrink-0 text-slate-600">({(f.size / 1024).toFixed(0)} ko)</span>
            </div>
          ))}
        </div>

        {/* Sélecteur thème */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400">Thème</label>
          <div className="grid grid-cols-2 gap-2">
            {themes.map((t: Theme) => (
              <button
                key={t.key}
                onClick={() => onChangeTheme(t.key)}
                disabled={dialog.uploading}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all text-left disabled:opacity-50"
                style={{
                  backgroundColor: dialog.theme === t.key ? `color-mix(in srgb, ${t.color} 15%, var(--color-card))` : 'var(--color-input)',
                  border: `2px solid ${dialog.theme === t.key ? t.color : 'var(--color-input-border)'}`,
                  color: dialog.theme === t.key ? 'white' : '#64748b',
                }}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sélecteur sous-dossier */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400">Sous-dossier</label>
          <div className="flex flex-wrap gap-2">
            {subs.map(s => (
              <button
                key={s}
                onClick={() => onChangeSubfolder(s)}
                disabled={dialog.uploading}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50"
                style={{
                  backgroundColor: dialog.subfolder === s ? theme.color : 'var(--color-input)',
                  color: dialog.subfolder === s ? 'white' : '#64748b',
                  border: `1px solid ${dialog.subfolder === s ? theme.color : 'var(--color-input-border)'}`,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Barre de progression */}
        {dialog.uploading && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Indexation en cours…</span>
              <span>{dialog.progress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-input)' }}>
              <div
                className="h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${dialog.progress}%`, backgroundColor: theme.color }}
              />
            </div>
          </div>
        )}

        {/* Boutons */}
        {!dialog.uploading && (
          <div className="flex gap-3 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 rounded-xl py-2.5 text-sm text-slate-300 transition-colors"
              style={{ backgroundColor: 'var(--color-input)', border: '1px solid var(--color-input-border)' }}
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: theme.color }}
            >
              Indexer ici →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ContextMenu ───────────────────────────────────────────────────────────────

interface ContextMenuItem {
  icon?: React.ReactNode;
  label?: string;
  onClick?: () => void;
  danger?: boolean;
  separator?: boolean;
}

function ContextMenu({ items }: { items: ContextMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const closeOnScroll = () => setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [open]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const itemCount      = items.filter(i => !i.separator).length;
      const sepCount       = items.filter(i =>  i.separator).length;
      const estimatedH     = itemCount * 38 + sepCount * 5 + 8;
      const spaceBelow     = window.innerHeight - rect.bottom;
      const rightOffset    = window.innerWidth - rect.right;

      if (spaceBelow < estimatedH) {
        setMenuStyle({ position: 'fixed', bottom: window.innerHeight - rect.top + 4, right: rightOffset });
      } else {
        setMenuStyle({ position: 'fixed', top: rect.bottom + 4, right: rightOffset });
      }
    }
    setOpen(o => !o);
  };

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-white/5"
        style={{ color: open ? 'var(--color-text)' : 'var(--color-muted)' }}
        title="Actions"
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div
          style={{
            ...menuStyle,
            zIndex: 9999,
            minWidth: '170px',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
            backgroundColor: 'var(--color-card2)',
            border: '1px solid var(--color-input-border)',
          }}
        >
          {items.map((item, i) =>
            item.separator ? (
              <div key={i} style={{ height: '1px', backgroundColor: 'var(--color-border)', margin: '2px 0' }} />
            ) : (
              <button
                key={i}
                onClick={() => { item.onClick?.(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-left transition-colors hover:bg-white/5"
                style={{ color: item.danger ? 'var(--color-error-text)' : 'var(--color-text)' }}
              >
                {item.icon}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Sous-composant FileRow ────────────────────────────────────────────────────

interface FileRowProps {
  file: IndexedFile;
  busy: boolean;
  moveDialog: MoveDialog | null;
  themes: Theme[];
  multiSelect: boolean;
  selected: boolean;
  isDragging: boolean;
  onToggleSelect: (name: string) => void;
  onDelete: (name: string) => void;
  onOpenMove: (file: IndexedFile) => void;
  onMove: () => void;
  onCancelMove: () => void;
  onChangeMoveTheme: (theme: ThemeKey) => void;
  onChangeMoveSubfolder: (sub: string) => void;
  getAllSubs: (theme: string) => string[];
  onGenerateRevision: (file: IndexedFile, mode: 'flashcard' | 'quiz' | 'summary') => void;
  onDragStart: (filename: string) => void;
  onDragEnd: () => void;
}


function FileRow({ file, busy, moveDialog, themes, multiSelect, selected, isDragging, onToggleSelect, onDelete, onOpenMove, onMove, onCancelMove, onChangeMoveTheme, onChangeMoveSubfolder, getAllSubs, onGenerateRevision, onDragStart, onDragEnd }: FileRowProps) {
  const isMoving = moveDialog?.filename === file.name;

  const menuItems: ContextMenuItem[] = [
    { icon: <Brain size={13} />, label: 'Flashcards', onClick: () => onGenerateRevision(file, 'flashcard') },
    { icon: <BookOpen size={13} />, label: 'QCM', onClick: () => onGenerateRevision(file, 'quiz') },
    { icon: <FileText size={13} />, label: 'Fiche de révision', onClick: () => onGenerateRevision(file, 'summary') },
    { separator: true },
    { icon: <MoveRight size={13} />, label: 'Déplacer', onClick: () => onOpenMove(file) },
    { icon: <Trash2 size={13} />, label: 'Supprimer', onClick: () => onDelete(file.name), danger: true },
  ];

  return (
    <div
      className="group"
      draggable={!multiSelect}
      onDragStart={e => { if (multiSelect) { e.preventDefault(); return; } e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', file.name); onDragStart(file.name); }}
      onDragEnd={onDragEnd}
      style={{ opacity: isDragging ? 0.4 : 1, cursor: multiSelect ? 'pointer' : 'grab' }}
    >
      <div
        className="flex items-center gap-3 px-8 py-2.5 hover:bg-white/3 transition-colors"
        style={selected ? { backgroundColor: 'rgba(37,99,235,0.12)' } : undefined}
        onClick={multiSelect ? () => onToggleSelect(file.name) : undefined}
      >
        {multiSelect && (
          <span className="shrink-0" style={{ color: selected ? '#60a5fa' : '#475569' }}>
            {selected ? <CheckSquare size={16} /> : <Square size={16} />}
          </span>
        )}
        <span className="text-base shrink-0">📄</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-200 truncate" title={file.name}>{file.name}</p>
          <p className="text-xs text-slate-600">{file.chunks} chunks indexés</p>
        </div>
        {!multiSelect && (
          <div className="flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <a
              href={`${FILE_BASE_URL}/${encodeURIComponent(file.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              title="Ouvrir le fichier"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-amber-400 hover:bg-white/5 transition-colors"
            >
              <ExternalLink size={14} />
            </a>
            <ContextMenu items={menuItems} />
          </div>
        )}
      </div>

      {/* Dialog déplacement individuel */}
      {isMoving && moveDialog && (
        <div className="mx-5 mb-3 p-4 rounded-xl space-y-3" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-input-border)' }}>
          <p className="text-sm font-medium text-slate-300">Déplacer vers</p>
          <select
            value={moveDialog.theme}
            onChange={e => onChangeMoveTheme(e.target.value as ThemeKey)}
            className="w-full rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
            style={{ backgroundColor: 'var(--color-input)', border: '1px solid var(--color-input-border)' }}
          >
            {themes.map((t: Theme) => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
          </select>
          <select
            value={moveDialog.subfolder}
            onChange={e => onChangeMoveSubfolder(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
            style={{ backgroundColor: 'var(--color-input)', border: '1px solid var(--color-input-border)' }}
          >
            {getAllSubs(moveDialog.theme).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="flex gap-2">
            <button
              onClick={onMove}
              disabled={busy}
              className="flex-1 text-sm text-white rounded-lg py-2 transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#2563eb' }}
            >
              {busy ? 'Déplacement…' : 'Déplacer'}
            </button>
            <button
              onClick={onCancelMove}
              className="px-4 text-sm text-slate-300 rounded-lg py-2 transition-colors"
              style={{ backgroundColor: 'var(--color-input)' }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modale déplacement multiple ─────────────────────────────────────────────

interface BulkMoveModalProps {
  state: BulkMoveState;
  count: number;
  themes: Theme[];
  getAllSubs: (theme: string) => string[];
  onChangeTheme: (theme: ThemeKey) => void;
  onChangeSubfolder: (sub: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function BulkMoveModal({ state, count, themes, getAllSubs, onChangeTheme, onChangeSubfolder, onConfirm, onCancel }: BulkMoveModalProps) {
  const theme = themes.find((t: Theme) => t.key === state.theme) ?? themes[0];
  const subs  = getAllSubs(state.theme);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget && !state.moving) onCancel(); }}
    >
      <div className="w-full max-w-md rounded-2xl p-6 space-y-5 shadow-2xl" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-input-border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Changer de dossier</h2>
            <p className="text-xs text-slate-500 mt-0.5">{count} fichier{count > 1 ? 's' : ''} sélectionné{count > 1 ? 's' : ''}</p>
          </div>
          {!state.moving && (
            <button onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition-colors"><X size={18} /></button>
          )}
        </div>

        {/* Sélecteur thème */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400">Thème de destination</label>
          <div className="grid grid-cols-2 gap-2">
            {themes.map((t: Theme) => (
              <button
                key={t.key}
                onClick={() => onChangeTheme(t.key)}
                disabled={state.moving}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all text-left disabled:opacity-50"
                style={{
                  backgroundColor: state.theme === t.key ? `color-mix(in srgb, ${t.color} 15%, var(--color-card))` : 'var(--color-input)',
                  border: `2px solid ${state.theme === t.key ? t.color : 'var(--color-input-border)'}`,
                  color: state.theme === t.key ? 'white' : '#64748b',
                }}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sélecteur sous-dossier */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400">Sous-dossier</label>
          <div className="flex flex-wrap gap-2">
            {subs.map(s => (
              <button
                key={s}
                onClick={() => onChangeSubfolder(s)}
                disabled={state.moving}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50"
                style={{
                  backgroundColor: state.subfolder === s ? theme.color : 'var(--color-input)',
                  color: state.subfolder === s ? 'white' : '#64748b',
                  border: `1px solid ${state.subfolder === s ? theme.color : 'var(--color-input-border)'}`,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Barre de progression */}
        {state.moving && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Déplacement en cours…</span>
              <span>{state.progress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-input)' }}>
              <div
                className="h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${state.progress}%`, backgroundColor: theme.color }}
              />
            </div>
          </div>
        )}

        {/* Boutons */}
        {!state.moving && (
          <div className="flex gap-3 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 rounded-xl py-2.5 text-sm text-slate-300 transition-colors"
              style={{ backgroundColor: 'var(--color-input)', border: '1px solid var(--color-input-border)' }}
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: theme.color }}
            >
              Déplacer ici →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modale création de dossier ────────────────────────────────────────────────

const FOLDER_ICONS = ['📁', '🏭', '🎓', '📋', '📊', '🏠', '💼', '🔬', '🎨', '📐', '💡', '🗂️'];

interface CreateThemeModalProps {
  value: { name: string; color: string; icon: string };
  onChange: (v: { name: string; color: string; icon: string }) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function CreateThemeModal({ value, onChange, onConfirm, onCancel }: CreateThemeModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-5 shadow-2xl"
        style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-input-border)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Nouveau dossier</h2>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition-colors"><X size={18} /></button>
        </div>

        {/* Prévisualisation */}
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ borderLeft: `4px solid ${value.color}`, backgroundColor: 'var(--color-bg)' }}
        >
          <span className="text-2xl">{value.icon}</span>
          <span className="font-semibold text-slate-200 text-sm">{value.name || 'Nom du dossier'}</span>
        </div>

        {/* Nom */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400">Nom</label>
          <input
            autoFocus
            value={value.name}
            onChange={e => onChange({ ...value, name: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') onConfirm(); if (e.key === 'Escape') onCancel(); }}
            placeholder="Ex : Personnel, Recherche…"
            className="w-full rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600"
            style={{ backgroundColor: 'var(--color-input)', border: '1px solid var(--color-input-border)' }}
          />
        </div>

        {/* Icône */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400">Icône</label>
          <div className="flex flex-wrap gap-2">
            {FOLDER_ICONS.map(icon => (
              <button
                key={icon}
                onClick={() => onChange({ ...value, icon })}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all"
                style={{
                  backgroundColor: value.icon === icon ? `${value.color}25` : 'var(--color-input)',
                  border: `2px solid ${value.icon === icon ? value.color : 'var(--color-input-border)'}`,
                }}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* Couleur */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400">Couleur</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => onChange({ ...value, color: c })}
                className="w-7 h-7 rounded-full transition-all"
                style={{
                  backgroundColor: c,
                  outline: value.color === c ? `3px solid ${c}` : 'none',
                  outlineOffset: '2px',
                  transform: value.color === c ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
            <input
              type="color"
              value={value.color}
              onChange={e => onChange({ ...value, color: e.target.value })}
              className="w-7 h-7 rounded-full cursor-pointer border-0 bg-transparent"
              title="Couleur personnalisée"
            />
          </div>
        </div>

        {/* Boutons */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl py-2.5 text-sm text-slate-300 transition-colors"
            style={{ backgroundColor: 'var(--color-input)', border: '1px solid var(--color-input-border)' }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={!value.name.trim()}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-40"
            style={{ backgroundColor: value.color }}
          >
            Créer le dossier
          </button>
        </div>
      </div>
    </div>
  );
}
