// ── Clés localStorage ─────────────────────────────────────────────────────────
const KEY_JOIN_DATE   = 'profile_join_date';
const KEY_QUIZ_COUNT  = 'profile_quiz_count';
const KEY_SHEET_COUNT = 'profile_sheet_count';
const KEY_MSG_COUNT   = 'profile_message_count';

// ── Join date ─────────────────────────────────────────────────────────────────

export function ensureJoinDate(): string {
  let d = localStorage.getItem(KEY_JOIN_DATE);
  if (!d) {
    d = new Date().toISOString();
    localStorage.setItem(KEY_JOIN_DATE, d);
  }
  return d;
}

export function formatDuration(isoDate: string): string {
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
  if (days < 1)   return "aujourd'hui";
  if (days < 30)  return `${days}j`;
  if (days < 365) return `${Math.floor(days / 30)} mois`;
  const y = Math.floor(days / 365);
  return `${y} an${y > 1 ? 's' : ''}`;
}

// ── Compteurs ─────────────────────────────────────────────────────────────────

function getCount(key: string): number {
  return parseInt(localStorage.getItem(key) ?? '0', 10);
}

function increment(key: string): void {
  localStorage.setItem(key, String(getCount(key) + 1));
}

export const getQuizCount  = () => getCount(KEY_QUIZ_COUNT);
export const getSheetCount = () => getCount(KEY_SHEET_COUNT);
export const getMsgCount   = () => getCount(KEY_MSG_COUNT);

export const incrementQuiz  = () => increment(KEY_QUIZ_COUNT);
export const incrementSheet = () => increment(KEY_SHEET_COUNT);
export const incrementMsg   = () => increment(KEY_MSG_COUNT);

// ── Médailles ─────────────────────────────────────────────────────────────────

export type MedalTier = 'none' | 'bronze' | 'silver' | 'gold' | 'diamond';

export interface MedalThresholds {
  bronze: number;
  silver: number;
  gold: number;
  diamond: number;
}

export interface MedalInfo {
  id: string;
  name: string;
  description: string;
  tier: MedalTier;
  count: number;
  thresholds: MedalThresholds;
}

const QUIZ_T:  MedalThresholds = { bronze: 10,  silver: 25,  gold: 70,  diamond: 120 };
const SHEET_T: MedalThresholds = { bronze: 15,  silver: 38,  gold: 105, diamond: 180 };
const MSG_T:   MedalThresholds = { bronze: 100, silver: 200, gold: 350, diamond: 500 };

function getTier(count: number, t: MedalThresholds): MedalTier {
  if (count >= t.diamond) return 'diamond';
  if (count >= t.gold)    return 'gold';
  if (count >= t.silver)  return 'silver';
  if (count >= t.bronze)  return 'bronze';
  return 'none';
}

export function getMedals(): MedalInfo[] {
  const quiz  = getQuizCount();
  const sheet = getSheetCount();
  const msg   = getMsgCount();
  return [
    { id: 'quiz',  name: 'Addict aux QCM',      description: 'QCM réalisés',                    tier: getTier(quiz,  QUIZ_T),  count: quiz,  thresholds: QUIZ_T  },
    { id: 'sheet', name: 'Premier de la classe', description: 'Fiches de révision générées',     tier: getTier(sheet, SHEET_T), count: sheet, thresholds: SHEET_T },
    { id: 'msg',   name: 'Bavard',               description: 'Messages envoyés au chatbot',     tier: getTier(msg,   MSG_T),   count: msg,   thresholds: MSG_T   },
  ];
}

/** Prochain palier à atteindre (valeur cible, ou null si diamant) */
export function nextThreshold(medal: MedalInfo): number | null {
  const { tier, thresholds: t } = medal;
  if (tier === 'none')    return t.bronze;
  if (tier === 'bronze')  return t.silver;
  if (tier === 'silver')  return t.gold;
  if (tier === 'gold')    return t.diamond;
  return null; // diamant = max
}

/** Palier précédent (pour la barre de progression) */
export function prevThreshold(medal: MedalInfo): number {
  const { tier, thresholds: t } = medal;
  if (tier === 'none')    return 0;
  if (tier === 'bronze')  return t.bronze;
  if (tier === 'silver')  return t.silver;
  if (tier === 'gold')    return t.gold;
  return t.diamond;
}
