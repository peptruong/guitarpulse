/**
 * One progress record shared by every feature (coach sessions, trading fours, song practice,
 * ear training), kept on the device. Pure functions here; the app stores it in IndexedDB.
 */
import { initialEarState, type EarState } from './ear.js';

export type SessionKind = 'coach' | 'trade' | 'ear' | 'song' | 'studio';

export interface SessionRecord {
  id: string;
  kind: SessionKind;
  startedAt: number;
  durationSec: number;
  title: string;
  groove?: string;
  key?: string;
  metrics?: Record<string, number | null>;
  focus?: string;
  notesPlayed?: number;
  ear?: { correct: number; answered: number };
}

export interface ProgressRecord {
  version: 1;
  sessions: SessionRecord[];
  ear: EarState;
  streak: { current: number; best: number; lastDay: string | null };
  totals: { minutes: number; sessions: number };
}

export const MAX_SESSIONS = 300;

export function emptyProgress(): ProgressRecord {
  return { version: 1, sessions: [], ear: initialEarState(), streak: { current: 0, best: 0, lastDay: null }, totals: { minutes: 0, sessions: 0 } };
}

/** Local calendar day, YYYY-MM-DD. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function previousDay(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

export function addSession(p: ProgressRecord, s: SessionRecord, now = new Date()): ProgressRecord {
  const today = dayKey(now);
  let { current, best, lastDay } = p.streak;
  if (s.durationSec >= 60) {
    if (lastDay !== today) current = lastDay === previousDay(today) ? current + 1 : 1;
    lastDay = today;
    best = Math.max(best, current);
  }
  const sessions = [...p.sessions.filter((x) => x.id !== s.id), s].sort((a, b) => a.startedAt - b.startedAt).slice(-MAX_SESSIONS);
  return {
    ...p,
    sessions,
    streak: { current, best, lastDay },
    totals: { minutes: Math.round((p.totals.minutes + s.durationSec / 60) * 10) / 10, sessions: p.totals.sessions + 1 },
  };
}

/** The streak as it stands today (it resets if a day was missed). */
export function currentStreak(p: ProgressRecord, now = new Date()) {
  const today = dayKey(now);
  if (p.streak.lastDay === today || p.streak.lastDay === previousDay(today)) return p.streak.current;
  return 0;
}

export function withEar(p: ProgressRecord, ear: EarState): ProgressRecord {
  return { ...p, ear };
}

/** A metric over the last n sessions that measured it, oldest first. */
export function metricTrend(p: ProgressRecord, metric: string, n = 12) {
  return p.sessions
    .filter((s) => s.metrics && typeof s.metrics[metric] === 'number')
    .slice(-n)
    .map((s) => ({ day: dayKey(new Date(s.startedAt)), value: s.metrics![metric] as number }));
}

/** Merges two records (e.g. phone and laptop): sessions by id, best streak, ear items by most attempts. */
export function mergeProgress(a: ProgressRecord, b: ProgressRecord): ProgressRecord {
  const byId = new Map<string, SessionRecord>();
  for (const s of [...a.sessions, ...b.sessions]) byId.set(s.id, s);
  const sessions = [...byId.values()].sort((x, y) => x.startedAt - y.startedAt).slice(-MAX_SESSIONS);
  const items = { ...a.ear.items };
  for (const [id, st] of Object.entries(b.ear.items)) if (!items[id] || st.attempts > items[id].attempts) items[id] = st;
  const later = (a.streak.lastDay ?? '') >= (b.streak.lastDay ?? '') ? a.streak : b.streak;
  return {
    version: 1,
    sessions,
    ear: { items, unlocked: { interval: Math.max(a.ear.unlocked.interval, b.ear.unlocked.interval), chord: Math.max(a.ear.unlocked.chord, b.ear.unlocked.chord) }, sessions: Math.max(a.ear.sessions, b.ear.sessions) },
    streak: { ...later, best: Math.max(a.streak.best, b.streak.best) },
    totals: { minutes: Math.round(sessions.reduce((t, s) => t + s.durationSec / 60, 0) * 10) / 10, sessions: sessions.length },
  };
}
