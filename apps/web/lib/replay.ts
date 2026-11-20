/**
 * Neck-heatmap replay: given the notes of a session with their fret positions, the state of the
 * neck at any beat. Heat accumulates by time held, so the replay shows where the hand lives.
 */
export interface ReplayNote {
  midi: number;
  onsetBeat: number;
  durationBeats: number;
  string: number;
  fret: number;
}

export interface ReplayCell {
  string: number;
  fret: number;
  /** 0-1, relative to the hottest cell so far. */
  heat: number;
  count: number;
  /** Sounding at this beat. */
  active: boolean;
}

export function replayFrame(notes: ReplayNote[], beat: number): ReplayCell[] {
  const cells = new Map<string, ReplayCell & { held: number }>();
  for (const n of notes) {
    if (n.onsetBeat > beat) break;
    const key = `${n.string}:${n.fret}`;
    const c = cells.get(key) ?? { string: n.string, fret: n.fret, heat: 0, count: 0, active: false, held: 0 };
    c.count++;
    c.held += Math.min(n.durationBeats, beat - n.onsetBeat) || 0.05;
    if (beat >= n.onsetBeat && beat < n.onsetBeat + n.durationBeats) c.active = true;
    cells.set(key, c);
  }
  const max = Math.max(0, ...[...cells.values()].map((c) => c.held));
  return [...cells.values()].map(({ held, ...c }) => ({ ...c, heat: max ? Math.round((held / max) * 100) / 100 : 0 }));
}

/** Notes must be sorted by onset for replayFrame; this sorts a copy. */
export function sortedForReplay(notes: ReplayNote[]): ReplayNote[] {
  return [...notes].sort((a, b) => a.onsetBeat - b.onsetBeat);
}

/** Lowest and highest fret used, padded to show some context. */
export function fretWindow(notes: ReplayNote[], pad = 2, minFrets = 12): { start: number; end: number } {
  if (!notes.length) return { start: 0, end: minFrets };
  const lo = Math.min(...notes.map((n) => n.fret));
  const hi = Math.max(...notes.map((n) => n.fret));
  let start = Math.max(0, lo - pad);
  let end = Math.min(24, hi + pad);
  if (end - start < minFrets) {
    end = Math.min(24, start + minFrets);
    start = Math.max(0, end - minFrets);
  }
  return { start, end };
}
