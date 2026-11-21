/** Seconds ahead of the audio clock at which a late sound is started. */
export const LATE_MARGIN = 0.02;

/**
 * When to start a sound the transport scheduled. Tone.js normally hands sounds over about 100 ms
 * early, but a busy main thread (a slow phone redrawing while it scrolls) can deliver one after its
 * time. Started in the past, Web Audio skips its attack and ramps and the jumps click, so a late
 * sound starts a moment from now instead, with its envelope intact.
 */
export function startTime(scheduled: number, now: number): number {
  return Math.max(scheduled, now + LATE_MARGIN);
}
