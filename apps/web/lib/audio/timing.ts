/** Seconds ahead of the audio clock at which a late sound is started. */
export const LATE_MARGIN = 0.02;
/** Smallest step between two starts on one voice. */
const MIN_GAP = 0.001;

/**
 * When to start a sound the transport scheduled. Tone.js normally hands sounds over about 100 ms
 * early, but a busy main thread (a slow phone redrawing while it scrolls) can deliver one after its
 * time. Started in the past, Web Audio skips its attack and ramps and the jumps click, so a late
 * sound starts a moment from now instead, with its envelope intact.
 *
 * Pass the voice's previous start: when several late sounds for one voice arrive together, each still
 * starts strictly after the one before, because Tone.js rejects a start at the same time.
 */
export function startTime(scheduled: number, now: number, previous?: number): number {
  const t = Math.max(scheduled, now + LATE_MARGIN);
  return previous !== undefined && t <= previous ? previous + MIN_GAP : t;
}
