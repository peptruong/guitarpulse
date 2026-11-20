/**
 * A small reader and writer for the alphaTex subset GuitarPulse licks use, so licks can be
 * analysed and transformed (lick mutator, fingering, heatmaps) without loading alphaTab.
 * Tests check it against alphaTab's own parser for every lick in the vault.
 *
 * Supported: `:N` durations (and `:N {tu 3}` defaults), `.N` per-beat durations (they persist,
 * as in alphaTab), notes `fret.string{effects}`, chords `( … )`, rests `r`, dead notes `x.s`,
 * ties `-.s`, beat effects `{tu 3 d tt s p gr}` after a beat, and bars `|`.
 */

export const TICKS_PER_QUARTER = 960;
export const TICKS_PER_WHOLE = 3840;

export type TexNoteKind = 'fretted' | 'dead' | 'tie';

export interface TexNote {
  /** Guitarist numbering: 1 = highest string. */
  string: number;
  fret: number;
  kind: TexNoteKind;
  /** Raw note effects without braces, e.g. "b (0 4) v". */
  effects: string;
}

export interface TexBeat {
  notes: TexNote[];
  rest: boolean;
  /** Note value: 1 whole, 2 half, 4 quarter, 8 eighth, 16, 32, 64. */
  duration: number;
  /** Tuplet numerator (3 for triplets) or null. */
  tuplet: number | null;
  dotted: boolean;
  /** Other beat effects, e.g. ["tt"] (tapping), ["s"] (slap), ["p"] (pop), ["gr"] (grace). */
  effects: string[];
  start: number; // ticks from the beginning
  ticks: number;
}

export interface TexScore {
  beats: TexBeat[];
  timeSignature: [number, number];
  barTicks: number;
  totalTicks: number;
}

const DURATIONS = [1, 2, 4, 8, 16, 32, 64];

export function beatTicks(duration: number, dotted: boolean, tuplet: number | null, grace = false) {
  if (grace) return 0;
  let t = TICKS_PER_WHOLE / duration;
  if (dotted) t *= 1.5;
  if (tuplet) {
    const fit = tuplet === 3 ? 2 : tuplet === 6 ? 4 : tuplet === 5 || tuplet === 7 ? 4 : tuplet === 9 ? 8 : tuplet - 1;
    t = (t * fit) / tuplet;
  }
  return t;
}

/** Reads one whitespace-separated item, keeping {…} and (…) groups (which may contain spaces) intact. */
function tokenize(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '|') {
      out.push('|');
      i++;
      continue;
    }
    let j = i;
    let brace = 0;
    let paren = 0;
    while (j < n) {
      const d = src[j];
      if (d === '{') brace++;
      else if (d === '}') brace--;
      else if (d === '(' && brace === 0) paren++;
      else if (d === ')' && brace === 0) paren--;
      if (brace === 0 && paren === 0 && (/\s/.test(d) || d === '|')) break;
      j++;
    }
    out.push(src.slice(i, j));
    i = j;
  }
  return out;
}

const NOTE_RE = /^(\d+|x|-)\.(\d+)(\{([^}]*)\})?$/;

function parseNoteWord(w: string): TexNote {
  const m = NOTE_RE.exec(w);
  if (!m) throw new Error(`Cannot read note "${w}"`);
  const kind: TexNoteKind = m[1] === 'x' ? 'dead' : m[1] === '-' ? 'tie' : 'fretted';
  return { string: Number(m[2]), fret: kind === 'fretted' ? Number(m[1]) : 0, kind, effects: (m[4] ?? '').trim() };
}

function parseBeatEffects(raw: string) {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  let tuplet: number | null = null;
  let dotted = false;
  const rest: string[] = [];
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t === 'tu') {
      tuplet = Number(tokens[++k]);
    } else if (t === 'd') dotted = true;
    else if (t === 'tp') rest.push(`tp ${tokens[++k]}`);
    else rest.push(t);
  }
  return { tuplet, dotted, rest };
}

