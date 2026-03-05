"use client";

import { useState, useRef } from "react";
import type { IndexedFile } from "@/types";
import { THEME_LABELS, THEME_KEYS, THEME_SUBFOLDERS, type ThemeKey } from "@/types";
import { deleteFile, moveFile } from "@/lib/api";

interface Props {
  files: IndexedFile[];
  onRefresh: () => void;
  customSubfolders: Record<string, string[]>;
  onAddSubfolder: (theme: string, name: string) => void;
}

const THEME_ICONS: Record<string, string> = {
  entreprise: "🏭",
  ecole: "🎓",
  administratif: "📋",
  partage: "📊",
};

const THEME_COLORS: Record<string, string> = {
  entreprise: "border-blue-500",
  ecole: "border-green-500",
  administratif: "border-orange-500",
  partage: "border-purple-500",
};

interface MoveDialog {
  filename: string;
  theme: ThemeKey;
  subfolder: string;
}

export default function DatabaseView({ files, onRefresh, customSubfolders, onAddSubfolder }: Props) {
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set(THEME_KEYS));
  const [expandedSubfolders, setExpandedSubfolders] = useState<Set<string>>(new Set());
  const [moveDialog, setMoveDialog] = useState<MoveDialog | null>(null);
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [addingSubfolder, setAddingSubfolder] = useState<string | null>(null);
  const [newSubfolderName, setNewSubfolderName] = useState("");
  const newSubfolderInputRef = useRef<HTMLInputElement>(null);

  const getAllSubfolders = (theme: string) => [
    ...(THEME_SUBFOLDERS[theme] || []),
    ...(customSubfolders[theme] || []),
  ];

  // Group files by theme
  const byTheme: Record<string, IndexedFile[]> = {};
  for (const key of THEME_KEYS) byTheme[key] = [];
  for (const file of files) {
    const theme = file.theme in byTheme ? file.theme : "entreprise";
    byTheme[theme].push(file);
  }

  const toggleTheme = (theme: string) => {
    setExpandedThemes((prev) => {
      const next = new Set(prev);
      next.has(theme) ? next.delete(theme) : next.add(theme);
      return next;
    });
  };

  const toggleSubfolder = (key: string) => {
    setExpandedSubfolders((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Supprimer "${filename}" de la base ?`)) return;
    setLoadingFile(filename);
    try {
      await deleteFile(filename);
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur de suppression.");
    } finally {
      setLoadingFile(null);
    }
  };

  const openMove = (file: IndexedFile) => {
    const theme = (file.theme as ThemeKey) in THEME_LABELS ? (file.theme as ThemeKey) : "entreprise";
    const subs = getAllSubfolders(theme);
    setMoveDialog({
      filename: file.name,
      theme,
      subfolder: file.subfolder && subs.includes(file.subfolder) ? file.subfolder : subs[0] || "",
    });
  };

  const handleMove = async () => {
    if (!moveDialog) return;
    setLoadingFile(moveDialog.filename);
    try {
      await moveFile(moveDialog.filename, moveDialog.theme, moveDialog.subfolder || null);
      setMoveDialog(null);
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur de déplacement.");
    } finally {
      setLoadingFile(null);
    }
  };

  const startAddSubfolder = (theme: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAddingSubfolder(theme);
    setNewSubfolderName("");
    setTimeout(() => newSubfolderInputRef.current?.focus(), 50);
  };

  const confirmAddSubfolder = () => {
    const name = newSubfolderName.trim();
    if (!name || !addingSubfolder) { setAddingSubfolder(null); return; }
    onAddSubfolder(addingSubfolder, name);
    setAddingSubfolder(null);
    setNewSubfolderName("");
  };

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-8">
        <p className="text-5xl mb-4">📂</p>
        <p className="text-zinc-400 font-medium">Base de données vide</p>
        <p className="text-zinc-600 text-sm mt-2">Uploadez des fichiers pour commencer à les organiser</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {THEME_KEYS.map((theme) => {
        const themeFiles = byTheme[theme];
        const isExpanded = expandedThemes.has(theme);
        const allSubs = getAllSubfolders(theme);

        return (
          <div key={theme} className={`rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden border-l-4 ${THEME_COLORS[theme]}`}>
            {/* Theme header */}
            <div className="flex items-center gap-3 px-5 py-4">
              <button
                onClick={() => toggleTheme(theme)}
                className="flex items-center gap-3 flex-1 text-left"
              >
                <span className="text-2xl">{THEME_ICONS[theme]}</span>
                <div className="flex-1">
                  <p className="font-semibold text-zinc-100 text-base">{THEME_LABELS[theme]}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {themeFiles.length} document{themeFiles.length !== 1 ? "s" : ""} · {allSubs.length} dossier{allSubs.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <span className="text-zinc-500 text-sm">{isExpanded ? "▾" : "▸"}</span>
              </button>

              {/* Bouton ajouter sous-dossier */}
              <button
                onClick={(e) => startAddSubfolder(theme, e)}
                title="Ajouter un sous-dossier"
                className="text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 rounded-lg w-8 h-8 flex items-center justify-center transition-colors text-lg flex-shrink-0"
              >
                +
              </button>
            </div>

            {/* Champ pour nouveau sous-dossier */}
            {addingSubfolder === theme && (
              <div className="px-5 pb-3 flex gap-2">
                <input
                  ref={newSubfolderInputRef}
                  value={newSubfolderName}
                  onChange={(e) => setNewSubfolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmAddSubfolder();
                    if (e.key === "Escape") setAddingSubfolder(null);
                  }}
                  placeholder="Nom du nouveau dossier..."
                  className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-500 placeholder-zinc-600"
                />
                <button
                  onClick={confirmAddSubfolder}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 rounded-lg transition-colors"
                >
                  ✓
                </button>
                <button
                  onClick={() => setAddingSubfolder(null)}
                  className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm px-3 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Subfolders */}
            {isExpanded && (
              <div className="border-t border-zinc-800">
                {allSubs.map((sub) => {
                  const subFiles = themeFiles.filter((f) => f.subfolder === sub);
                  const subKey = `${theme}/${sub}`;
                  const isSubExpanded = expandedSubfolders.has(subKey);

                  return (
                    <div key={sub} className="border-b border-zinc-800/50 last:border-b-0">
                      {/* Subfolder header */}
                      <button
                        onClick={() => toggleSubfolder(subKey)}
                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-zinc-800/50 transition-colors"
                      >
                        <span className="text-base">{subFiles.length > 0 ? "📂" : "📁"}</span>
                        <span className="flex-1 text-left text-sm text-zinc-300 font-medium">{sub}</span>
                        {subFiles.length > 0 ? (
                          <>
                            <span className="text-xs text-zinc-500 bg-zinc-800 rounded-full px-2 py-0.5">
                              {subFiles.length}
                            </span>
                            <span className="text-zinc-600 text-xs ml-1">{isSubExpanded ? "▾" : "▸"}</span>
                          </>
                        ) : (
                          <span className="text-xs text-zinc-700 italic">vide</span>
                        )}
                      </button>

                      {/* Files in subfolder */}
                      {isSubExpanded && subFiles.map((file) => (
                        <div key={file.name} className="group">
                          <div className="flex items-center gap-3 px-8 py-2.5 hover:bg-zinc-800/30 transition-colors">
                            <span className="text-base flex-shrink-0">📄</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-zinc-200 truncate" title={file.name}>{file.name}</p>
                              <p className="text-xs text-zinc-600">{file.chunks} chunks indexés</p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openMove(file)}
                                disabled={loadingFile === file.name}
                                title="Déplacer"
                                className="text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 rounded-lg w-7 h-7 flex items-center justify-center transition-colors disabled:opacity-30 text-sm"
                              >
                                ✎
                              </button>
                              <button
                                onClick={() => handleDelete(file.name)}
                                disabled={loadingFile === file.name}
                                title="Supprimer"
                                className="text-zinc-500 hover:text-red-400 hover:bg-zinc-700 rounded-lg w-7 h-7 flex items-center justify-center transition-colors disabled:opacity-30 text-sm"
                              >
                                🗑
                              </button>
                            </div>
                          </div>

                          {/* Move dialog */}
                          {moveDialog?.filename === file.name && (
                            <div className="mx-5 mb-3 p-4 bg-zinc-950 border border-zinc-700 rounded-xl space-y-3">
                              <p className="text-sm font-medium text-zinc-300">Déplacer vers</p>
                              <select
                                value={moveDialog.theme}
                                onChange={(e) => {
                                  const newTheme = e.target.value as ThemeKey;
                                  const subs = getAllSubfolders(newTheme);
                                  setMoveDialog({ ...moveDialog, theme: newTheme, subfolder: subs[0] || "" });
                                }}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500"
                              >
                                {THEME_KEYS.map((k) => (
                                  <option key={k} value={k}>{THEME_ICONS[k]} {THEME_LABELS[k]}</option>
                                ))}
                              </select>
                              <select
                                value={moveDialog.subfolder}
                                onChange={(e) => setMoveDialog({ ...moveDialog, subfolder: e.target.value })}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500"
                              >
                                {getAllSubfolders(moveDialog.theme).map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleMove}
                                  disabled={loadingFile === file.name}
                                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg py-2 transition-colors"
                                >
                                  {loadingFile === file.name ? "Déplacement..." : "Déplacer"}
                                </button>
                                <button
                                  onClick={() => setMoveDialog(null)}
                                  className="px-4 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded-lg py-2 transition-colors"
                                >
                                  Annuler
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}

                {/* Fichiers non classés dans ce thème */}
                {(() => {
                  const unclassified = themeFiles.filter(
                    (f) => !f.subfolder || !allSubs.includes(f.subfolder)
                  );
                  if (unclassified.length === 0) return null;
                  const subKey = `${theme}/__other__`;
                  const isSubExpanded = expandedSubfolders.has(subKey);
                  return (
                    <div className="border-b border-zinc-800/50 last:border-b-0">
                      <button
                        onClick={() => toggleSubfolder(subKey)}
                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-zinc-800/50 transition-colors"
                      >
                        <span className="text-base">📂</span>
                        <span className="flex-1 text-left text-sm text-zinc-500 italic">Non classé</span>
                        <span className="text-xs text-zinc-600 bg-zinc-800 rounded-full px-2 py-0.5">{unclassified.length}</span>
                        <span className="text-zinc-600 text-xs ml-1">{isSubExpanded ? "▾" : "▸"}</span>
                      </button>
                      {isSubExpanded && unclassified.map((file) => (
                        <div key={file.name} className="group">
                          <div className="flex items-center gap-3 px-8 py-2.5 hover:bg-zinc-800/30 transition-colors">
                            <span className="text-base flex-shrink-0">📄</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-zinc-200 truncate" title={file.name}>{file.name}</p>
                              <p className="text-xs text-zinc-600">{file.chunks} chunks indexés</p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openMove(file)}
                                disabled={loadingFile === file.name}
                                title="Déplacer"
                                className="text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 rounded-lg w-7 h-7 flex items-center justify-center transition-colors disabled:opacity-30 text-sm"
                              >
                                ✎
                              </button>
                              <button
                                onClick={() => handleDelete(file.name)}
                                disabled={loadingFile === file.name}
                                title="Supprimer"
                                className="text-zinc-500 hover:text-red-400 hover:bg-zinc-700 rounded-lg w-7 h-7 flex items-center justify-center transition-colors disabled:opacity-30 text-sm"
                              >
                                🗑
                              </button>
                            </div>
                          </div>
                          {moveDialog?.filename === file.name && (
                            <div className="mx-5 mb-3 p-4 bg-zinc-950 border border-zinc-700 rounded-xl space-y-3">
                              <p className="text-sm font-medium text-zinc-300">Déplacer vers</p>
                              <select
                                value={moveDialog.theme}
                                onChange={(e) => {
                                  const newTheme = e.target.value as ThemeKey;
                                  const subs = getAllSubfolders(newTheme);
                                  setMoveDialog({ ...moveDialog, theme: newTheme, subfolder: subs[0] || "" });
                                }}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500"
                              >
                                {THEME_KEYS.map((k) => (
                                  <option key={k} value={k}>{THEME_ICONS[k]} {THEME_LABELS[k]}</option>
                                ))}
                              </select>
                              <select
                                value={moveDialog.subfolder}
                                onChange={(e) => setMoveDialog({ ...moveDialog, subfolder: e.target.value })}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500"
                              >
                                {getAllSubfolders(moveDialog.theme).map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleMove}
                                  disabled={loadingFile === file.name}
                                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg py-2 transition-colors"
                                >
                                  {loadingFile === file.name ? "Déplacement..." : "Déplacer"}
                                </button>
                                <button
                                  onClick={() => setMoveDialog(null)}
                                  className="px-4 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded-lg py-2 transition-colors"
                                >
                                  Annuler
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
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
  );
}
