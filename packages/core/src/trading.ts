/**
 * Trading fours: you play four bars, GuitarPulse answers with four bars built from your idea,
 * then you answer back.
 *
 * The answer takes the first short idea (motif) you played and develops it the way an
 * improviser would: state it over the next chord, then sequence, invert, displace, stretch or
 * fragment it, vary its ending, and finish by landing on the 3rd of the chord. Every note is
 * fitted to the chord sounding at that moment, and beats 1 and 3 always get chord tones.
 * `compareReply` then tells you how closely your reply picked up the answer's idea.
 */
import type { ChordSpan } from './coach/assess.js';
import type { NoteEvent } from './coach/metrics.js';
import { parseChord, type ParsedChord } from './theory/chords.js';
import { parseNote, pc, pcName, prefersFlats } from './theory/notes.js';
import { findScale, scalePcs } from './theory/scales.js';

export type Technique = 'sequence' | 'invert' | 'displace' | 'augment' | 'fragment';
export const TECHNIQUES: Technique[] = ['sequence', 'invert', 'displace', 'augment', 'fragment'];

export const TRADE_BARS = 4;
const WINDOW = TRADE_BARS * 4;

export interface TradeContext {
  /** Chord timeline in absolute beats (4/4); must cover the answer window. */
  chords: ChordSpan[];
  /** Beat where the answer starts (a bar line). */
  windowStart: number;
  /** Key and scale for the tune, e.g. "A" + "minor-pentatonic". */
  key: string;
  scale: string;
  /** Lowest and highest MIDI note the answer may use. */
  register?: [number, number];
  /** Which round this is; picks the development technique so answers vary. */
  round?: number;
  seed?: number;
}

export interface Motif {
  /** Semitones between consecutive notes. */
  intervals: number[];
  /** Start of each note relative to the first, in beats. */
  offsets: number[];
  durations: number[];
}

export interface TradeResponse {
  notes: NoteEvent[];
  technique: Technique;
  description: string;
  motif: Motif;
  /** True when the motif came from your playing, false when there was nothing to answer. */
  fromYou: boolean;
}

/** Small deterministic random generator (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const quantize = (x: number, grid: number) => Math.round(x / grid) * grid;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** The first short idea in a phrase: up to 5 notes within 3 beats, ending at the first real gap. */
export function extractMotif(notes: NoteEvent[]): Motif | null {
  const sorted = [...notes].sort((a, b) => a.onsetBeat - b.onsetBeat);
  if (sorted.length < 2) return null;
  const first: NoteEvent[] = [sorted[0]];
  for (let i = 1; i < sorted.length && first.length < 5; i++) {
    const prev = sorted[i - 1];
    if (sorted[i].onsetBeat - (prev.onsetBeat + prev.durationBeats) > 0.75 && first.length >= 3) break;
    if (sorted[i].onsetBeat - sorted[0].onsetBeat > 3) break;
    first.push(sorted[i]);
  }
  if (first.length < 2) return null;
  const rel = first.map((n) => n.onsetBeat - first[0].onsetBeat);
  // Use a triplet grid when it fits the timing clearly better than sixteenths.
  const err = (g: number) => sum(rel.map((x) => Math.abs(x - quantize(x, g))));
  const grid = err(1 / 3) < err(0.25) - 0.05 ? 1 / 3 : 0.25;
  const offsets = rel.map((x) => quantize(x, grid));
  for (let i = 1; i < offsets.length; i++) if (offsets[i] <= offsets[i - 1] + 1e-9) offsets[i] = offsets[i - 1] + grid;
  const durations = first.map((n, i) => {
    const room = i + 1 < offsets.length ? offsets[i + 1] - offsets[i] : 1;
    return Math.max(grid, Math.min(room, quantize(n.durationBeats, grid) || grid));
  });
  return { intervals: first.slice(1).map((n, i) => n.midi - first[i].midi), offsets, durations };
}

function inventMotif(rand: () => number): Motif {
  const cells = [
    { offsets: [0, 0.5, 1], durations: [0.5, 0.5, 1] },
    { offsets: [0, 0.75, 1.5], durations: [0.75, 0.75, 1] },
    { offsets: [0, 0.5, 1, 1.5], durations: [0.5, 0.5, 0.5, 1] },
    { offsets: [0, 1 / 3, 2 / 3, 1], durations: [1 / 3, 1 / 3, 1 / 3, 1] },
  ];
  const cell = cells[Math.floor(rand() * cells.length)];
  const moves = [-3, -2, 2, 3, 4, -5];
  const intervals = cell.offsets.slice(1).map(() => moves[Math.floor(rand() * moves.length)]);
  return { intervals, offsets: cell.offsets, durations: cell.durations };
}