export function parseAlphaTexBody(body: string, timeSignature: [number, number] = [4, 4]): TexScore {
  const tokens = tokenize(body);
  let ts = timeSignature;
  let duration = 4;
  let defaults = { tuplet: null as number | null, dotted: false, rest: [] as string[] };
  const beats: TexBeat[] = [];
  let pos = 0;
  let lastWasDuration = false;
  for (let k = 0; k < tokens.length; k++) {
    const tok = tokens[k];
    if (tok === '|') {
      lastWasDuration = false;
      continue;
    }
    if (tok === '\\ts') {
      ts = [Number(tokens[k + 1]), Number(tokens[k + 2])];
      k += 2;
      continue;
    }
    if (tok.startsWith(':')) {
      duration = Number(tok.slice(1));
      if (!DURATIONS.includes(duration)) throw new Error(`Bad duration "${tok}"`);
      defaults = { tuplet: null, dotted: false, rest: [] };
      lastWasDuration = true;
      continue;
    }
    if (tok.startsWith('{')) {
      const fx = parseBeatEffects(tok.slice(1, -1));
      if (lastWasDuration) {
        defaults = fx;
      } else {
        const b = beats[beats.length - 1];
        if (!b) throw new Error('Beat effects before any beat');
        if (fx.tuplet) b.tuplet = fx.tuplet;
        if (fx.dotted) b.dotted = true;
        b.effects.push(...fx.rest);
        pos -= b.ticks;
        b.ticks = beatTicks(b.duration, b.dotted, b.tuplet, b.effects.includes('gr'));
        pos += b.ticks;
      }
      lastWasDuration = false;
      continue;
    }
    lastWasDuration = false;
    // A beat: rest, single note or chord, with an optional ".N" duration.
    let notes: TexNote[] = [];
    let rest = false;
    let word = tok;
    let durPart: string | null = null;
    if (word.startsWith('(')) {
      const close = word.lastIndexOf(')');
      const inner = word.slice(1, close);
      const after = word.slice(close + 1);
      if (after) {
        if (!/^\.\d+$/.test(after)) throw new Error(`Cannot read chord "${tok}"`);
        durPart = after.slice(1);
      }
      notes = tokenize(inner).map(parseNoteWord);
    } else if (/^r(\.\d+)?$/.test(word)) {
      rest = true;
      durPart = word.length > 1 ? word.slice(2) : null;
    } else {
      // fret.string{fx}.dur — the optional ".N" comes after the string number and any braces.
      const parts = word.match(/^((?:\d+|x|-)\.\d+(?:\{[^}]*\})?)(?:\.(\d+))?$/);
      if (!parts) throw new Error(`Cannot read beat "${tok}"`);
      word = parts[1];
      durPart = parts[2] ?? null;
      notes = [parseNoteWord(word)];
    }
    if (durPart) {
      duration = Number(durPart);
      if (!DURATIONS.includes(duration)) throw new Error(`Bad duration in "${tok}"`);
    }
    const beat: TexBeat = {
      notes,
      rest,
      duration,
      tuplet: defaults.tuplet,
      dotted: defaults.dotted,
      effects: [...defaults.rest],
      start: pos,
      ticks: 0,
    };
    beat.ticks = beatTicks(beat.duration, beat.dotted, beat.tuplet, beat.effects.includes('gr'));
    beats.push(beat);
    pos += beat.ticks;
  }
  // Recompute starts (beat effects may have changed tick lengths after the fact).
  let t = 0;
  for (const b of beats) {
    b.start = t;
    t += b.ticks;
  }
  const barTicks = (ts[0] * TICKS_PER_WHOLE) / ts[1];
  return { beats, timeSignature: ts, barTicks, totalTicks: t };
}

/** Durations that can be written without tuplets, longest first: [ticks, value, dotted]. */
const WRITABLE: [number, number, boolean][] = [
  [3840, 1, false],
  [2880, 2, true],
  [1920, 2, false],
  [1440, 4, true],
  [960, 4, false],
  [720, 8, true],
  [480, 8, false],
  [360, 16, true],
  [240, 16, false],
  [120, 32, false],
  [60, 64, false],
];

