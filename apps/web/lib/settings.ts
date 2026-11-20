/**
 * Shared session settings: groove defaults, reading jam links into page settings, and unrolling a
 * looping chord progression into absolute beats (the coach and trading fours run past one loop).
 */
import type { ChordSpan } from '@guitarpulse/core/coach/assess';
import { GROOVES, getGroove, progressionChords, type Groove } from '@guitarpulse/core/grooves';
import { parseNote, pc, pcName, prefersFlats } from '@guitarpulse/core/theory/notes';
import { findScale } from '@guitarpulse/core/theory/scales';
import { encodeJam, type JamMode, type JamSession } from '@guitarpulse/core/session';

export interface JamSettings {
  grooveId: string;
  progression: number;
  /** Key root, e.g. "A", "Bb". */
  key: string;
  bpm: number;
  scale: string;
}

export const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

export const PAGE_FOR_MODE: Record<JamMode, string> = { studio: '/studio', coach: '/coach', trade: '/trade', song: '/song', ear: '/ear' };

export function defaultSettings(grooveId = 'slow-blues'): JamSettings {
  const g = getGroove(GROOVES.some((x) => x.id === grooveId) ? grooveId : 'slow-blues');
  return { grooveId: g.id, progression: 0, key: g.progressions[0].key, bpm: g.bpm.default, scale: g.scales[0] };
}

/** "A minor" → "A", "Bbm" → "Bb", "f#" → "F#"; null when it is not a key. */
export function keyRoot(key: string | undefined): string | null {
  if (!key) return null;
  const t = key.trim().split(/\s+/)[0].replace(/m$/, '');
  const n = parseNote(t);
  return n ? n.name : null;
}

/** Normalises a key root to one of the twelve spellings in KEYS (flat keys flat, sharp keys sharp). */
export function canonicalKey(key: string): string {
  const n = parseNote(key);
  if (!n) return 'A';
  const flat = pcName(n.pc, true);
  const sharp = pcName(n.pc, false);
  return (KEYS as readonly string[]).includes(flat) ? flat : sharp;
}

export function settingsFromSession(s: JamSession): JamSettings {
  const base = defaultSettings(s.groove);
  const g = getGroove(base.grooveId);
  const progression = s.progression !== undefined && s.progression < g.progressions.length ? s.progression : 0;
  const root = keyRoot(s.key);
  return {
    grooveId: base.grooveId,
    progression,
    key: canonicalKey(root ?? g.progressions[progression].key),
    bpm: s.bpm ?? g.bpm.default,
    scale: s.scale && findScale(s.scale) ? findScale(s.scale)!.id : g.scales[0],
  };
}

export function sessionFor(mode: JamMode, settings: JamSettings, extra: Partial<JamSession> = {}): JamSession {
  return { v: 1, mode, groove: settings.grooveId, progression: settings.progression, key: settings.key, bpm: settings.bpm, scale: settings.scale, ...extra };
}

export function linkFor(mode: JamMode, settings: JamSettings, extra: Partial<JamSession> = {}): string {
  return `${PAGE_FOR_MODE[mode]}?s=${encodeJam(sessionFor(mode, settings, extra))}`;
}

export function grooveChords(settings: JamSettings): ChordSpan[] {
  const g = getGroove(settings.grooveId);
  const p = g.progressions[Math.min(settings.progression, g.progressions.length - 1)];
  return progressionChords(p.roman, settings.key);
}

export function loopLength(chords: ChordSpan[]): number {
  return Math.ceil(Math.max(...chords.map((c) => c.endBeat)) / 4) * 4;
}

/** Chords of a looping progression laid out over [fromBeat, toBeat). */
export function unrollChords(chords: ChordSpan[], loopBeats: number, fromBeat: number, toBeat: number): ChordSpan[] {
  const out: ChordSpan[] = [];
  const first = Math.floor(fromBeat / loopBeats);
  const last = Math.floor((toBeat - 1e-9) / loopBeats);
  for (let k = first; k <= last; k++) {
    for (const c of chords) {
      const startBeat = c.startBeat + k * loopBeats;
      const endBeat = c.endBeat + k * loopBeats;
      if (endBeat > fromBeat && startBeat < toBeat) out.push({ symbol: c.symbol, startBeat, endBeat, ...(c.scale ? { scale: c.scale } : {}) });
    }
  }
  return out;
}

export function chordAtBeat(chords: ChordSpan[], loopBeats: number, beat: number): { chord: ChordSpan; index: number } {
  const b = ((beat % loopBeats) + loopBeats) % loopBeats;
  const index = Math.max(0, chords.findIndex((c) => b >= c.startBeat && b < c.endBeat));
  return { chord: chords[index], index };
}

export function isMinorScale(scaleId: string): boolean {
  const s = findScale(scaleId);
  return !!s && s.degrees.includes('b3');
}

/** Pentatonic boxes are counted from the minor root: relative minor for major keys. */
export function boxKey(key: string, scaleId: string): { key: string; minor: boolean } {
  const n = parseNote(key);
  if (!n) return { key, minor: true };
  if (isMinorScale(scaleId)) return { key: n.name, minor: true };
  return { key: pcName(pc(n.pc - 3), prefersFlats(n)), minor: true };
}

export function grooveById(id: string): Groove {
  return getGroove(id);
}
