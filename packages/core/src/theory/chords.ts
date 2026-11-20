import { Chord, Interval } from 'tonal';
import { parseNote, pc, semitoneToDegree, spellDegree, type NoteName } from './notes.js';

export type Quality = 'maj' | 'min' | 'dom' | 'hdim' | 'dim' | 'aug' | 'sus' | 'mMaj' | 'power';

export interface ParsedChord {
  symbol: string;
  root: NoteName;
  bass?: NoteName;
  name: string;
  /** Degree labels relative to the root, e.g. ["1","b3","5","b7","9"]. */
  degrees: string[];
  /** Semitones above the root (may exceed 12 for extensions). */
  semitones: number[];
  /** Unique pitch classes relative to the root (0-11). */
  relPcs: number[];
  /** Absolute pitch classes. */
  pcs: number[];
  notes: string[];
  quality: Quality;
  third?: string;
  seventh?: string;
}

function tidy(symbol: string) {
  return symbol
    .trim()
    .replace(/Δ7?/g, 'maj7')
    .replace(/ø7?/g, 'm7b5')
    .replace(/°7/g, 'dim7')
    .replace(/°/g, 'dim')
    .replace(/(?<=^[A-G][#b]?)-/, 'm')
    .replace(/(?<=^[A-G][#b]?)min/, 'm')
    .replace(/mmaj7/i, 'mMaj7')
    .replace(/m\(maj7\)/i, 'mMaj7');
}

function intervalToDegree(name: string): string {
  const iv = Interval.get(name);
  const num = iv.num as number;
  const semis = iv.semitones as number;
  // Express compound intervals as extensions (9, 11, 13) but fold octave duplicates back to 1.
  const number = num === 8 ? 1 : num;
  const majorRef = [0, 2, 4, 5, 7, 9, 11][(number - 1) % 7] + 12 * Math.floor((number - 1) / 7);
  const alter = semis - (num === 8 ? 12 : majorRef) ;
  const acc = alter > 0 ? '#'.repeat(alter) : 'b'.repeat(-alter);
  return acc + number;
}

export function parseChord(symbol: string): ParsedChord {
  // Only treat "/X" as a bass note when X is a note name, so "C6/9" stays a chord type.
  const slash = /^(.*)\/([A-Ga-g][#b♯♭]{0,2})$/.exec(tidy(symbol));
  const main = slash ? slash[1] : tidy(symbol);
  const bassPart = slash ? slash[2] : undefined;
  const c = Chord.get(main);
  if (c.empty || !c.tonic) throw new Error(`Could not read chord "${symbol}". Try forms like Am7, D7, Gmaj7, F#m7b5, Bb7#9, Csus4, E7alt.`);
  const root = parseNote(c.tonic);
  if (!root) throw new Error(`Could not read the root of "${symbol}".`);
  const bass = bassPart ? parseNote(bassPart) ?? undefined : undefined;
  if (bassPart && !bass) throw new Error(`Could not read the bass note in "${symbol}".`);
  const degrees = c.intervals.map(intervalToDegree);
  const semitones = c.intervals.map((i) => Interval.semitones(i) as number);
  const relPcs = [...new Set(semitones.map((s) => pc(s)))];
  const has = (s: number) => relPcs.includes(s);
  const third = has(4) ? '3' : has(3) ? 'b3' : undefined;
  const seventh = has(11) ? '7' : has(10) ? 'b7' : degrees.includes('bb7') ? 'bb7' : undefined;
  let quality: Quality;
  if (!third && has(7) && relPcs.length === 2) quality = 'power';
  else if (!third) quality = 'sus';
  else if (third === 'b3' && has(6) && !has(7)) quality = seventh === 'b7' ? 'hdim' : 'dim';
  else if (third === 'b3') quality = seventh === '7' ? 'mMaj' : 'min';
  else if (has(8) && !has(7) && !seventh) quality = 'aug';
  else if (seventh === 'b7') quality = 'dom';
  else quality = 'maj';
  return {
    symbol,
    root,
    bass,
    name: `${root.name} ${c.type || 'chord'}`.trim(),
    degrees,
    semitones,
    relPcs,
    pcs: relPcs.map((r) => pc(root.pc + r)),
    notes: degrees.map((d) => spellDegree(root, d)),
    quality,
    third,
    seventh,
  };
}

/** Degree label for any pitch class relative to a chord root. */
export function degreeIn(chord: ParsedChord, absPc: number): string {
  const rel = pc(absPc - chord.root.pc);
  const i = chord.relPcs.indexOf(rel);
  if (i >= 0) {
    const d = chord.degrees.find((deg, k) => pc(chord.semitones[k]) === rel);
    if (d) return d;
  }
  return semitoneToDegree(rel);
}

/**
 * Picks up to four notes for four-voice systems (drop-2, drop-3), most important first:
 * 3rd, 7th, altered tones, extensions, 6th, root, 5th. Returns pitch classes relative to the root.
 */
export function fourVoiceCore(chord: ParsedChord): { rel: number[]; rootless: boolean } | null {
  const pairs = chord.degrees.map((d, i) => ({ d, rel: pc(chord.semitones[i]) }));
  const rank = (d: string) => {
    if (d === '3' || d === 'b3' || d === '4' || d === '2') return 0; // 3rd or the sus note
    if (d === '7' || d === 'b7' || d === 'bb7') return 1;
    if (d === 'b5' || d === '#5' || d === 'b9' || d === '#9' || d === '#11' || d === 'b13') return 2;
    if (d === '13' || d === '9' || d === '11') return 3;
    if (d === '6') return 2;
    if (d === '1') return 4;
    return 5; // natural 5th
  };
  const ordered = [...pairs].sort((a, b) => rank(a.d) - rank(b.d));
  const unique: number[] = [];
  for (const p of ordered) if (!unique.includes(p.rel)) unique.push(p.rel);
  if (unique.length < 4) return null;
  const rel = unique.slice(0, 4);
  return { rel, rootless: !rel.includes(0) };
}

/** Root, 3rd (or sus note) and 5th for triad systems. */
export function triadCore(chord: ParsedChord): number[] {
  const has = (s: number) => chord.relPcs.includes(s);
  const third = has(4) ? 4 : has(3) ? 3 : has(5) ? 5 : has(2) ? 2 : null;
  const fifth = has(7) ? 7 : has(6) ? 6 : has(8) ? 8 : null;
  return [0, ...(third !== null ? [third] : []), ...(fifth !== null ? [fifth] : [])];
}

/** Root, 3rd and 7th (or 6th) for shell voicings. */
export function shellCore(chord: ParsedChord): number[] | null {
  const has = (s: number) => chord.relPcs.includes(s);
  const third = has(4) ? 4 : has(3) ? 3 : has(5) ? 5 : null;
  const seventh = has(11) ? 11 : has(10) ? 10 : has(9) ? 9 : null;
  if (third === null || seventh === null) return null;
  return [0, third, seventh];
}