/** Splits a tick length into writable note values (greedy). Throws if it cannot be written exactly. */
export function splitTicks(ticks: number): { duration: number; dotted: boolean; ticks: number }[] {
  const out: { duration: number; dotted: boolean; ticks: number }[] = [];
  let left = Math.round(ticks);
  for (const [t, d, dot] of WRITABLE) {
    while (left >= t) {
      out.push({ duration: d, dotted: dot, ticks: t });
      left -= t;
    }
  }
  if (left !== 0) throw new Error(`Cannot write ${ticks} ticks without tuplets`);
  return out;
}

function noteText(n: TexNote) {
  if (n.kind === 'dead') return `x.${n.string}`;
  if (n.kind === 'tie') return `-.${n.string}`;
  return `${n.fret}.${n.string}${n.effects ? `{${n.effects}}` : ''}`;
}

/**
 * Writes beats back to alphaTex with explicit durations on every beat and bar lines from the
 * time signature. Beats must not cross a bar line (split them with ties first).
 */
export function serializeAlphaTex(beats: TexBeat[], timeSignature: [number, number] = [4, 4]): string {
  const barTicks = (timeSignature[0] * TICKS_PER_WHOLE) / timeSignature[1];
  const parts: string[] = [];
  let pos = 0;
  for (const b of beats) {
    if (pos > 0 && pos % barTicks === 0 && b.ticks > 0) parts.push('|');
    const head = b.rest ? 'r' : b.notes.length === 1 ? noteText(b.notes[0]) : `(${b.notes.map(noteText).join(' ')})`;
    const fx = [...(b.tuplet ? [`tu ${b.tuplet}`] : []), ...(b.dotted ? ['d'] : []), ...b.effects];
    parts.push(`${head}.${b.duration}${fx.length ? ` {${fx.join(' ')}}` : ''}`);
    const end = pos + b.ticks;
    if (Math.floor(pos / barTicks) !== Math.floor((end - 1) / barTicks) && b.ticks > 0) throw new Error('A beat crosses a bar line; split it with a tie first.');
    pos = end;
  }
  if (pos % barTicks !== 0) throw new Error(`The last bar is incomplete (${(pos % barTicks) / TICKS_PER_QUARTER} beats).`);
  return parts.join(' ');
}

export interface TexEvent {
  midi: number;
  string: number;
  fret: number;
  /** Start and length in quarter-note beats. */
  onsetBeat: number;
  durationBeats: number;
  /** Highest bend in semitones (0 if none). */
  bendSemitones: number;
  effects: string;
  /** Index of the beat this note belongs to. */
  beat: number;
  harmonic: boolean;
}

const HARMONIC_OFFSET: Record<number, number> = { 12: 12, 7: 19, 19: 19, 5: 24, 24: 24, 4: 28, 9: 28, 16: 28 };

export function bendValues(effects: string): number[] {
  const m = /\bb\s*\(([^)]*)\)/.exec(effects);
  return m ? m[1].trim().split(/\s+/).map(Number) : [];
}

/** Sounding notes with pitches, using a tuning given lowest string first (MIDI). Ties extend the previous note. */
export function texEvents(score: TexScore, tuningLowToHigh: number[]): TexEvent[] {
  const n = tuningLowToHigh.length;
  const open = (s: number) => tuningLowToHigh[n - s];
  const out: TexEvent[] = [];
  const lastOnString = new Map<number, TexEvent>();
  score.beats.forEach((b, i) => {
    for (const note of b.notes) {
      if (note.kind === 'dead') continue;
      if (note.kind === 'tie') {
        const prev = lastOnString.get(note.string);
        if (prev) prev.durationBeats += b.ticks / TICKS_PER_QUARTER;
        continue;
      }
      const harmonic = /\bnh\b/.test(note.effects);
      const midi = harmonic && HARMONIC_OFFSET[note.fret] !== undefined ? open(note.string) + HARMONIC_OFFSET[note.fret] : open(note.string) + note.fret;
      const bends = bendValues(note.effects);
      const ev: TexEvent = {
        midi,
        string: note.string,
        fret: note.fret,
        onsetBeat: b.start / TICKS_PER_QUARTER,
        durationBeats: b.ticks / TICKS_PER_QUARTER,
        bendSemitones: bends.length ? Math.max(...bends) / 2 : 0,
        effects: note.effects,
        beat: i,
        harmonic,
      };
      out.push(ev);
      lastOnString.set(note.string, ev);
    }
  });
  return out;
}
