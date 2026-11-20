/**
 * Tempo and key changes without side effects on each other.
 *
 * Bug fixed here: the blueprint changed tempo by resampling (playbackRate), which always shifts
 * pitch by 12·log2(rate) semitones: 25% faster is almost 4 semitones sharp, so the backing track
 * no longer matches the scale on screen. GuitarPulse now changes tempo in two correct ways:
 * - Generated (MIDI) tracks: only the transport tempo changes; note pitches are computed from
 *   MIDI numbers, so they cannot move.
 * - Recorded audio: a time-stretcher (Signalsmith Stretch) takes `rate` for speed and
 *   `semitones` for key as two independent controls.
 */

/** How many semitones plain resampling shifts the pitch by (the old behaviour). */
export const resamplingPitchShift = (rate: number) => 12 * Math.log2(rate);

export interface StretchSettings {
  /** Speed factor for the time-stretcher (1 = original). */
  rate: number;
  /** Pitch shift in semitones, independent of rate. */
  semitones: number;
}

/**
 * Settings for playing recorded audio at a new tempo and/or key.
 * Give either targetBpm with sourceBpm, or a speed percentage.
 */
export function stretchSettings(opts: { sourceBpm?: number; targetBpm?: number; speedPercent?: number; transpose?: number }): StretchSettings {
  let rate = 1;
  if (opts.sourceBpm && opts.targetBpm) rate = opts.targetBpm / opts.sourceBpm;
  else if (opts.speedPercent) rate = opts.speedPercent / 100;
  if (!(rate > 0.25 && rate <= 4)) throw new Error('Tempo change must be between 25% and 400% of the original.');
  return { rate, semitones: opts.transpose ?? 0 };
}

/** Quality note for a stretch factor: Signalsmith Stretch sounds best between 0.75x and 1.5x. */
export function stretchQuality(rate: number): 'clean' | 'audible artefacts likely' {
  return rate >= 0.75 && rate <= 1.5 ? 'clean' : 'audible artefacts likely';
}

/** Seconds per beat; generated tracks are scheduled in beats, so this is the only thing tempo changes. */
export const secondsPerBeat = (bpm: number) => 60 / bpm;
