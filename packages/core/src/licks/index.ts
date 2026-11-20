import { ASIA } from './data/asia.js';
import { BLUES_ROCK } from './data/blues-rock.js';
import { GROOVE_COUNTRY } from './data/groove-country.js';
import { MODERN_JAZZ } from './data/modern-jazz.js';
import type { Difficulty, Lick, LickGenre } from './types.js';

export const LICKS: Lick[] = [...BLUES_ROCK, ...MODERN_JAZZ, ...GROOVE_COUNTRY, ...ASIA];

export interface LickSearch {
  artist?: string;
  genre?: LickGenre;
  technique?: string;
  key?: string;
  scale?: string;
  maxDifficulty?: Difficulty;
  minDifficulty?: Difficulty;
  text?: string;
  limit?: number;
  offset?: number;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9#]+/g, ' ').trim();

export function searchLicks(q: LickSearch) {
  const words = q.text ? norm(q.text).split(' ').filter(Boolean) : [];
  const matches = LICKS.filter((l) => {
    if (q.artist && !norm(l.artist).includes(norm(q.artist))) return false;
    if (q.genre && l.genre !== q.genre) return false;
    if (q.technique && !l.techniques.some((t) => norm(t).includes(norm(q.technique!)))) return false;
    if (q.key && norm(l.key) !== norm(q.key)) return false;
    if (q.scale && !norm(l.scale).includes(norm(q.scale))) return false;
    if (q.maxDifficulty && l.difficulty > q.maxDifficulty) return false;
    if (q.minDifficulty && l.difficulty < q.minDifficulty) return false;
    if (words.length) {
      const hay = norm([l.title, l.artist, l.genre, l.theory, l.chord, l.scale, ...l.techniques].join(' '));
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  const offset = q.offset ?? 0;
  const limit = q.limit ?? 10;
  return {
    total: matches.length,
    offset,
    licks: matches.slice(offset, offset + limit),
    hasMore: offset + limit < matches.length,
  };
}

export function getLick(id: string) {
  return LICKS.find((l) => l.id === id);
}

export function lickFacets() {
  const count = <K extends string | number>(f: (l: Lick) => K) => {
    const m = new Map<K, number>();
    for (const l of LICKS) m.set(f(l), (m.get(f(l)) ?? 0) + 1);
    return Object.fromEntries(m);
  };
  return {
    total: LICKS.length,
    artists: count((l) => l.artist),
    genres: count((l) => l.genre),
    difficulty: count((l) => l.difficulty),
  };
}
