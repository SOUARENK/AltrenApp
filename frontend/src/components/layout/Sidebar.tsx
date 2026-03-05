import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Calendar,
  FolderOpen,
  BookOpen,
  LogOut,
  Menu,
  X,
  Settings,
  Mail,
  CalendarPlus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getConnectionsStatus,
  connectEmail,
  connectCalendar,
  syncEmail,
  syncCalendar,
  disconnectEmail,
  disconnectCalendar,
  type EmailConnection,
  type CalendarConnection,
} from '../../services/api';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/chat', icon: MessageSquare, label: 'Chat IA' },
  { to: '/agenda', icon: Calendar, label: 'Agenda' },
  { to: '/files', icon: FolderOpen, label: 'Fichiers' },
  { to: '/revision', icon: BookOpen, label: 'Révision' },
  { to: '/settings', icon: Settings, label: 'Paramètres' },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [emails, setEmails] = useState<EmailConnection[]>([]);
  const [calendars, setCalendars] = useState<CalendarConnection[]>([]);

  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showCalDialog, setShowCalDialog] = useState(false);

  const [emailForm, setEmailForm] = useState({ email: '', password: '', server: '' });
  const [calForm, setCalForm] = useState({ url: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getConnectionsStatus().then(s => { setEmails(s.email); setCalendars(s.calendar); });
  }, []);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const handleConnectEmail = async () => {
    setBusy(true); setMsg('');
    try {
      await connectEmail(emailForm.email, emailForm.password, emailForm.server || undefined);
      const s = await getConnectionsStatus();
      setEmails(s.email);
      setShowEmailDialog(false);
      setEmailForm({ email: '', password: '', server: '' });
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const handleConnectCal = async () => {
    setBusy(true); setMsg('');
    try {
      await connectCalendar(calForm.url);
      const s = await getConnectionsStatus();
      setCalendars(s.calendar);
      setShowCalDialog(false);
      setCalForm({ url: '' });
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const handleSyncEmail = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await syncEmail();
      setMsg(`✅ ${r.count} mails synchronisés`);
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const handleSyncCal = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await syncCalendar();
      setMsg(`✅ ${r.count} événements synchronisés`);
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500';
  const btnPrimary = 'flex-1 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors';
  const btnSecondary = 'flex-1 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors';

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-20 md:hidden" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onToggle} />
      )}

      <aside
        className="fixed top-0 left-0 z-30 h-full flex flex-col transition-all duration-300"
        style={{ width: isOpen ? '240px' : '64px', backgroundColor: '#141414', borderRight: '1px solid #1f1f1f' }}
      >
        <div className="flex items-center justify-between p-4 shrink-0" style={{ borderBottom: '1px solid #1f1f1f', height: '64px' }}>
          {isOpen && <span className="font-semibold text-white text-lg truncate">AlternApp</span>}
          <button onClick={onToggle} className="rounded-lg p-1.5 transition-colors hover:bg-white/10 text-slate-400 hover:text-white ml-auto">
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to} end={to === '/'}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              style={({ isActive }) => isActive ? { backgroundColor: '#2563eb' } : {}}
              title={!isOpen ? label : undefined}
            >
              <Icon size={20} className="shrink-0" />
              {isOpen && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 px-2 pb-1 space-y-1" style={{ borderTop: '1px solid #1f1f1f', paddingTop: '8px' }}>
          <button
            onClick={() => { setMsg(''); setShowEmailDialog(true); }}
            className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm transition-colors text-slate-400 hover:text-white hover:bg-white/5"
            title={!isOpen ? 'Connecter un email' : undefined}
          >
            <Mail size={18} className={`shrink-0 ${emails.length > 0 ? 'text-green-400' : ''}`} />
            {isOpen && (
              <span className="truncate">
                {emails.length > 0 ? `${emails.length} email${emails.length > 1 ? 's' : ''}` : 'Ajouter un email'}
              </span>
            )}
          </button>

          <button
            onClick={() => { setMsg(''); setShowCalDialog(true); }}
            className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm transition-colors text-slate-400 hover:text-white hover:bg-white/5"
            title={!isOpen ? 'Connecter un calendrier' : undefined}
          >
            <CalendarPlus size={18} className={`shrink-0 ${calendars.length > 0 ? 'text-green-400' : ''}`} />
            {isOpen && (
              <span className="truncate">
                {calendars.length > 0 ? `${calendars.length} calendrier${calendars.length > 1 ? 's' : ''}` : 'Ajouter un calendrier'}
              </span>
            )}
          </button>
        </div>

        <div className="shrink-0 p-3" style={{ borderTop: '1px solid #1f1f1f' }}>
          {isOpen && user && (
            <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ backgroundColor: '#2563eb', color: 'white' }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors" title={!isOpen ? 'Déconnexion' : undefined}>
            <LogOut size={18} className="shrink-0" />
            {isOpen && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      {showEmailDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2"><Mail size={18} className="text-blue-400" /> Connecter un email</h3>
              <button onClick={() => setShowEmailDialog(false)} className="text-zinc-500 hover:text-white"><X size={18} /></button>
            </div>

            {emails.length > 0 && (
              <div className="space-y-2">
                {emails.map(e => (
                  <div key={e.id} className="flex items-center justify-between rounded-lg px-3 py-2 bg-zinc-800">
                    <span className="text-sm text-zinc-300 truncate">{e.address}</span>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={handleSyncEmail} disabled={busy} title="Synchroniser" className="p-1 text-zinc-400 hover:text-blue-400 disabled:opacity-40"><RefreshCw size={14} /></button>
                      <button onClick={() => disconnectEmail(e.id).then(() => getConnectionsStatus().then(s => setEmails(s.email)))} disabled={busy} title="Déconnecter" className="p-1 text-zinc-400 hover:text-red-400 disabled:opacity-40"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <input className={inputCls} type="email" placeholder="adresse@exemple.com" value={emailForm.email} onChange={e => setEmailForm(f => ({ ...f, email: e.target.value }))} />
              <input className={inputCls} type="password" placeholder="Mot de passe d'application" value={emailForm.password} onChange={e => setEmailForm(f => ({ ...f, password: e.target.value }))} />
              <input className={inputCls} type="text" placeholder="Serveur IMAP (optionnel)" value={emailForm.server} onChange={e => setEmailForm(f => ({ ...f, server: e.target.value }))} />
              {msg && <p className="text-xs text-red-400">{msg}</p>}
              <div className="flex gap-2">
                <button className={btnSecondary} onClick={() => setShowEmailDialog(false)}>Annuler</button>
                <button className={btnPrimary} disabled={busy || !emailForm.email || !emailForm.password} onClick={handleConnectEmail}>
                  {busy ? 'Connexion…' : 'Connecter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCalDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2"><CalendarPlus size={18} className="text-blue-400" /> Connecter un calendrier</h3>
              <button onClick={() => setShowCalDialog(false)} className="text-zinc-500 hover:text-white"><X size={18} /></button>
            </div>

            {calendars.length > 0 && (
              <div className="space-y-2">
                {calendars.map(c => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg px-3 py-2 bg-zinc-800">
                    <span className="text-sm text-zinc-300 truncate">{c.label}</span>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={handleSyncCal} disabled={busy} title="Synchroniser" className="p-1 text-zinc-400 hover:text-blue-400 disabled:opacity-40"><RefreshCw size={14} /></button>
                      <button onClick={() => disconnectCalendar(c.id).then(() => getConnectionsStatus().then(s => setCalendars(s.calendar)))} disabled={busy} title="Déconnecter" className="p-1 text-zinc-400 hover:text-red-400 disabled:opacity-40"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <input className={inputCls} type="url" placeholder="https://calendar.google.com/…/basic.ics" value={calForm.url} onChange={e => setCalForm({ url: e.target.value })} />
              <p className="text-xs text-zinc-500">URL ICS depuis Google Calendar, Outlook ou tout autre agenda compatible.</p>
              {msg && <p className="text-xs text-red-400">{msg}</p>}
              <div className="flex gap-2">
                <button className={btnSecondary} onClick={() => setShowCalDialog(false)}>Annuler</button>
                <button className={btnPrimary} disabled={busy || !calForm.url} onClick={handleConnectCal}>
                  {busy ? 'Connexion…' : 'Connecter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
