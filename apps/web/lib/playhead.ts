import { TICKS_PER_QUARTER, type TexEvent, type TexScore } from '@guitarpulse/core/tex/alphatex';

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

/** Loop positions (in beats, sorted) where playheadView can change: where a beat or note starts or ends. */
export function playheadPoints(score: TexScore, events: TexEvent[], lengthBeats: number): number[] {
  const spans = [...score.beats.map((b) => [b.start / TICKS_PER_QUARTER, (b.start + b.ticks) / TICKS_PER_QUARTER]), ...events.map((e) => [e.onsetBeat, e.onsetBeat + e.durationBeats])];
  const points = new Set([0]);
  for (const [start, end] of spans) {
    if (!(end > start)) continue; // never highlighted
    for (const p of [start, end]) if (p >= 0 && p < lengthBeats) points.add(p);
  }
  return [...points].sort((a, b) => a - b);
}

/**
 * The stretch between change points that holds the heard beat (-1 during the count-in). The view is the
 * same all through a stretch, so a page only needs to redraw when this number changes.
 */
export function playheadStep(points: number[], lengthBeats: number, heard: number): number {
  if (heard < 0) return -1;
  const pos = heard % lengthBeats;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
