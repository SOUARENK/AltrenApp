import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getMedals, ensureJoinDate, formatDuration, nextThreshold, prevThreshold, getQuizAvg } from '../utils/profileStats';
import type { MedalInfo, MedalTier } from '../utils/profileStats';

// ── Couleurs et styles par palier ─────────────────────────────────────────────

const TIER_LABEL: Record<MedalTier, string> = {
  none:    'Verrouillée',
  bronze:  'Bronze',
  silver:  'Argent',
  gold:    'Or',
  diamond: 'Diamant',
};

const TIER_COLOR: Record<MedalTier, { bg: string; border: string; text: string }> = {
  none:    { bg: '#1e293b', border: '#334155', text: '#475569' },
  bronze:  { bg: '#3d1f07', border: '#92400e', text: '#d97706' },
  silver:  { bg: '#1e293b', border: '#6b7280', text: '#9ca3af' },
  gold:    { bg: '#3d2a00', border: '#d97706', text: '#fbbf24' },
  diamond: { bg: 'transparent', border: 'transparent', text: '#ffffff' },
};

const TIER_EMOJI: Record<MedalTier, string> = {
  none:    '🔒',
  bronze:  '🥉',
  silver:  '🥈',
  gold:    '🥇',
  diamond: '💎',
};

// ── Holographic CSS (inline keyframes via <style> tag) ────────────────────────

const HOLO_STYLE = `
@keyframes holo-rotate {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes holo-shine {
  0%   { opacity: 0.7; }
  50%  { opacity: 1; }
  100% { opacity: 0.7; }
}
.holo-bg {
  background: linear-gradient(135deg,
    #ff0080, #ff8c00, #ffe100, #00d4ff, #9c27b0, #ff0080
  );
  background-size: 300% 300%;
  animation: holo-rotate 3s ease infinite, holo-shine 3s ease infinite;
}
.holo-card {
  background: linear-gradient(135deg,
    rgba(255,0,128,0.15), rgba(0,212,255,0.15), rgba(156,39,176,0.15)
  );
  border: 1px solid;
  border-image: linear-gradient(135deg, #ff0080, #00d4ff, #9c27b0, #ff0080) 1;
  animation: holo-rotate 4s ease infinite;
  background-size: 300% 300%;
}
`;

// ── Composant MedalCard ───────────────────────────────────────────────────────

