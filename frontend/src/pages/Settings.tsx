import { useEffect, useState } from 'react';
import {
  RefreshCw,
  LogOut,
  CheckCircle,
  XCircle,
  Mail,
  Lock,
  Info,
} from 'lucide-react';
import {
  getOutlookStatus,
  connectOutlookImap,
  syncOutlook,
  disconnectOutlook,
  type OutlookStatus,
} from '../services/api';

export function Settings() {
  const [outlook, setOutlook]   = useState<OutlookStatus>({ connected: false });
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState(false);
  const [msg, setMsg]           = useState<{ text: string; ok: boolean } | null>(null);
  const [formEmail, setFormEmail]       = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showInfo, setShowInfo]         = useState(false);

  const refresh = () =>
    getOutlookStatus()
      .then(s => setOutlook(s))
      .finally(() => setLoading(false));

  useEffect(() => { refresh(); }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail || !formPassword) return;
    setBusy(true); setMsg(null);
    try {
      await connectOutlookImap(formEmail, formPassword);
      setMsg({ text: 'Compte connecté avec succès.', ok: true });
      setFormEmail(''); setFormPassword('');
      await refresh();
    } catch (err: any) {
      setMsg({ text: err.message ?? 'Erreur de connexion.', ok: false });
    } finally { setBusy(false); }
  };

  const handleSync = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await syncOutlook() as any;
      setMsg({ text: `Synchronisation terminée — ${r.mail_count ?? 0} mails indexés.`, ok: true });
      await refresh();
    } catch (err: any) {
      setMsg({ text: err.message, ok: false });
    } finally { setBusy(false); }
  };

  const handleDisconnect = async () => {
    if (!confirm('Déconnecter le compte Outlook ?')) return;
    setBusy(true); setMsg(null);
    try {
      await disconnectOutlook();
      setMsg({ text: 'Compte déconnecté.', ok: true });
      setOutlook({ connected: false });
    } catch (err: any) {
      setMsg({ text: err.message, ok: false });
    } finally { setBusy(false); }
  };

  const cardStyle = { backgroundColor: '#141414', border: '1px solid #1f1f1f' };
  const inputCls  = 'w-full rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-blue-500';
  const inputStyle = { backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' };

  return (
    <div className="p-6 max-w-2xl space-y-6" style={{ backgroundColor: '#0d0d0d', minHeight: '100%' }}>
      <h1 className="text-xl font-semibold text-white">Paramètres</h1>

      {/* ── Outlook IMAP ─────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6 space-y-5" style={cardStyle}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#0078d422' }}>
              <Mail size={18} style={{ color: '#0078d4' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Outlook — Messagerie IMAP</h2>
              <p className="text-xs text-slate-500">Indexe tes mails dans le RAG via IMAP (gratuit, sans Azure)</p>
            </div>
          </div>
          {!loading && (
            outlook.connected
              ? <span className="flex items-center gap-1.5 text-xs text-green-400"><CheckCircle size={14} /> Connecté</span>
              : <span className="flex items-center gap-1.5 text-xs text-slate-500"><XCircle size={14} /> Non connecté</span>
          )}
        </div>

        {/* Compte connecté */}
        {outlook.connected && (
          <div className="rounded-xl px-4 py-3 space-y-1" style={{ backgroundColor: '#1a1a1a' }}>
            <p className="text-sm text-zinc-300">{outlook.email}</p>
            {outlook.last_sync && (
              <p className="text-xs text-slate-500">
                Dernière synchronisation : {new Date(outlook.last_sync).toLocaleString('fr-FR')}
              </p>
            )}
          </div>
        )}

        {/* Formulaire connexion */}
        {!outlook.connected && (
          <form onSubmit={handleConnect} className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">Adresse e-mail et mot de passe d'application</p>
              <button
                type="button"
                onClick={() => setShowInfo(!showInfo)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <Info size={13} /> Comment obtenir un mot de passe ?
              </button>
            </div>

            {showInfo && (
              <div className="rounded-xl px-4 py-3 text-xs text-slate-400 space-y-1 leading-relaxed" style={{ backgroundColor: '#1a1a1a' }}>
                <p className="font-medium text-slate-300">Mot de passe d'application Microsoft :</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Va sur <span className="text-blue-400">account.microsoft.com</span></li>
                  <li>Sécurité → Options de sécurité avancées</li>
                  <li>Mots de passe d'application → Créer</li>
                  <li>Donne un nom (ex : "AlternApp") et copie le mot de passe généré</li>
                </ol>
                <p className="text-slate-500 mt-1">Si ton compte n'a pas la 2FA, tu peux utiliser ton mot de passe habituel.</p>
              </div>
            )}

            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                placeholder="ton@outlook.com"
                value={formEmail}
                onChange={e => setFormEmail(e.target.value)}
                required
                className={`${inputCls} pl-9`}
                style={inputStyle}
              />
            </div>

            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                placeholder="Mot de passe d'application"
                value={formPassword}
                onChange={e => setFormPassword(e.target.value)}
                required
                className={`${inputCls} pl-9`}
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={busy || !formEmail || !formPassword}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#0078d4' }}
            >
              {busy ? <RefreshCw size={15} className="animate-spin" /> : <Mail size={15} />}
              {busy ? 'Connexion…' : 'Connecter'}
            </button>
          </form>
        )}

        {/* Message retour */}
        {msg && (
          <p className={`text-sm rounded-lg px-3 py-2 ${
            msg.ok ? 'text-green-400 bg-green-950/40' : 'text-red-400 bg-red-950/40'
          }`}>
            {msg.text}
          </p>
        )}

        {/* Actions compte connecté */}
        {outlook.connected && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSync}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
              Synchroniser les mails
            </button>
            <button
              onClick={handleDisconnect}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-red-400 disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#1a1a1a' }}
            >
              <LogOut size={15} />
              Déconnecter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
