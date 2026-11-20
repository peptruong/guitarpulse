/**
 * Song to practice: type a song's chords and get a backing-track timeline, the key, the scale for
 * every chord, the 3rd/7th line to aim for, and a named progression when it is a well-known one.
 * Only chord names are needed, so no copyrighted audio or tab is involved.
 */
import { parseChord } from './theory/chords.js';
import { suggestScales, type ProgressionAdvice } from './theory/chordScale.js';
import { parseNote, pc, spellDegree } from './theory/notes.js';
import { findScale, scalePcs } from './theory/scales.js';

export interface ChartChord {
  symbol: string;
  startBeat: number;
  endBeat: number;
  bar: number;
}

export interface ChartError {
  bar: number;
  token: string;
  message: string;
}

export interface ParsedChart {
  chords: ChartChord[];
  bars: number;
  beatsPerBar: number;
  errors: ChartError[];
}

/**
 * Reads a chord chart. Bars are separated by "|" or new lines. Inside a bar, chords share the beats
 * evenly, "/" repeats the previous chord for one beat, "%" repeats the previous bar, "N.C." is
 * silence, and "x2" (or "x3"…) at the end of a line repeats that line.
 */
export function parseChordChart(text: string, beatsPerBar = 4): ParsedChart {
  const errors: ChartError[] = [];
  const bars: string[][] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.replace(/\[[^\]]*\]/g, ' ').trim(); // drop section labels like [Chorus]
    if (!line) continue;
    let repeat = 1;
    const rep = /\s*[x×](\d+)\s*$/i.exec(line);
    if (rep) {
      repeat = Math.min(8, Number(rep[1]));
      line = line.slice(0, rep.index);
    }
    const cells = line.includes('|') ? line.split('|') : [line];
    const lineBars: string[][] = [];
    for (const cell of cells) {
      const tokens = cell.trim().split(/[\s,]+/).filter(Boolean);
      if (!tokens.length) continue;
      if (tokens.length === 1 && tokens[0] === '%') {
        const prev = lineBars[lineBars.length - 1] ?? bars[bars.length - 1];
        if (prev) lineBars.push([...prev]);
        continue;
      }
      if (line.includes('|')) lineBars.push(tokens);
      else for (const t of tokens) lineBars.push([t]); // "Am F C G" = one chord per bar
    }
    for (let r = 0; r < repeat; r++) bars.push(...lineBars.map((b) => [...b]));
  }
  const chords: ChartChord[] = [];
  bars.forEach((tokens, i) => {
    const slots: (string | null)[] = [];
    if (tokens.some((t) => t === '/')) {
      let last: string | null = null;
      for (const t of tokens) {
        if (t === '/') slots.push(last);
        else {
          last = t;
          slots.push(t);
        }
      }
    } else slots.push(...tokens);
    const per = beatsPerBar / slots.length;
    slots.forEach((tok, k) => {
      if (tok === null) return;
      const start = i * beatsPerBar + k * per;
      if (/^(n\.?c\.?|-)$/i.test(tok)) return;
      try {
        parseChord(tok);
      } catch {
        errors.push({ bar: i + 1, token: tok, message: `Bar ${i + 1}: cannot read "${tok}". Try forms like Am7, D7, Gmaj7, F#m7b5, Bb/D.` });
        return;
      }
      const prev = chords[chords.length - 1];
      if (prev && prev.symbol === tok && prev.endBeat === start && tokens.some((t) => t === '/')) prev.endBeat = start + per;
      else chords.push({ symbol: tok, startBeat: start, endBeat: start + per, bar: i + 1 });
    });
  });
  return { chords, bars: bars.length, beatsPerBar, errors };
}

const MAJOR_TRIADS = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'];
const MINOR_TRIADS = ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'];

function triadKind(symbol: string): 'maj' | 'min' | 'dim' | 'other' {
  const c = parseChord(symbol);
  if (c.quality === 'maj' || c.quality === 'dom' || c.quality === 'aug') return 'maj';
  if (c.quality === 'min' || c.quality === 'mMaj') return 'min';
  if (c.quality === 'dim' || c.quality === 'hdim') return 'dim';
  return 'other';
}

