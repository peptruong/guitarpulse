import { parseChord } from '../theory/chords.js';
import { suggestScales } from '../theory/chordScale.js';
import { parseNote, pc } from '../theory/notes.js';
import { findScale, scalePcs } from '../theory/scales.js';
import { computeMetrics, METRIC_TARGETS, type ImprovMetrics, type NoteEvent, type TimedChord } from './metrics.js';

export interface ChordSpan {
  symbol: string;
  startBeat: number;
  endBeat: number;
  /** Optional scale id to judge against; otherwise the best-fitting scale is chosen. */
  scale?: string;
}

/** Healthy ranges used to judge a session. */
const RANGES: Record<string, { min?: number; max?: number; tip: string }> = {
  scaleAdherence: { min: 0.85, tip: 'Slow down and say each note’s degree as you play it; stay in one box until 9 notes in 10 fit.' },
  chordToneOnStrongBeats: { min: 0.5, tip: 'Before each chord change, aim for its 3rd on beat 1. Practise just the 3rds through the progression first.' },
  resolvedChromaticism: { min: 0.6, tip: 'Every outside note should step to a chord tone within one beat. Try enclosures: note above, note below, target.' },
  restRatio: { min: 0.25, max: 0.65, tip: 'Leave space: play 2 bars, rest 2 bars. Phrases breathe like sentences.' },
  meanPhraseBars: { min: 1, max: 4, tip: 'Aim for phrases of 1-2 bars, then a breath.' },
  phraseEndsOnChordTone: { min: 0.6, tip: 'End each phrase on a chord tone (root, 3rd or 5th) of the chord playing at that moment.' },
  repeatedMotifs: { min: 2, tip: 'Repeat a short idea, then change one thing (rhythm, octave or last note). Repetition makes a solo memorable.' },
  rangeSemitones: { min: 15, tip: 'Use at least two positions; slide between boxes instead of staying in one.' },
  rhythmicEntropyBits: { min: 1.5, tip: 'Mix rhythms: quarter notes, eighths, triplets and long held notes in one chorus.' },
  timingSdMs: { max: 30, tip: 'Play with a metronome on 2 and 4 at a slower tempo until notes land together with the click.' },
  bendAccuracyMeanCents: { max: 25, tip: 'Fret the target note first, then bend up to match it by ear.' },
};

/**
 * keyScale: the scale the player was asked to use over the whole tune (e.g. minor pentatonic over
 * a blues). Its notes then count as inside on every chord, on top of each chord's own best scale,
 * so the classic minor-pentatonic-over-dominant-chords sound is not marked as wrong.
 */
export function toTimedChords(spans: ChordSpan[], key?: string, keyScale?: string): TimedChord[] {
  if (!spans.length) throw new Error('Give at least one chord with start_beat and end_beat.');
  // Unique chords keep the analysis fast for long sessions (the progression repeats).
  const unique = [...new Set(spans.map((s) => s.symbol))];
  const advice = suggestScales(unique, key);
  const best = new Map(advice.chords.map((c, i) => [unique[i], c.scales[0]?.id ?? 'chromatic']));
  const keyRoot = key ? parseNote(key.trim().split(/\s+/)[0].replace(/m$/, '')) : null;
  const keyDef = keyScale ? findScale(keyScale) : undefined;
  if (keyScale && !keyDef) throw new Error(`Unknown scale "${keyScale}".`);
  const keyPcs = keyDef && keyRoot ? scalePcs(keyDef, keyRoot.pc) : [];
  return spans.map((s) => {
    const chord = parseChord(s.symbol);
    const scaleId = s.scale ?? best.get(s.symbol) ?? 'chromatic';
    const def = findScale(scaleId);
    if (!def) throw new Error(`Unknown scale "${s.scale}" for ${s.symbol}.`);
    const own = scalePcs(def, 0).map((p) => pc(p));
    const fromKey = keyPcs.map((p) => pc(p - chord.root.pc));
    return {
      startBeat: s.startBeat,
      endBeat: s.endBeat,
      rootPc: chord.root.pc,
      tones: chord.relPcs,
      scale: [...new Set([...own, ...fromKey])].sort((a, b) => a - b),
      symbol: s.symbol,
    };
  });
}

export function assessSession(notes: NoteEvent[], spans: ChordSpan[], bpm: number, totalBeats: number, key?: string, keyScale?: string) {
  const chords = toTimedChords(spans, key, keyScale);
  const metrics = computeMetrics(notes, chords, bpm, totalBeats);
  const verdicts = Object.entries(RANGES).map(([metric, r]) => {
    const value = metrics[metric as keyof ImprovMetrics] as number | null;
    let gap = 0;
    if (value === null || value === undefined) return { metric, label: METRIC_TARGETS[metric].label, value: null, status: 'not measured', gap: 0, tip: r.tip };
    if (r.min !== undefined && value < r.min) gap = (r.min - value) / Math.max(Math.abs(r.min), 1e-6);
    if (r.max !== undefined && value > r.max) gap = (value - r.max) / Math.max(Math.abs(r.max), 1e-6);
    const target = [r.min !== undefined ? `≥ ${r.min}` : '', r.max !== undefined ? `≤ ${r.max}` : ''].filter(Boolean).join(' and ');
    return { metric, label: METRIC_TARGETS[metric].label, value, status: gap > 0 ? `work on this (target ${target})` : 'good', gap, tip: r.tip };
  });
  const focus = [...verdicts].filter((v) => v.gap > 0).sort((a, b) => b.gap - a.gap)[0];
  return {
    metrics,
    verdicts: verdicts.map(({ gap: _gap, ...v }) => v),
    focus: focus ? { metric: focus.metric, label: focus.label, value: focus.value, exercise: focus.tip } : null,
    chords: chords.map((c) => ({ symbol: c.symbol, startBeat: c.startBeat, endBeat: c.endBeat })),
  };
}
