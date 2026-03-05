import { useState, useEffect, useCallback } from 'react';
import { Mail, RefreshCw, Paperclip, AlertCircle, Inbox, ChevronRight } from 'lucide-react';
import { getMailInbox, getMailMessage } from '../services/api';
import type { MailMessage } from '../services/api';

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function ImportanceBadge({ value }: { value: string }) {
  if (value === 'high')
    return <span style={{ color: 'var(--color-error-text)', fontSize: 10, fontWeight: 600 }}>!</span>;
  return null;
}

function EmailListItem({
  email,
  selected,
  onClick,
}: {
  email: MailMessage;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 transition-colors flex flex-col gap-0.5"
      style={{
        backgroundColor: selected ? 'color-mix(in srgb, var(--color-accent) 12%, var(--color-card))' : 'transparent',
        borderLeft: selected ? '3px solid var(--color-accent)' : '3px solid transparent',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-sm truncate"
          style={{
            fontWeight: email.is_read ? 400 : 700,
            color: email.is_read ? 'var(--color-muted2)' : 'var(--color-text)',
          }}
        >
          {email.from_name || email.from_email}
        </span>
        <span className="text-xs shrink-0" style={{ color: 'var(--color-muted)' }}>
          {formatDate(email.received_at)}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {!email.is_read && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: 'var(--color-accent)' }}
          />
        )}
        <span
          className="text-sm truncate"
          style={{ fontWeight: email.is_read ? 400 : 600, color: 'var(--color-text2)' }}
        >
          {email.subject}
        </span>
        <ImportanceBadge value={email.importance} />
      </div>
      <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>
        {email.preview}
      </p>
      {email.has_attachments && (
        <Paperclip size={11} style={{ color: 'var(--color-muted)' }} />
      )}
    </button>
  );
}

function EmailDetail({ email }: { email: MailMessage }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-6 shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
          {email.subject}
        </h2>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              {email.from_name || email.from_email}
            </p>
            {email.from_name && (
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                {email.from_email}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              {new Date(email.received_at).toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
            {email.has_attachments && (
              <span className="flex items-center gap-1 justify-end text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                <Paperclip size={11} /> Pièce(s) jointe(s)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {email.body_type === 'html' ? (
          <iframe
            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{background:#ffffff!important;color:#1a1a1a!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;margin:0;padding:16px}a{color:#2563eb}img{max-width:100%;height:auto}</style></head><body>${email.body_html}</body></html>`}
            className="w-full border-0 rounded-lg"
            style={{ minHeight: '500px', backgroundColor: '#ffffff', border: '1px solid var(--color-border)' }}
            sandbox="allow-same-origin"
            title="Corps du mail"
          />
        ) : (
          <pre
            className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: 'var(--color-text)', fontFamily: 'inherit' }}
          >
            {email.body_html || email.preview}
          </pre>
        )}
      </div>
    </div>
  );
}

export function MailPage() {
  const [emails, setEmails] = useState<MailMessage[]>([]);
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMailInbox(100);
      if (res.not_connected) {
        setNotConnected(true);
      } else {
        setEmails(res.emails);
      }
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors du chargement des mails.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSelect = async (email: MailMessage) => {
    if (selected?.id === email.id) return;
    setSelected(email);
    if (!email.body_html) {
      setLoadingDetail(true);
      try {
        const full = await getMailMessage(email.id);
        setSelected(full);
        setEmails(prev => prev.map(e => e.id === full.id ? { ...e, ...full } : e));
      } catch { /* keep preview */ }
      finally { setLoadingDetail(false); }
    }
  };

  const filtered = search
    ? emails.filter(e =>
        e.subject.toLowerCase().includes(search.toLowerCase()) ||
        e.from_name.toLowerCase().includes(search.toLowerCase()) ||
        e.from_email.toLowerCase().includes(search.toLowerCase()) ||
        e.preview.toLowerCase().includes(search.toLowerCase())
      )
    : emails;

  const unread = emails.filter(e => !e.is_read).length;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center justify-between shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}
      >
        <div className="flex items-center gap-3">
          <Mail size={20} style={{ color: 'var(--color-accent)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Boîte de réception</h1>
          {unread > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {unread}
            </span>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: 'var(--color-muted)' }}
          title="Actualiser"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left : email list */}
        <div
          className="flex flex-col shrink-0"
          style={{
            width: '340px',
            borderRight: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg)',
            overflow: 'hidden',
          }}
        >
          {/* Search */}
          <div className="p-3 shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: 'var(--color-input)',
                border: '1px solid var(--color-input-border)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="space-y-0">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <div className="h-3 rounded mb-2 animate-pulse" style={{ backgroundColor: 'var(--color-card2)', width: '60%' }} />
                    <div className="h-2.5 rounded mb-1 animate-pulse" style={{ backgroundColor: 'var(--color-card2)', width: '80%' }} />
                    <div className="h-2 rounded animate-pulse" style={{ backgroundColor: 'var(--color-card2)', width: '90%' }} />
                  </div>
                ))}
              </div>
            )}

            {!loading && notConnected && (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <Inbox size={40} style={{ color: 'var(--color-muted)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Outlook non connecté</p>
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  Connecte ton compte Outlook dans les Paramètres pour accéder à tes mails.
                </p>
              </div>
            )}

            {!loading && error && (
              <div className="m-3 rounded-lg p-3 flex items-start gap-2"
                style={{ backgroundColor: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)' }}>
                <AlertCircle size={16} style={{ color: 'var(--color-error-text)', flexShrink: 0, marginTop: 1 }} />
                <p className="text-xs" style={{ color: 'var(--color-error-text)' }}>{error}</p>
              </div>
            )}

            {!loading && !error && !notConnected && filtered.length === 0 && (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <Inbox size={32} style={{ color: 'var(--color-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                  {search ? 'Aucun résultat' : 'Boîte vide'}
                </p>
              </div>
            )}

            {!loading && filtered.map(email => (
              <EmailListItem
                key={email.id}
                email={email}
                selected={selected?.id === email.id}
                onClick={() => handleSelect(email)}
              />
            ))}
          </div>
        </div>

        {/* Right : detail */}
        <div className="flex-1 overflow-hidden" style={{ backgroundColor: 'var(--color-card)' }}>
          {!selected && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Mail size={48} style={{ color: 'var(--color-border)' }} />
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                Sélectionne un mail pour le lire
              </p>
              {!notConnected && !loading && emails.length > 0 && (
                <p className="text-xs flex items-center gap-1" style={{ color: 'var(--color-muted)' }}>
                  <ChevronRight size={12} /> {filtered.length} message{filtered.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {selected && loadingDetail && (
            <div className="flex items-center justify-center h-full">
              <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--color-muted)' }} />
            </div>
          )}

          {selected && !loadingDetail && (
            <EmailDetail email={selected} />
          )}
        </div>
      </div>
    </div>
  );
}