export interface KeyGuess {
  key: string;
  tonic: string;
  mode: 'major' | 'minor';
  confidence: number;
  alternatives: string[];
}

/** Scores all 24 major and minor keys against the chords (weighted by length) and picks the best. */
export function detectKey(chords: { symbol: string; startBeat?: number; endBeat?: number }[]): KeyGuess {
  if (!chords.length) throw new Error('No chords to find a key from.');
  const parsed = chords.map((c) => ({ c: parseChord(c.symbol), w: c.endBeat !== undefined && c.startBeat !== undefined ? Math.max(0.5, (c.endBeat - c.startBeat) / 4) : 1, kind: triadKind(c.symbol) }));
  const scores: { tonic: number; mode: 'major' | 'minor'; score: number }[] = [];
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ['major', 'minor'] as const) {
      const steps = mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
      const triads = mode === 'major' ? MAJOR_TRIADS : MINOR_TRIADS;
      const pcs = new Set(steps.map((s) => pc(tonic + s)));
      if (mode === 'minor') pcs.add(pc(tonic + 11)); // harmonic minor's raised 7th (V7 in minor)
      let score = 0;
      for (const { c, w, kind } of parsed) {
        const inKey = c.pcs.filter((p) => pcs.has(p)).length / c.pcs.length;
        score += w * inKey;
        const deg = steps.indexOf(pc(c.root.pc - tonic));
        if (deg >= 0) {
          score += 0.5 * w;
          if (kind === triads[deg] || (mode === 'minor' && deg === 4 && kind === 'maj')) score += 0.5 * w;
        }
        // A dominant 7th on the 5th degree is the strongest single clue to a key.
        if (c.quality === 'dom' && pc(c.root.pc - tonic) === 7) score += 1;
      }
      const first = parsed[0];
      const last = parsed[parsed.length - 1];
      const tonicKind = mode === 'major' ? 'maj' : 'min';
      if (first.c.root.pc === tonic && (first.kind === tonicKind || first.kind === 'other' || first.c.quality === 'dom')) score += 1.5;
      if (last.c.root.pc === tonic && last.c.quality !== 'dom' && (last.kind === tonicKind || last.kind === 'other')) score += 1;
      if (parsed.length >= 2) {
        const pen = parsed[parsed.length - 2];
        if (pc(pen.c.root.pc - tonic) === 7 && pen.kind === 'maj' && last.c.root.pc === tonic) score += 1; // V → I cadence
      }
      scores.push({ tonic, mode, score: Math.round(score * 1000) / 1000 });
    }
  }
  scores.sort((a, b) => b.score - a.score || (a.mode === 'major' ? -1 : 1));
  const name = (s: { tonic: number; mode: 'major' | 'minor' }) => {
    const firstMatch = parsed.find((p) => p.c.root.pc === s.tonic)?.c.root.name;
    const tonicName = firstMatch ?? (s.mode === 'major' ? ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] : ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'])[s.tonic];
    return { tonic: tonicName, label: `${tonicName} ${s.mode}` };
  };
  const best = name(scores[0]);
  return {
    key: best.label,
    tonic: best.tonic,
    mode: scores[0].mode,
    confidence: Math.round(Math.min(1, (scores[0].score - scores[1].score) / 3) * 100) / 100,
    alternatives: scores.slice(1, 3).map((s) => name(s).label),
  };
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/**
 * Roman numeral to chord symbol in a key: "IVmaj7" in C = "Fmaj7", "vi7" = "Am7", "bVII" = "Bb",
 * "iiø7" = "Dm7b5", "vii°" = "Bdim", "V7/IV" style secondary chords are not supported.
 * Numerals are measured from the major scale, so minor-key chords use flats (i, bIII, bVI, bVII).
 * A "/n" suffix with a numeral gives a slash chord: "I/V" = "C/G".
 */