/** Your four bars in, GuitarPulse's four bars out. */
export function respondTo(userNotes: NoteEvent[], ctx: TradeContext): TradeResponse {
  const round = ctx.round ?? 0;
  const rand = rng((ctx.seed ?? 7) + round * 101);
  const heard = extractMotif(userNotes);
  const motif = heard ?? inventMotif(rand);
  const technique = TECHNIQUES[round % TECHNIQUES.length];
  const firstNote = userNotes.length ? [...userNotes].sort((a, b) => a.onsetBeat - b.onsetBeat)[0].midi : null;
  const notes = develop(motif, technique, ctx, firstNote);
  return { notes, technique, motif, fromYou: heard !== null, description: describe(heard !== null, motif, technique, notes, ctx) };
}

/** The opening call when GuitarPulse starts the trade. */
export function createCall(ctx: TradeContext): TradeResponse {
  return respondTo([], ctx);
}

type Chord = ChordSpan & { parsed: ParsedChord };

function thirdOf(c: ParsedChord) {
  return c.third === '3' ? pc(c.root.pc + 4) : c.third === 'b3' ? pc(c.root.pc + 3) : c.root.pc;
}

function develop(motif: Motif, technique: Technique, ctx: TradeContext, userStart: number | null): NoteEvent[] {
  const start = ctx.windowStart;
  const end = start + WINDOW;
  const [low, high] = ctx.register ?? [55, 81];
  const root = parseNote(ctx.key);
  const scaleDef = findScale(ctx.scale);
  if (!root) throw new Error(`Unknown key "${ctx.key}".`);
  if (!scaleDef) throw new Error(`Unknown scale "${ctx.scale}".`);
  if (!ctx.chords.length) throw new Error('Trading needs at least one chord.');
  const keyPcs = new Set(scalePcs(scaleDef, root.pc));
  const chords: Chord[] = ctx.chords.map((c) => ({ ...c, parsed: parseChord(c.symbol) }));
  const chordAt = (beat: number) => chords.find((c) => beat >= c.startBeat && beat < c.endBeat) ?? (beat < chords[0].startBeat ? chords[0] : chords[chords.length - 1]);

  // Strong beats get chord tones. Elsewhere: chord tones plus scale notes that do not sit a half
  // step above a chord tone (the classic "avoid note" clash).
  const allowedAt = (beat: number, strong: boolean) => {
    const c = chordAt(beat).parsed;
    const ok = new Set(c.pcs);
    if (!strong) for (const p of keyPcs) if (!c.pcs.includes(pc(p - 1))) ok.add(p);
    return ok;
  };
  const snap = (midi: number, beat: number, strong: boolean, dir: number) => {
    const allowed = allowedAt(beat, strong);
    for (let d = 0; d <= 6; d++) {
      const order = dir >= 0 ? [midi + d, midi - d] : [midi - d, midi + d];
      for (const m of order) if (allowed.has(pc(m))) return m;
    }
    return midi;
  };
  const nearest = (target: number, pcs: number[]) => {
    let best = target;
    let bestD = 99;
    for (let m = target - 6; m <= target + 6; m++) {
      if (pcs.includes(pc(m)) && Math.abs(m - target) < bestD) {
        bestD = Math.abs(m - target);
        best = m;
      }
    }
    return best;
  };
  const fit = (m: number) => {
    while (m < low) m += 12;
    while (m > high) m -= 12;
    return m;
  };

  const out: NoteEvent[] = [];
  const place = (offsets: number[], durations: number[], intervals: number[], barStart: number, startPitch: number) => {
    let pitch = startPitch;
    offsets.forEach((o, i) => {
      if (i > 0) pitch += intervals[i - 1];
      const beat = barStart + o;
      if (beat >= end) return;
      const inBar = beat - barStart;
      const strong = Math.abs(inBar - Math.round(inBar)) < 1e-6 && Math.round(inBar) % 2 === 0;
      const prev = out[out.length - 1];
      const dir = i > 0 ? Math.sign(intervals[i - 1]) : 0;
      let m = snap(pitch, beat, strong, dir);
      // Fitting to the chord must not reverse the direction of the original idea.
      if (prev && dir !== 0 && Math.sign(m - prev.midi) !== dir) m = snap(prev.midi + dir * 2, beat, strong, dir);
      m = fit(m);
      if (prev && Math.abs(m - prev.midi) > 9) m = fit(m + (m > prev.midi ? -12 : 12));
      out.push({ midi: m, onsetBeat: beat, durationBeats: Math.min(durations[i], end - beat) });
      pitch = m;
    });
  };

  const c1 = chordAt(start).parsed;
  const center = Math.round((low + high) / 2);
  const opening = Math.min(high - 7, Math.max(low + 5, userStart ?? center));
  const anchor = fit(nearest(opening, [thirdOf(c1), c1.root.pc]));

  // Bar 1: statement.
  place(motif.offsets, motif.durations, motif.intervals, start, anchor);

  // Bar 2: development.
  const bar2 = start + 4;
  const c2 = chordAt(bar2).parsed;
  const from2 = fit(nearest(out[out.length - 1]?.midi ?? anchor, c2.pcs));
  if (technique === 'sequence') {
    const step = sum(motif.intervals) > 0 ? -2 : 2;
    place(motif.offsets, motif.durations, motif.intervals, bar2, fit(nearest(anchor + step, [thirdOf(c2), ...c2.pcs])));
  } else if (technique === 'invert') {
    place(motif.offsets, motif.durations, motif.intervals.map((x) => -x), bar2, from2);
  } else if (technique === 'displace') {
    place(motif.offsets.map((o) => o + 0.5), motif.durations, motif.intervals, bar2, from2);
  } else if (technique === 'augment') {
    const factor = [2, 1.5, 1].find((f) => motif.offsets[1] * f < 4)!;
    const keep = motif.offsets.filter((o) => o * factor < 4).length;
    place(
      motif.offsets.slice(0, keep).map((o) => o * factor),
      motif.durations.slice(0, keep).map((d) => d * factor),
      motif.intervals.slice(0, keep - 1),
      bar2,
      from2,
    );
  } else {
    // Fragment: the first two or three notes, played twice, two beats apart.
    let k = Math.min(3, motif.offsets.length);
    while (k > 2 && motif.offsets[k - 1] + motif.durations[k - 1] > 2) k--;
    let fo = motif.offsets.slice(0, k);
    let fd = motif.durations.slice(0, k);
    if (fo[k - 1] + fd[k - 1] > 2) {
      fo = [0, 1];
      fd = [1, 1];
    }
    const fi = motif.intervals.slice(0, k - 1);
    place([...fo, ...fo.map((o) => o + 2)], [...fd, ...fd], [...fi, -sum(fi), ...fi], bar2, from2);
  }

  // Bar 3: variation: same rhythm, last move turned around, aimed at bar 4's chord.
  const bar3 = start + 8;
  const c3 = chordAt(bar3).parsed;
  const varied = [...motif.intervals];
  if (varied.length) varied[varied.length - 1] = -varied[varied.length - 1];
  place(motif.offsets, motif.durations, varied, bar3, fit(nearest(out[out.length - 1]?.midi ?? anchor, [thirdOf(c3), ...c3.pcs])));

  // Bar 4: cadence: a step into the 3rd of the chord on beat 1, held for two beats.
  const bar4 = start + 12;
  const c4 = chordAt(bar4).parsed;
  const last = out[out.length - 1]?.midi ?? anchor;
  const target = fit(nearest(last, [thirdOf(c4)]));
  const approachDir = last > target ? -1 : 1;
  if (!out.some((n) => n.onsetBeat >= bar4 - 0.5 - 1e-9)) out.push({ midi: snap(target - approachDir * 2, bar4 - 0.5, false, -approachDir), onsetBeat: bar4 - 0.5, durationBeats: 0.5 });
  out.push({ midi: target, onsetBeat: bar4, durationBeats: 2 });

  // One note at a time: drop duplicates, cut each note where the next one starts.
  out.sort((a, b) => a.onsetBeat - b.onsetBeat);
  const cleaned = out.filter((n, i) => n.onsetBeat < end && (i === 0 || n.onsetBeat > out[i - 1].onsetBeat + 1e-6));
  for (let i = 0; i + 1 < cleaned.length; i++) cleaned[i].durationBeats = Math.min(cleaned[i].durationBeats, cleaned[i + 1].onsetBeat - cleaned[i].onsetBeat);
  return cleaned;
}