function MedalCard({ medal }: { medal: MedalInfo }) {
  const { tier, count, thresholds } = medal;
  const colors   = TIER_COLOR[tier];
  const next     = nextThreshold(medal);
  const prev     = prevThreshold(medal);
  const isDiamond = tier === 'diamond';
  const isNone    = tier === 'none';

  const progressPct = next
    ? Math.min(100, ((count - prev) / (next - prev)) * 100)
    : 100;

  const progressColor =
    tier === 'bronze'  ? '#d97706' :
    tier === 'silver'  ? '#9ca3af' :
    tier === 'gold'    ? '#fbbf24' :
    tier === 'diamond' ? '#a78bfa' :
    '#334155';

  return (
    <div
      className={isDiamond ? 'holo-card rounded-2xl p-5 flex flex-col gap-4' : 'rounded-2xl p-5 flex flex-col gap-4'}
      style={isDiamond ? { borderRadius: '16px' } : {
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
      }}
    >
      {/* Icône + nom */}
      <div className="flex items-start gap-4">
        <div
          className={isDiamond ? 'holo-bg w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0' : 'w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0'}
          style={isDiamond ? { borderRadius: '12px' } : {
            backgroundColor: isNone ? '#0f172a' : colors.border,
            border: `2px solid ${isNone ? '#1e293b' : colors.border}`,
            opacity: isNone ? 0.5 : 1,
          }}
        >
          {TIER_EMOJI[tier]}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="font-bold text-base leading-tight"
            style={{ color: isDiamond ? '#ffffff' : colors.text }}
          >
            {medal.name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
            {medal.description}
          </p>
          <span
            className="inline-block mt-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={isDiamond
              ? { background: 'rgba(167,139,250,0.2)', color: '#c4b5fd' }
              : { backgroundColor: isNone ? '#1e293b' : `${colors.border}30`, color: isNone ? '#475569' : colors.text }
            }
          >
            {TIER_LABEL[tier]}
          </span>
        </div>

        {/* Compteur */}
        <div className="text-right shrink-0">
          <p
            className="text-2xl font-bold tabular-nums"
            style={{ color: isDiamond ? '#ffffff' : isNone ? '#334155' : colors.text }}
          >
            {count}
          </p>
          <p className="text-xs" style={{ color: '#475569' }}>total</p>
        </div>
      </div>

      {/* Barre de progression */}
      <div>
        <div className="flex justify-between text-xs mb-1.5" style={{ color: '#475569' }}>
          {next ? (
            <>
              <span>{count} / {next}</span>
              <span>{next - count} encore pour {
                tier === 'none'   ? 'Bronze' :
                tier === 'bronze' ? 'Argent' :
                tier === 'silver' ? 'Or' : 'Diamant'
              }</span>
            </>
          ) : (
            <span className="w-full text-center" style={{ color: isDiamond ? '#c4b5fd' : '#fbbf24' }}>
              🏆 Palier maximum atteint !
            </span>
          )}
        </div>
        <div className="w-full h-2 rounded-full" style={{ backgroundColor: '#0f172a' }}>
          <div
            className={isDiamond ? 'holo-bg h-2 rounded-full' : 'h-2 rounded-full transition-all duration-700'}
            style={isDiamond ? { width: '100%', borderRadius: '9999px' } : {
              width: `${progressPct}%`,
              backgroundColor: progressColor,
            }}
          />
        </div>

        {/* Jalons */}
        <div className="flex justify-between mt-2">
          {(['bronze', 'silver', 'gold', 'diamond'] as const).map(t => {
            const val = thresholds[t];
            const reached = count >= val;
            const dotColor =
              t === 'bronze'  ? '#d97706' :
              t === 'silver'  ? '#9ca3af' :
              t === 'gold'    ? '#fbbf24' :
              '#a78bfa';
            return (
              <div key={t} className="flex flex-col items-center gap-0.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: reached ? dotColor : '#1e293b', border: `1px solid ${reached ? dotColor : '#334155'}` }}
                />
                <span className="text-xs" style={{ color: reached ? dotColor : '#334155', fontSize: '10px' }}>
                  {val}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Page Profil ───────────────────────────────────────────────────────────────

export function Profile() {
  const { user } = useAuth();
  const [medals, setMedals]     = useState<MedalInfo[]>([]);
  const [joinDate, setJoinDate] = useState('');
  const [quizAvg,  setQuizAvg]  = useState<number | null>(null);
  const [hoverQcm, setHoverQcm] = useState(false);

  useEffect(() => {
    const d = ensureJoinDate();
    setJoinDate(d);
    setMedals(getMedals());
    setQuizAvg(getQuizAvg());
  }, []);

  const duration = joinDate ? formatDuration(joinDate) : '';

  const totalQuiz  = medals.find(m => m.id === 'quiz')?.count  ?? 0;
  const totalSheet = medals.find(m => m.id === 'sheet')?.count ?? 0;
  const totalMsg   = medals.find(m => m.id === 'msg')?.count   ?? 0;
  const earnedMedals = medals.filter(m => m.tier !== 'none').length;

  return (
    <>
      <style>{HOLO_STYLE}</style>

      <div className="h-full overflow-y-auto" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

          {/* ── En-tête utilisateur ── */}
          <div
            className="rounded-2xl p-6 flex items-center gap-5"
            style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
              style={{ backgroundColor: '#2563eb', color: 'white' }}
            >
              {user?.name?.charAt(0).toUpperCase() ?? '?'}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-slate-100 truncate">{user?.name ?? 'Utilisateur'}</h1>
              <p className="text-sm text-slate-500 truncate">{user?.email ?? ''}</p>
              {duration && (
                <p className="text-xs mt-1.5" style={{ color: '#64748b' }}>
                  Membre depuis <span className="font-semibold text-slate-400">{duration}</span>
                </p>
              )}
            </div>

            {/* Stats rapides */}
            <div className="hidden sm:flex gap-4 shrink-0">
              {[
                { label: 'Médailles', value: earnedMedals },
                { label: 'QCM',       value: totalQuiz },
                { label: 'Messages',  value: totalMsg },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-xl font-bold text-slate-100">{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Statistiques ── */}
          <div>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Statistiques</h2>
            <div className="grid grid-cols-3 gap-3">
              {/* QCM réalisés — avec tooltip moyenne */}
              <div
                className="rounded-xl p-4 text-center relative cursor-default"
                style={{ backgroundColor: 'var(--color-card)', border: `1px solid ${hoverQcm ? '#2563eb' : 'var(--color-border)'}`, transition: 'border-color 0.15s' }}
                onMouseEnter={() => setHoverQcm(true)}
                onMouseLeave={() => setHoverQcm(false)}
              >
                <p className="text-2xl mb-1">📝</p>
                <p className="text-2xl font-bold" style={{ color: '#2563eb' }}>{totalQuiz}</p>
                <p className="text-xs text-slate-500 mt-0.5">QCM réalisés</p>
                {hoverQcm && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-10 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap shadow-lg"
                    style={{ backgroundColor: '#1e293b', border: '1px solid #2563eb', color: '#93c5fd' }}
                  >
                    {quizAvg !== null ? `Moyenne : ${quizAvg}%` : 'Aucun score enregistré'}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0" style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #2563eb' }} />
                  </div>
                )}
              </div>

              {/* Fiches générées */}
              <div
                className="rounded-xl p-4 text-center"
                style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
              >
                <p className="text-2xl mb-1">📚</p>
                <p className="text-2xl font-bold" style={{ color: '#16a34a' }}>{totalSheet}</p>
                <p className="text-xs text-slate-500 mt-0.5">Fiches générées</p>
              </div>

              {/* Messages chat */}
              <div
                className="rounded-xl p-4 text-center"
                style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
              >
                <p className="text-2xl mb-1">💬</p>
                <p className="text-2xl font-bold" style={{ color: '#7c3aed' }}>{totalMsg}</p>
                <p className="text-xs text-slate-500 mt-0.5">Messages chat</p>
              </div>
            </div>
          </div>

          {/* ── Médailles ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Médailles</h2>
              <span className="text-xs text-slate-600">{earnedMedals} / {medals.length} obtenues</span>
            </div>
            <div className="space-y-3">
              {medals.map(medal => (
                <MedalCard key={medal.id} medal={medal} />
              ))}
            </div>
          </div>

          {/* ── Légende ── */}
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
          >
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Paliers</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { tier: 'bronze'  as MedalTier, label: 'Bronze',  color: '#d97706' },
                { tier: 'silver'  as MedalTier, label: 'Argent',  color: '#9ca3af' },
                { tier: 'gold'    as MedalTier, label: 'Or',      color: '#fbbf24' },
                { tier: 'diamond' as MedalTier, label: 'Diamant', color: '#a78bfa' },
              ].map(({ tier, label, color }) => (
                <div key={tier} className="flex flex-col items-center gap-1.5">
                  <div
                    className={tier === 'diamond' ? 'holo-bg w-8 h-8 rounded-lg flex items-center justify-center text-sm' : 'w-8 h-8 rounded-lg flex items-center justify-center text-sm'}
                    style={tier === 'diamond' ? { borderRadius: '8px' } : { backgroundColor: `${color}20`, border: `1px solid ${color}` }}
                  >
                    {TIER_EMOJI[tier]}
                  </div>
                  <span className="text-xs" style={{ color }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
