/**
 * Pages that follow the playhead only need to redraw when what they show changes. Each display here
 * comes with its change points (the beats where it can change) and a step: equal steps mean an
 * identical view. Redrawing on every frame instead keeps a phone's main thread so busy that notes
 * reach the audio engine late (see useHeardBeat).
 */
import type { ChordSpan } from '@guitarpulse/core/coach/assess';
import { TICKS_PER_QUARTER, type TexEvent, type TexScore } from '@guitarpulse/core/tex/alphatex';
import type { ReplayNote } from './replay';

/** Sorted points in [0, length) where a span starts or ends. Empty spans are never shown, so they add none. */
function spanPoints(spans: [number, number][], length: number): number[] {
  const points = new Set([0]);
  for (const [start, end] of spans) {
    if (!(end > start)) continue;
    for (const p of [start, end]) if (p >= 0 && p < length) points.add(p);
  }
  return [...points].sort((a, b) => a - b);
}

/** Index of the last point at or before pos (points start at 0, pos is at least 0). */
function stepAt(points: number[], pos: number): number {
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/* ── Licks: the tab beat and the notes sounding ───────────────────────────────── */

export interface PlayheadView {
  /** Index of the tab beat under the playhead, or null. */
  activeBeat: number | null;
  /** Notes sounding on the neck. */
  sounding: { string: number; fret: number }[];
}

/** What the lick view highlights at a loop position (null when stopped or counting in). */
export function playheadView(score: TexScore, events: TexEvent[], pos: number | null): PlayheadView {
  if (pos === null) return { activeBeat: null, sounding: [] };
  const beat = score.beats.findIndex((b) => pos >= b.start / TICKS_PER_QUARTER && pos < (b.start + b.ticks) / TICKS_PER_QUARTER);
  return {
    activeBeat: beat === -1 ? null : beat,
    sounding: events.filter((e) => pos >= e.onsetBeat && pos < e.onsetBeat + e.durationBeats).map((e) => ({ string: e.string, fret: e.fret })),
  };
}

/** Where playheadView can change: where a tab beat or a note starts or ends. */
export function playheadPoints(score: TexScore, events: TexEvent[], lengthBeats: number): number[] {
  return spanPoints([...score.beats.map((b): [number, number] => [b.start / TICKS_PER_QUARTER, (b.start + b.ticks) / TICKS_PER_QUARTER]), ...events.map((e): [number, number] => [e.onsetBeat, e.onsetBeat + e.durationBeats])], lengthBeats);
}

/** The stretch between change points of a loop that holds the heard beat (-1 during the count-in). */
export function playheadStep(points: number[], lengthBeats: number, heard: number): number {
  return heard < 0 ? -1 : stepAt(points, heard % lengthBeats);
}

/* ── Chord strips: the chord under the playhead ───────────────────────────────── */

/** Index of the chord under the playhead, or -1 (stopped, counting in, or between chords). */
export function chordIndexAt(chords: ChordSpan[], loopBeats: number, beat: number | null): number {
  if (beat === null || beat < 0) return -1;
  const pos = ((beat % loopBeats) + loopBeats) % loopBeats;
  return chords.findIndex((c) => pos >= c.startBeat && pos < c.endBeat);
}

/** Where the chord under the playhead can change: where each chord starts and ends. Use with playheadStep. */
export function chordPoints(chords: ChordSpan[], loopBeats: number): number[] {
  return spanPoints(chords.map((c): [number, number] => [c.startBeat, c.endBeat]), loopBeats);
}

/** Like playheadStep, but each count-in beat is a step of its own, for a page that shows the count. */
export function countedStep(points: number[], lengthBeats: number, heard: number): number {
  return heard < 0 ? Math.floor(heard) - 1 : playheadStep(points, lengthBeats, heard);
}

/* ── Heatmap replay: rings on sounding notes, heat that grows while notes are held ─── */

const REPLAY_STEPS_PER_BEAT = 8;

/** Every note start and end (the rings), plus a grid of 1/8 beat so held notes warm up smoothly. */
export function replayPoints(notes: ReplayNote[], totalBeats: number): number[] {
  const points = new Set<number>();
  for (let i = 0; i <= Math.ceil(totalBeats * REPLAY_STEPS_PER_BEAT); i++) points.add(i / REPLAY_STEPS_PER_BEAT);
  for (const n of notes) {
    points.add(n.onsetBeat);
    points.add(n.onsetBeat + n.durationBeats);
  }
  return [...points].filter((p) => p >= 0).sort((a, b) => a - b);
}

/** The replay plays once, so the step is not loop-relative (-1 before it starts). */
export function replayStep(points: number[], heard: number): number {
  return heard < 0 ? -1 : stepAt(points, heard);
}
