"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  connectCalendar,
  connectEmail,
  disconnectCalendar,
  disconnectEmail,
  getConversation,
  getConversations,
  getConnectionsStatus,
  syncCalendar,
  syncEmail,
} from "@/lib/api";
import type { CalendarConnection, ConnectionsStatus, EmailConnection } from "@/lib/api";
import type { Conversation, ConversationMessage } from "@/types";

interface Props {
  currentConversationId: string | null;
  refreshTrigger: number;
  onSelectConversation: (id: string, messages: ConversationMessage[]) => void;
  onNewConversation: () => void;
  onOpenDocuments: () => void;
  onOpenUpload: () => void;
}

function groupByDate(conversations: Conversation[]): { label: string; items: Conversation[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400_000);
  const weekAgo = new Date(today.getTime() - 7 * 86400_000);
  const groups: Record<string, Conversation[]> = { "Aujourd'hui": [], Hier: [], "Cette semaine": [], "Plus ancien": [] };
  for (const conv of conversations) {
    const d = new Date(conv.updated_at);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day >= today) groups["Aujourd'hui"].push(conv);
    else if (day >= yesterday) groups["Hier"].push(conv);
    else if (day >= weekAgo) groups["Cette semaine"].push(conv);
    else groups["Plus ancien"].push(conv);
  }
  return Object.entries(groups).filter(([, items]) => items.length > 0).map(([label, items]) => ({ label, items }));
}

