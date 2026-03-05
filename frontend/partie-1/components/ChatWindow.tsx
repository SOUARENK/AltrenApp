"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ConversationMessage, IndexedFile, Message, ThemeKey } from "@/types";
import { THEME_KEYS, THEME_LABELS, THEME_SUBFOLDERS } from "@/types";
import { sendQuestion, uploadFile, getDocuments } from "@/lib/api";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import LoadingDots from "./LoadingDots";
import DatabaseView from "./DatabaseView";
import ConversationSidebar from "./ConversationSidebar";

const WELCOME_CONTENT =
  "Bonjour ! Je suis votre assistant AlternApp. Je réponds à partir de vos documents, mails et événements calendrier.\n\nImportez des fichiers ou connectez votre compte Outlook via le menu de gauche, puis posez vos questions.";

const SUPPORTED_EXTENSIONS = new Set([
  ".pdf", ".docx", ".pptx", ".txt", ".csv",
  ".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".tif", ".webp",
]);

const THEME_ICONS: Record<string, string> = {
  entreprise: "🏭",
  ecole: "🎓",
  administratif: "📋",
  partage: "📊",
};

function makeWelcome(): Message {
  return { id: "welcome", role: "assistant", content: WELCOME_CONTENT, timestamp: new Date() };
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([makeWelcome()]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [input, setInput] = useState("");
  const [precision, setPrecision] = useState(2);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<IndexedFile[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dbModalOpen, setDbModalOpen] = useState(false);
  const [showUploadMenu, setShowUploadMenu] = useState(false);

  // Dialog de destination avant upload
  const [pendingUpload, setPendingUpload] = useState<{ files: File[] } | null>(null);
  const [uploadDest, setUploadDest] = useState<{ theme: ThemeKey; subfolder: string }>({
    theme: "entreprise",
    subfolder: THEME_SUBFOLDERS["entreprise"][0],
  });

  // Sous-dossiers personnalisés (persistés en localStorage)
  const [customSubfolders, setCustomSubfolders] = useState<Record<string, string[]>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem("alternapp_custom_subfolders");
      if (stored) setCustomSubfolders(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const addCustomSubfolder = useCallback((theme: string, name: string) => {
    setCustomSubfolders((prev) => {
      const existing = prev[theme] || [];
      if (existing.includes(name)) return prev;
      const updated = { ...prev, [theme]: [...existing, name] };
      try { localStorage.setItem("alternapp_custom_subfolders", JSON.stringify(updated)); }
      catch { /* ignore */ }
      return updated;
    });
  }, []);

  const getAllSubfolders = useCallback((theme: string) => [
    ...(THEME_SUBFOLDERS[theme] || []),
    ...(customSubfolders[theme] || []),
  ], [customSubfolders]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleRefresh = useCallback(async () => {
    const files = await getDocuments();
    setUploadedFiles(files);
  }, []);

  useEffect(() => { handleRefresh(); }, [handleRefresh]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Detect ?outlook_connected=true in URL after OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("outlook_connected") === "true") {
      addMsg({ role: "system", content: "✅ Compte Outlook connecté ! Cliquez sur « Sync » dans la sidebar pour importer vos mails et événements." });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const addMsg = (msg: Omit<Message, "id" | "timestamp">) => {
    setMessages((prev) => [
      ...prev,
      { ...msg, id: crypto.randomUUID(), timestamp: new Date() },
    ]);
  };

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || isLoading) return;
    addMsg({ role: "user", content: question });
    setInput("");
    setIsLoading(true);
    try {
      const data = await sendQuestion(question, precision, conversationId);
      addMsg({ role: "assistant", content: data.answer, sources: data.sources });
      setConversationId(data.conversation_id);
      setRefreshTrigger((n) => n + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur inattendue s'est produite.";
      addMsg({ role: "assistant", content: `Erreur : ${message}` });
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, precision, conversationId]);

  const handleSelectConversation = useCallback((id: string, convMessages: ConversationMessage[]) => {
    setConversationId(id);
    const mapped: Message[] = convMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sources: m.sources,
      timestamp: new Date(m.created_at),
    }));
    setMessages(mapped.length > 0 ? mapped : [makeWelcome()]);
  }, []);

  const handleNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([makeWelcome()]);
  }, []);

  // Sélection de fichier → ouvre le dialog de destination
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadDest({ theme: "entreprise", subfolder: getAllSubfolders("entreprise")[0] });
    setPendingUpload({ files: [file] });
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => {
      const ext = f.name.toLowerCase().match(/\.[^.]+$/)?.[0];
      return ext && SUPPORTED_EXTENSIONS.has(ext);
    });
    e.target.value = "";
    if (files.length === 0) {
      addMsg({ role: "system", content: "Aucun fichier supporté trouvé dans ce dossier." });
      return;
    }
    setUploadDest({ theme: "entreprise", subfolder: getAllSubfolders("entreprise")[0] });
    setPendingUpload({ files });
  };

  // Upload après confirmation de destination
  const handleConfirmUpload = async () => {
    if (!pendingUpload) return;
    const { files } = pendingUpload;
    const { theme, subfolder } = uploadDest;
    setPendingUpload(null);
    setIsUploading(true);

    if (files.length === 1) {
      addMsg({
        role: "system",
        content: `Indexation de "${files[0].name}" dans ${THEME_ICONS[theme]} ${THEME_LABELS[theme]} › ${subfolder}...`,
      });
      try {
        const data = await uploadFile(files[0], theme, subfolder);
        await handleRefresh();
        addMsg({
          role: "system",
          content: `"${files[0].name}" indexé avec succès — ${data.chunks_ingested} chunks en ${(data.processing_time_ms / 1000).toFixed(1)}s.`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur lors de l'upload.";
        addMsg({ role: "system", content: `Échec de "${files[0].name}" : ${message}` });
      }
    } else {
      addMsg({
        role: "system",
        content: `${files.length} fichiers → ${THEME_ICONS[theme]} ${THEME_LABELS[theme]} › ${subfolder}. Indexation en cours...`,
      });
      let success = 0;
      for (let i = 0; i < files.length; i++) {
        addMsg({
          role: "system",
          content: `Traitement de "${files[i].name}" (${i + 1}/${files.length})...`,
        });
        try {
          await uploadFile(files[i], theme, subfolder);
          success++;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Erreur inconnue.";
          addMsg({ role: "system", content: `Échec de "${files[i].name}" : ${message}` });
        }
      }
      await handleRefresh();
      addMsg({
        role: "system",
        content: `Indexation terminée : ${success}/${files.length} fichier(s) traité(s) avec succès.`,
      });
    }
    setIsUploading(false);
  };

  const handleClearDocuments = async () => {
    if (!confirm("Supprimer tous les documents indexés ?")) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/documents`, { method: "DELETE" });
      await handleRefresh();
      addMsg({ role: "system", content: "Tous les documents ont été supprimés de la base." });
    } catch {
      addMsg({ role: "system", content: "Erreur lors de la suppression des documents." });
    }
  };

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden">

      {/* ===== SIDEBAR CONVERSATIONS ===== */}
      {sidebarOpen && (
        <ConversationSidebar
          currentConversationId={conversationId}
          refreshTrigger={refreshTrigger}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onOpenDocuments={() => setDbModalOpen(true)}
          onOpenUpload={() => setShowUploadMenu(true)}
        />
      )}

      {/* ===== ZONE PRINCIPALE ===== */}
      <main className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg p-1.5 transition-colors"
            title={sidebarOpen ? "Fermer la sidebar" : "Ouvrir la sidebar"}
          >
            ☰
          </button>
          <div>
            <h1 className="font-bold text-zinc-100">AlternApp</h1>
            <p className="text-xs text-zinc-500">Répond à partir de vos documents, mails et calendrier</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto">
            {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
            {isLoading && (
              <div className="flex gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm flex-shrink-0">AI</div>
                <div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3"><LoadingDots /></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <ChatInput value={input} onChange={setInput} onSend={handleSend}
          disabled={isLoading} precision={precision} onPrecisionChange={setPrecision} />
      </main>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file"
        accept=".pdf,.docx,.pptx,.txt,.csv,.png,.jpg,.jpeg,.bmp,.tiff,.tif,.webp"
        onChange={handleFileSelect} className="hidden" />
      <input ref={folderInputRef} type="file"
        // @ts-expect-error webkitdirectory not in React types
        webkitdirectory="" multiple
        onChange={handleFolderSelect} className="hidden" />

      {/* ===== MODAL CHOIX UPLOAD ===== */}
      {showUploadMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowUploadMenu(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden shadow-2xl w-72" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-zinc-800">
              <h3 className="font-semibold text-zinc-100 text-sm">Importer</h3>
            </div>
            <button
              onClick={() => { setShowUploadMenu(false); fileInputRef.current?.click(); }}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-zinc-800 transition-colors text-left"
            >
              <span className="text-xl">📄</span>
              <div>
                <p className="text-sm text-zinc-200 font-medium">Un fichier</p>
                <p className="text-xs text-zinc-500">PDF, DOCX, PPTX, CSV, image…</p>
              </div>
            </button>
            <div className="border-t border-zinc-800" />
            <button
              onClick={() => { setShowUploadMenu(false); folderInputRef.current?.click(); }}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-zinc-800 transition-colors text-left"
            >
              <span className="text-xl">📁</span>
              <div>
                <p className="text-sm text-zinc-200 font-medium">Un dossier</p>
                <p className="text-xs text-zinc-500">Tous les fichiers supportés</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ===== DIALOG DESTINATION UPLOAD ===== */}
      {pendingUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-80 space-y-4 shadow-2xl">
            <div>
              <h3 className="font-semibold text-zinc-100">Où classer ce(s) fichier(s) ?</h3>
              <p className="text-xs text-zinc-500 mt-1">
                {pendingUpload.files.length === 1
                  ? `"${pendingUpload.files[0].name}"`
                  : `${pendingUpload.files.length} fichiers sélectionnés`}
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Catégorie</label>
                <select
                  value={uploadDest.theme}
                  onChange={(e) => {
                    const newTheme = e.target.value as ThemeKey;
                    setUploadDest({ theme: newTheme, subfolder: getAllSubfolders(newTheme)[0] });
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500"
                >
                  {THEME_KEYS.map((k) => (
                    <option key={k} value={k}>{THEME_ICONS[k]} {THEME_LABELS[k]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Sous-dossier</label>
                <select
                  value={uploadDest.subfolder}
                  onChange={(e) => setUploadDest({ ...uploadDest, subfolder: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500"
                >
                  {getAllSubfolders(uploadDest.theme).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setPendingUpload(null)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-xl py-2.5 transition-colors">
                Annuler
              </button>
              <button onClick={handleConfirmUpload}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl py-2.5 transition-colors">
                Indexer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL BASE DE DONNÉES ===== */}
      {dbModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
          <div className="flex items-center justify-between px-8 py-5 border-b border-zinc-800 bg-zinc-900 flex-shrink-0">
            <div>
              <h2 className="font-bold text-zinc-100 text-lg">🗄️ Base de données</h2>
              <p className="text-xs text-zinc-500 mt-0.5">AlternApp — {uploadedFiles.length} document{uploadedFiles.length !== 1 ? "s" : ""} indexé{uploadedFiles.length !== 1 ? "s" : ""}</p>
            </div>
            <button onClick={() => setDbModalOpen(false)}
              className="text-zinc-500 hover:text-zinc-200 transition-colors text-xl px-2">
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8">
            <DatabaseView
              files={uploadedFiles}
              onRefresh={handleRefresh}
              customSubfolders={customSubfolders}
              onAddSubfolder={addCustomSubfolder}
            />
          </div>

          {uploadedFiles.length > 0 && (
            <div className="px-8 py-4 border-t border-zinc-800 bg-zinc-900 flex-shrink-0">
              <button onClick={handleClearDocuments}
                className="border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 text-sm rounded-xl py-2 px-4 transition-colors">
                Supprimer tout
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