const SAY: Record<Technique, string> = {
  sequence: 'moved it to a new starting note',
  invert: 'flipped it upside down',
  displace: 'started it an eighth note later',
  augment: 'stretched it out in time',
  fragment: 'chopped it down to its first notes and repeated them',
};

const shapeWords = (intervals: number[]) => intervals.map((i) => (i > 0 ? 'up' : i < 0 ? 'down' : 'same')).join(', ');

function describe(fromYou: boolean, motif: Motif, technique: Technique, notes: NoteEvent[], ctx: TradeContext) {
  const last = notes[notes.length - 1];
  const root = parseNote(ctx.key)!;
  const lastChord = ctx.chords.find((c) => last.onsetBeat >= c.startBeat && last.onsetBeat < c.endBeat) ?? ctx.chords[ctx.chords.length - 1];
  const name = pcName(last.midi, prefersFlats(root));
  const size = motif.intervals.length + 1;
  const lead = fromYou ? `I took your ${size}-note idea (${shapeWords(motif.intervals)})` : `Here is a ${size}-note idea (${shapeWords(motif.intervals)}) for you to answer`;
  return `${lead}, ${SAY[technique]} in bar 2, turned its ending around in bar 3, and landed on ${name} over ${lastChord.symbol} in bar 4.`;
}