export function romanToChord(numeral: string, key: string): string {
  const m = /^(b|#)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(.*)$/.exec(numeral.trim());
  if (!m) throw new Error(`Cannot read Roman numeral "${numeral}".`);
  const keyRoot = parseNote(key.trim().split(/\s+/)[0]);
  if (!keyRoot) throw new Error(`Unknown key "${key}".`);
  const [, acc = '', roman, rawSuffix] = m;
  const upper = roman === roman.toUpperCase();
  const deg = NUMERALS.indexOf(roman.toUpperCase()) + 1;
  let suffix = rawSuffix;
  let bass = '';
  const slash = /\/((?:b|#)?(?:VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i))$/.exec(suffix);
  if (slash) {
    bass = '/' + romanToChord(slash[1], key).replace(/m.*$|[^A-G#b].*$/, '');
    suffix = suffix.slice(0, slash.index);
  }
  const label = `${acc}${deg}`;
  const rootName = spellDegree(keyRoot, label);
  if (suffix === '5') return `${rootName}5${bass}`; // power chord: no 3rd, so case does not matter
  if (!upper) {
    if (suffix.startsWith('ø')) suffix = 'm7b5';
    else if (suffix.startsWith('°')) suffix = suffix === '°7' ? 'dim7' : 'dim';
    else if (!suffix.startsWith('m') && !suffix.startsWith('dim')) suffix = `m${suffix}`;
  } else if (suffix === '°') suffix = 'dim';
  return `${rootName}${suffix}${bass}`;
}

export function romanProgression(text: string, key: string): string[] {
  return text.trim().split(/\s+/).map((r) => romanToChord(r, key));
}

/** The chord's Roman numeral in a key (for naming progressions). */
export function chordToRoman(symbol: string, keyTonic: string): string {
  const c = parseChord(symbol);
  const t = parseNote(keyTonic)!;
  const rel = pc(c.root.pc - t.pc);
  const table: Record<number, string> = { 0: 'I', 1: 'bII', 2: 'II', 3: 'bIII', 4: 'III', 5: 'IV', 6: '#IV', 7: 'V', 8: 'bVI', 9: 'VI', 10: 'bVII', 11: 'VII' };
  let r = table[rel];
  const minorish = c.quality === 'min' || c.quality === 'hdim' || c.quality === 'dim' || c.quality === 'mMaj';
  if (minorish) r = r.replace(/[IV]+/, (x) => x.toLowerCase());
  const ext = c.quality === 'hdim' ? 'ø7' : c.quality === 'dim' ? '°' : c.seventh === '7' && c.quality !== 'mMaj' ? 'maj7' : c.seventh === 'b7' ? '7' : '';
  return r + ext;
}

const NAMED: { name: string; pattern: string[]; about: string }[] = [
  { name: 'Royal road (J-pop "ōdō shinkō")', pattern: ['IVmaj7', 'V7', 'iii7', 'vi'], about: 'The most common J-pop and city-pop progression; target the 3rd of each chord.' },
  { name: 'Royal road (J-pop "ōdō shinkō")', pattern: ['IV', 'V', 'iii', 'vi'], about: 'The most common J-pop and city-pop progression; target the 3rd of each chord.' },
  { name: '"Just the Two of Us" progression (丸サ in Japan)', pattern: ['IVmaj7', 'III7', 'vi7'], about: 'The III7 borrows a G# (in C): play the harmonic-minor sound over it.' },
  { name: 'Komuro progression', pattern: ['vi', 'IV', 'V', 'I'], about: '1990s J-pop staple; minor pentatonic of vi works over all of it.' },
  { name: 'Axis (pop) progression', pattern: ['I', 'V', 'vi', 'IV'], about: 'Major pentatonic of I fits every chord.' },
  { name: 'ii–V–I', pattern: ['ii7', 'V7', 'Imaj7'], about: 'The jazz cadence: follow the 7th of each chord down a half step to the next 3rd.' },
  { name: 'Andalusian cadence', pattern: ['i', 'bVII', 'bVI', 'V'], about: 'Flamenco: use Phrygian dominant over the last chord.' },
  { name: '12-bar blues', pattern: ['I7', 'IV7', 'I7', 'V7'], about: 'Minor pentatonic over everything, major pentatonic over the I7.' },
  { name: 'Neo-soul IV–iii–vi', pattern: ['IVmaj7', 'iii7', 'vi7'], about: 'Rich 9ths and 11ths; play dyads and leave space.' },
];

/** Finds a well-known progression anywhere in the chords, in any key (e.g. "Just the Two of Us" is IV-based). */
export function nameProgression(symbols: string[], keyTonic?: string): { name: string; about: string } | null {
  const loose = (r: string) => r.replace(/maj7|7|°|ø7/g, '');
  const tonics = [...(keyTonic ? [keyTonic] : []), 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  for (const n of NAMED) {
    for (const tonic of tonics) {
      const romans = symbols.map((s) => chordToRoman(s, tonic));
      for (let start = 0; start + n.pattern.length <= romans.length; start++) {
        const slice = romans.slice(start, start + n.pattern.length);
        if (slice.every((r, i) => r === n.pattern[i] || loose(r) === loose(n.pattern[i]))) return { name: n.name, about: n.about };
      }
    }
  }
  return null;
}

export interface SongPractice {
  key: KeyGuess;
  chart: ParsedChart;
  advice: ProgressionAdvice;
  named: { name: string; about: string } | null;
  /** One scale per chord change, in timeline order. */
  timeline: (ChartChord & { scale: string; scaleNotes: string[]; guideTones: string[] })[];
  lengthBeats: number;
  focus: string;
}

export function songToPractice(text: string, opts: { key?: string; beatsPerBar?: number } = {}): SongPractice {
  const chart = parseChordChart(text, opts.beatsPerBar ?? 4);
  if (!chart.chords.length) throw new Error(chart.errors[0]?.message ?? 'No chords found. Type chords like: | Am7 | D7 | Gmaj7 | Cmaj7 |');
  const key: KeyGuess = opts.key
    ? (() => {
        const [t, ...rest] = opts.key.trim().split(/\s+/);
        const minor = /^m(in(or)?)?$/i.test(rest[0] ?? '') || /m$/.test(t);
        const tonic = t.replace(/m$/, '');
        return { key: `${tonic} ${minor ? 'minor' : 'major'}`, tonic, mode: minor ? 'minor' : 'major', confidence: 1, alternatives: [] };
      })()
    : detectKey(chart.chords);
  const unique: string[] = [];
  for (const c of chart.chords) if (unique[unique.length - 1] !== c.symbol) unique.push(c.symbol);
  const advice = suggestScales(unique.slice(0, 32), key.key, true);
  const bySymbol = new Map(advice.chords.map((c) => [c.chord, c]));
  const timeline = chart.chords.map((c) => {
    const a = bySymbol.get(c.symbol)!;
    return { ...c, scale: a.scales[0]?.scale ?? '', scaleNotes: a.scales[0]?.notes ?? [], guideTones: a.guideTones };
  });
  const named = nameProgression(unique, key.tonic);
  const outside = chart.chords.filter((c) => {
    const tonic = parseNote(key.tonic)!;
    const pcs = new Set(scalePcs(findScale(key.mode === 'major' ? 'ionian' : 'aeolian')!, tonic.pc));
    return !parseChord(c.symbol).pcs.every((p) => pcs.has(p));
  });
  const focus = outside.length
    ? `Most chords fit ${key.key}, but ${[...new Set(outside.map((c) => c.symbol))].slice(0, 3).join(', ')} leave the key: switch to the suggested scale on those chords and aim for their 3rds.`
    : `Every chord fits ${key.key}. Start with the pentatonic scale over everything, then aim for each chord's 3rd on beat 1.`;
  return { key, chart, advice, named, timeline, lengthBeats: chart.bars * chart.beatsPerBar, focus };
}

/** Spells a degree of the key, e.g. for showing the tonic's scale. */
export function keyNotes(tonic: string, mode: 'major' | 'minor') {
  const t = parseNote(tonic)!;
  const def = findScale(mode === 'major' ? 'ionian' : 'aeolian')!;
  return def.degrees.map((d) => spellDegree(t, d));
}

