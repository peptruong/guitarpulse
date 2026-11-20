/**
 * Turn-taking for trading fours. Beats are counted from the first downbeat after the count-in,
 * across loops of the backing track. Window i covers beats [16i, 16i + 16).
 */
import type { NoteEvent } from '@guitarpulse/core/coach/metrics';

export const WINDOW_BEATS = 16;
export type Turn = 'you' | 'app';

export function windowIndex(beat: number): number {
  return Math.floor(beat / WINDOW_BEATS);
}

export function windowStart(index: number): number {
  return index * WINDOW_BEATS;
}

/** Who plays window i. The starter plays the even windows. */
export function turnFor(index: number, youStart: boolean): Turn {
  const starterTurn = index % 2 === 0;
  return starterTurn === youStart ? 'you' : 'app';
}

/** Notes that start inside window i, with a small allowance for playing a hair early. */
export function notesInWindow(notes: NoteEvent[], index: number, earlyAllowance = 0.25): NoteEvent[] {
  const start = windowStart(index) - earlyAllowance;
  const end = windowStart(index + 1) - earlyAllowance;
  return notes.filter((n) => n.onsetBeat >= start && n.onsetBeat < end);
}

/**
 * Beat (absolute) at which the answer to window i is computed and scheduled: three-quarters of a
 * beat before the window ends, so the first answer note is queued in time even at fast tempos.
 */
export function decisionBeat(index: number): number {
  return windowStart(index + 1) - 0.75;
}

/** Bar (1-4) inside the current window, or 0 during the count-in. */
export function barInWindow(beat: number): number {
  if (beat < 0) return 0;
  return Math.floor((beat % WINDOW_BEATS) / 4) + 1;
}