export interface ReplyFeedback {
  /** Share of the call's rhythm you reused, 0-1. */
  rhythm: number;
  /** Share of the call's up/down shape you reused, 0-1. */
  contour: number;
  /** Did your last note land on a chord tone? */
  landedOnChordTone: boolean;
  /** Share of the four bars you left silent, 0-1. */
  space: number;
  comment: string;
}

/** How closely your reply picked up the idea GuitarPulse played. */
export function compareReply(call: Motif, reply: NoteEvent[], chords: ChordSpan[], windowStart: number): ReplyFeedback {
  const sorted = [...reply].sort((a, b) => a.onsetBeat - b.onsetBeat).filter((n) => n.onsetBeat >= windowStart - 0.25 && n.onsetBeat < windowStart + WINDOW);
  if (!sorted.length) return { rhythm: 0, contour: 0, landedOnChordTone: false, space: 1, comment: 'I did not hear a reply. Play anything back, even two notes; answering is the skill.' };
  const mine = extractMotif(sorted);
  let rhythm = 0;
  let contour = 0;
  if (mine) {
    const hits = call.offsets.filter((o) => mine.offsets.some((m) => Math.abs(m - o) <= 0.13)).length;
    rhythm = Math.round((hits / Math.max(call.offsets.length, mine.offsets.length)) * 100) / 100;
    const n = Math.min(call.intervals.length, mine.intervals.length);
    const same = call.intervals.slice(0, n).filter((x, i) => Math.sign(x) === Math.sign(mine.intervals[i])).length;
    contour = Math.round((same / Math.max(call.intervals.length, 1)) * 100) / 100;
  }
  const last = sorted[sorted.length - 1];
  const lastChord = chords.find((c) => last.onsetBeat >= c.startBeat && last.onsetBeat < c.endBeat) ?? chords[chords.length - 1];
  const landedOnChordTone = parseChord(lastChord.symbol).pcs.includes(pc(last.midi));
  const sounding = sum(sorted.map((n) => Math.min(n.durationBeats, windowStart + WINDOW - n.onsetBeat)));
  const space = Math.round(Math.max(0, 1 - sounding / WINDOW) * 100) / 100;

  const parts: string[] = [];
  if (rhythm >= 0.6 && contour >= 0.6) parts.push('You echoed my idea closely. Next time keep the rhythm and change the notes, or keep the notes and change the rhythm.');
  else if (rhythm >= 0.6) parts.push('You kept my rhythm and found your own notes. That is real conversation.');
  else if (contour >= 0.6) parts.push('You kept the shape of my line in a new rhythm. Nice development.');
  else parts.push('Your reply went its own way. Try starting with my rhythm, then bend it into your idea.');
  parts.push(landedOnChordTone ? `You ended on a chord tone of ${lastChord.symbol}, so the phrase sounds finished.` : `Your last note was not in ${lastChord.symbol}; end on its 3rd or root to close the phrase.`);
  if (space < 0.2) parts.push('You filled almost every beat. Leave a gap so the band can breathe.');
  return { rhythm, contour, landedOnChordTone, space, comment: parts.join(' ') };
}