export default function ConversationSidebar({
  currentConversationId, refreshTrigger,
  onSelectConversation, onNewConversation, onOpenDocuments, onOpenUpload,
}: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [status, setStatus] = useState<ConnectionsStatus>({ email: [], calendar: [] });

  // Dialogs
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showCalDialog, setShowCalDialog] = useState(false);
  const [emailForm, setEmailForm] = useState({ email: "", password: "", imap: "" });
  const [calForm, setCalForm] = useState({ url: "" });
  const [emailLoading, setEmailLoading] = useState(false);
  const [calLoading, setCalLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [calMsg, setCalMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<"email" | "calendar" | null>(null);

  const hasFetchedStatus = useRef(false);

  const loadConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(data);
    } catch { /* backend unavailable */ }
  }, []);

  const loadStatus = useCallback(async () => {
    const s = await getConnectionsStatus();
    setStatus(s);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations, refreshTrigger]);

  useEffect(() => {
    if (hasFetchedStatus.current) return;
    hasFetchedStatus.current = true;
    loadStatus();
  }, [loadStatus]);

  async function handleSelectConversation(id: string) {
    try {
      const detail = await getConversation(id);
      onSelectConversation(id, detail.messages);
    } catch { /* ignore */ }
  }

  // --- Email ---
  async function handleConnectEmail() {
    setEmailLoading(true);
    setEmailMsg(null);
    try {
      await connectEmail(emailForm.email, emailForm.password, emailForm.imap || undefined);
      setEmailMsg({ text: "Connecté !", ok: true });
      await loadStatus();
      setTimeout(() => {
        setShowEmailDialog(false);
        setEmailMsg(null);
        setEmailForm({ email: "", password: "", imap: "" });
      }, 1200);
    } catch (e: unknown) {
      setEmailMsg({ text: (e as Error).message, ok: false });
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleSyncEmail() {
    setIsSyncing("email");
    setSyncMsg(null);
    try {
      const r = await syncEmail();
      setSyncMsg(`✓ ${r.count} emails indexés`);
      await loadStatus();
    } catch (e: unknown) {
      setSyncMsg(`✗ ${(e as Error).message}`);
    } finally {
      setIsSyncing(null);
      setTimeout(() => setSyncMsg(null), 5000);
    }
  }

  async function handleDisconnectEmail(conn: EmailConnection) {
    await disconnectEmail(conn.id);
    setStatus((prev) => ({ ...prev, email: prev.email.filter((e) => e.id !== conn.id) }));
  }

  // --- Calendrier ---
  async function handleConnectCalendar() {
    setCalLoading(true);
    setCalMsg(null);
    try {
      await connectCalendar(calForm.url);
      setCalMsg({ text: "Connecté !", ok: true });
      await loadStatus();
      setTimeout(() => {
        setShowCalDialog(false);
        setCalMsg(null);
        setCalForm({ url: "" });
      }, 1200);
    } catch (e: unknown) {
      setCalMsg({ text: (e as Error).message, ok: false });
    } finally {
      setCalLoading(false);
    }
  }

  async function handleSyncCalendar() {
    setIsSyncing("calendar");
    setSyncMsg(null);
    try {
      const r = await syncCalendar();
      setSyncMsg(`✓ ${r.count} événements indexés`);
      await loadStatus();
    } catch (e: unknown) {
      setSyncMsg(`✗ ${(e as Error).message}`);
    } finally {
      setIsSyncing(null);
      setTimeout(() => setSyncMsg(null), 5000);
    }
  }

  async function handleDisconnectCalendar(conn: CalendarConnection) {
    await disconnectCalendar(conn.id);
    setStatus((prev) => ({ ...prev, calendar: prev.calendar.filter((c) => c.id !== conn.id) }));
  }

  const groups = groupByDate(conversations);

  return (
    <>
      <div className="flex flex-col h-full bg-zinc-900 text-zinc-100 w-64 min-w-64 border-r border-zinc-800">
        {/* Header */}
        <div className="px-4 pt-5 pb-3">
          <div className="text-sm font-semibold text-zinc-300 tracking-wide mb-3">AlternApp</div>
          <button
            onClick={onNewConversation}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-200 transition-colors"
          >
            <span className="text-lg leading-none">+</span> Nouvelle conversation
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {groups.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center mt-6 px-4">
              Aucune conversation.<br />Posez une question pour commencer.
            </p>
          ) : (
            groups.map(({ label, items }) => (
              <div key={label} className="mb-3">
                <div className="text-xs text-zinc-500 font-medium px-2 py-1">{label}</div>
                {items.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    title={conv.title ?? "Sans titre"}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors truncate block ${
                      conv.id === currentConversationId ? "bg-zinc-700 text-white" : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    {conv.title ?? "Sans titre"}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Bottom actions */}
        <div className="border-t border-zinc-800 px-2 py-3 space-y-1">
          {syncMsg && (
            <p className="text-xs px-3 pb-1" style={{ color: syncMsg.startsWith("✓") ? "#4ade80" : "#f87171" }}>{syncMsg}</p>
          )}

          <button onClick={onOpenUpload}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors">
            <span>⬆</span> Importer un document
          </button>
          <button onClick={onOpenDocuments}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors">
            <span>📁</span> Base de données
          </button>

          <div className="border-t border-zinc-800 my-1" />

          {/* ── Bouton Email ── */}
          {status.email.length === 0 ? (
            <button onClick={() => setShowEmailDialog(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors">
              <span>📧</span> Ajouter une adresse mail
            </button>
          ) : (
            <div className="px-3 py-1.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 font-medium">📧 Emails</span>
                <div className="flex gap-2">
                  <button onClick={handleSyncEmail} disabled={isSyncing === "email"}
                    className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50">
                    {isSyncing === "email" ? "…" : "Sync"}
                  </button>
                  <button onClick={() => setShowEmailDialog(true)}
                    className="text-xs text-zinc-500 hover:text-zinc-200" title="Ajouter un email">+</button>
                </div>
              </div>
              {status.email.map((conn) => (
                <div key={conn.id} className="flex items-center gap-1">
                  <span className="text-xs text-zinc-300 flex-1 truncate" title={conn.address}>{conn.address}</span>
                  <button onClick={() => handleDisconnectEmail(conn)}
                    className="text-xs text-zinc-600 hover:text-red-400 flex-shrink-0">✕</button>
                </div>
              ))}
            </div>
          )}

          {/* ── Bouton Calendrier ── */}
          {status.calendar.length === 0 ? (
            <button onClick={() => setShowCalDialog(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors">
              <span>📅</span> Ajouter un calendrier
            </button>
          ) : (
            <div className="px-3 py-1.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 font-medium">📅 Calendriers</span>
                <div className="flex gap-2">
                  <button onClick={handleSyncCalendar} disabled={isSyncing === "calendar"}
                    className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50">
                    {isSyncing === "calendar" ? "…" : "Sync"}
                  </button>
                  <button onClick={() => setShowCalDialog(true)}
                    className="text-xs text-zinc-500 hover:text-zinc-200" title="Ajouter un calendrier">+</button>
                </div>
              </div>
              {status.calendar.map((conn) => (
                <div key={conn.id} className="flex items-center gap-1">
                  <span className="text-xs text-zinc-300 flex-1 truncate" title={conn.label}>{conn.label}</span>
                  <button onClick={() => handleDisconnectCalendar(conn)}
                    className="text-xs text-zinc-600 hover:text-red-400 flex-shrink-0">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== DIALOG EMAIL ===== */}
      {showEmailDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowEmailDialog(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-[430px] shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="font-semibold text-zinc-100">Connecter un email</h3>
              <div className="text-xs text-zinc-500 mt-2 space-y-1 leading-relaxed">
                <p>Compatible Outlook.com, Gmail, Yahoo…</p>
                <p>
                  <strong className="text-zinc-400">Outlook</strong> — activez IMAP : Paramètres → Courrier → Synchronisation.
                  Avec 2FA, créez un <strong className="text-zinc-400">mot de passe d&apos;application</strong> sur{" "}
                  <em>account.microsoft.com/security</em>.
                </p>
                <p>
                  <strong className="text-zinc-400">Gmail</strong> — activez IMAP : Paramètres → Transfert/POP/IMAP.
                  Créez un <strong className="text-zinc-400">mot de passe d&apos;application</strong> sur{" "}
                  <em>myaccount.google.com → Sécurité → 2FA</em>.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <input type="email" placeholder="votre@email.com" value={emailForm.email}
                onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500" />
              <input type="password" placeholder="Mot de passe d'application" value={emailForm.password}
                onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500" />
              <input type="text" placeholder="Serveur IMAP (optionnel — auto-détecté)" value={emailForm.imap}
                onChange={(e) => setEmailForm({ ...emailForm, imap: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-500 outline-none focus:border-zinc-500" />
            </div>
            {emailMsg && (
              <p className={`text-xs ${emailMsg.ok ? "text-green-400" : "text-red-400"}`}>{emailMsg.text}</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowEmailDialog(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-xl py-2.5 transition-colors">
                Annuler
              </button>
              <button onClick={handleConnectEmail} disabled={emailLoading || !emailForm.email || !emailForm.password}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl py-2.5 transition-colors">
                {emailLoading ? "Connexion…" : "Connecter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DIALOG CALENDRIER ===== */}
      {showCalDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCalDialog(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-[430px] shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="font-semibold text-zinc-100">Connecter un calendrier</h3>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                <strong className="text-zinc-400">Outlook.com :</strong> Calendrier → Partager → Publier → Copier le lien ICS<br />
                <strong className="text-zinc-400">Google Calendar :</strong> Paramètres → [votre agenda] → Intégrer → URL au format iCal
              </p>
            </div>
            <input type="url" placeholder="https://outlook.live.com/owa/calendar/..." value={calForm.url}
              onChange={(e) => setCalForm({ url: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500" />
            {calMsg && (
              <p className={`text-xs ${calMsg.ok ? "text-green-400" : "text-red-400"}`}>{calMsg.text}</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowCalDialog(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-xl py-2.5 transition-colors">
                Annuler
              </button>
              <button onClick={handleConnectCalendar} disabled={calLoading || !calForm.url}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl py-2.5 transition-colors">
                {calLoading ? "Connexion…" : "Connecter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
