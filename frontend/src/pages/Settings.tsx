import { useEffect, useState } from 'react';
import {
  RefreshCw,
  LogOut,
  ExternalLink,
  CheckCircle,
  XCircle,
  Mail,
  Sun,
  Moon,
} from 'lucide-react';
import {
  getOutlookStatus,
  getMicrosoftAuthUrl,
  syncOutlook,
  disconnectOutlook,
  type OutlookStatus,
} from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

export function Settings() {
  const { theme, toggleTheme } = useTheme();
  const [outlook, setOutlook] = useState<OutlookStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [msg, setMsg]         = useState<{ text: string; ok: boolean } | null>(null);

  const refresh = () =>
    getOutlookStatus()
      .then(s => setOutlook(s))
      .finally(() => setLoading(false));

  useEffect(() => { refresh(); }, []);

  const handleConnect = async () => {
    setBusy(true); setMsg(null);
    try {
      const url = await getMicrosoftAuthUrl();
      window.location.href = url;
    } catch (e: any) {
      setMsg({ text: e.message, ok: false });
      setBusy(false);
    }
  };

  const handleSync = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await syncOutlook() as any;
      setMsg({ text: `Synchronisation terminée — ${r.mail_count ?? r.emails_count ?? 0} mails, ${r.event_count ?? r.events_count ?? 0} événements indexés.`, ok: true });
      await refresh();
    } catch (e: any) {
      setMsg({ text: e.message, ok: false });
    } finally { setBusy(false); }
  };

  const handleDisconnect = async () => {
    if (!confirm('Déconnecter le compte Outlook ?')) return;
    setBusy(true); setMsg(null);
    try {
      await disconnectOutlook();
      setMsg({ text: 'Compte Outlook déconnecté.', ok: true });
      setOutlook({ connected: false });
    } catch (e: any) {
      setMsg({ text: e.message, ok: false });
    } finally { setBusy(false); }
  };

  const isDark = theme === 'dark';
  const cardStyle = { backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' };

  return (
    <div className="p-6 max-w-2xl space-y-6" style={{ backgroundColor: 'var(--color-bg)', minHeight: '100%' }}>
      <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Paramètres</h1>

      {/* ── Thème ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-5" style={cardStyle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: isDark ? '#ffffff11' : '#0f172a11' }}>
              {isDark ? <Moon size={18} style={{ color: 'var(--color-text)' }} /> : <Sun size={18} style={{ color: '#f59e0b' }} />}
            </div>
            <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Thème</span>
          </div>
          <button
            onClick={toggleTheme}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
            style={{ backgroundColor: isDark ? '#2563eb' : '#e2e8f0' }}
            aria-label="Changer le thème"
          >
            <span
              className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
              style={{ transform: isDark ? 'translateX(24px)' : 'translateX(4px)' }}
            />
          </button>
        </div>
      </div>

      {/* ── Outlook OAuth ─────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6 space-y-5" style={cardStyle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#0078d422' }}>
              <Mail size={18} style={{ color: '#0078d4' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Outlook / Microsoft 365</h2>
              <p className="text-xs text-slate-500">Synchronise tes mails et ton calendrier dans le RAG</p>
            </div>
          </div>
          {!loading && (
            outlook.connected
              ? <span className="flex items-center gap-1.5 text-xs text-green-400"><CheckCircle size={14} /> Connecté</span>
              : <span className="flex items-center gap-1.5 text-xs text-slate-500"><XCircle size={14} /> Non connecté</span>
          )}
        </div>

        {outlook.connected && (
          <div className="rounded-xl px-4 py-3 space-y-1" style={{ backgroundColor: 'var(--color-card2)' }}>
            <p className="text-sm text-zinc-300">{outlook.email}</p>
            {outlook.last_sync && (
              <p className="text-xs text-slate-500">
                Dernière synchronisation : {new Date(outlook.last_sync).toLocaleString('fr-FR')}
              </p>
            )}
          </div>
        )}

        {msg && (
          <p className={`text-sm rounded-lg px-3 py-2 ${msg.ok ? 'text-green-400 bg-green-950/40' : 'text-red-400 bg-red-950/40'}`}>
            {msg.text}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {!outlook.connected ? (
            <button
              onClick={handleConnect}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#0078d4' }}
            >
              <ExternalLink size={15} />
              Se connecter avec Microsoft
            </button>
          ) : (
            <>
              <button
                onClick={handleSync}
                disabled={busy}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
                Synchroniser
              </button>
              <button
                onClick={handleDisconnect}
                disabled={busy}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-red-400 disabled:opacity-50 transition-colors"
                style={{ backgroundColor: 'var(--color-card2)' }}
              >
                <LogOut size={15} />
                Déconnecter
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
