/**
 * Turns a stream of audio frames into timed notes.
 *
 * Bug fixed here: the blueprint logged only a pitch-class name per animation frame, with a
 * wall-clock timestamp, and dropped repeated notes. This tracker keeps, for every note:
 * the MIDI number (so the octave), the onset time on the audio clock, the duration, how far it
 * was bent, and how loud it was. Repeated notes are split by their pick attack, hammer-ons and
 * pull-offs by an abrupt pitch jump, while bends and vibrato (gradual pitch changes) stay one note.
 *
 * It is pure and synchronous, so it runs the same in the browser (fed by an AudioWorklet) and in
 * Node tests (fed by synthesised guitar audio).
 */
import { PitchDetector } from 'pitchy';

export interface TrackedNote {
  midi: number;
  /** Tuning offset of the note's settled pitch, in cents (-50..50). */
  cents: number;
  /** Audio-clock time (seconds) when the note started. */
  onsetTime: number;
  /** Audio-clock time (seconds) when the note stopped sounding. */
  endTime: number;
  duration: number;
  /** Highest upward bend reached, in cents above the settled pitch (0 if none). */
  peakBendCents: number;
  /** Loudness of the attack (dBFS, roughly -60 quiet … 0 very loud). */
  levelDb: number;
}

export type TrackerEvent = { type: 'on'; note: TrackedNote } | { type: 'off'; note: TrackedNote };

export interface TrackerOptions {
  sampleRate: number;
  /** Samples per analysis frame (2048 at 44.1/48 kHz covers drop-C at 65 Hz). */
  frameSize?: number;
  /** Samples between frames (the worklet posts a frame every hop). */
  hopSize?: number;
  /** Lowest and highest pitch accepted. Defaults cover drop C (65 Hz) to fret 24 on high E (1319 Hz). */
  minHz?: number;
  maxHz?: number;
  /** pitchy clarity needed to accept a pitch (0-1). */
  minClarity?: number;
  /** Frames quieter than this (dBFS) count as silence. */
  silenceDb?: number;
  /** Rise in loudness of the newest hop (dB) that counts as a new pick attack. */
  attackDb?: number;
  /** A jump of at least this many semitones between frames is a new note (hammer-on, pull-off, slide step). */
  jumpSemitones?: number;
  /** Largest upward glide still treated as a bend of the same note. */
  maxBendSemitones?: number;
  /** Silence longer than this ends the note (ms). */
  releaseMs?: number;
  /** Notes shorter than this are discarded as noise (ms). */
  minNoteMs?: number;
}

type Detector = (frame: Float32Array, sampleRate: number) => [number, number];

interface Current {
  base: number; // settled pitch (float MIDI)
  onsetTime: number;
  lastVoicedTime: number;
  /** End of the last hop that was still clearly sounding: the note's end if it dies away. */
  lastLoudTime: number;
  /** First frame where the pitch left the note (or went unclear) without coming back. */
  disturbedSince: number | null;
  peakBend: number; // semitones above base
  levelDb: number;
  confirmed: boolean;
  samples: number[]; // pitches collected before confirmation
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);

export class NoteTracker {
  readonly opts: Required<TrackerOptions>;
  private detect: Detector;
  private current: Current | null = null;
  private recent: number[] = [];
  private lastHopDb = -120;
  private lastAttackTime = -1;
  private lastSmoothed: number | null = null;
  private jumpCandidate: { pitch: number; time: number; frames: number } | null = null;

  constructor(options: TrackerOptions, detector?: Detector) {
    this.opts = {
      frameSize: 2048,
      hopSize: 512,
      minHz: 60,
      maxHz: 1400,
      minClarity: 0.88,
      silenceDb: -50,
      attackDb: 4.5,
      jumpSemitones: 0.6,
      maxBendSemitones: 3.2,
      releaseMs: 70,
      minNoteMs: 45,
      ...options,
    };
    if (detector) this.detect = detector;
    else {
      const pitchy = PitchDetector.forFloat32Array(this.opts.frameSize);
      this.detect = (frame, sr) => pitchy.findPitch(frame, sr);
    }
  }

  private get hopSeconds() {
    return this.opts.hopSize / this.opts.sampleRate;
  }
  private get frameSeconds() {
    return this.opts.frameSize / this.opts.sampleRate;
  }

  /**
   * Feed one frame. `time` is the audio-clock time of the frame's LAST sample.
   * Returns the note-on/note-off events this frame produced.
   */
  push(frame: Float32Array, time: number): TrackerEvent[] {
    const events: TrackerEvent[] = [];
    const o = this.opts;
    // Loudness of the whole frame (for silence) and of the newest hop (for attacks).
    let sum = 0;
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
    const frameDb = 10 * Math.log10(sum / frame.length + 1e-12);
    let hopSum = 0;
    const hopStart = Math.max(0, frame.length - o.hopSize);
    for (let i = hopStart; i < frame.length; i++) hopSum += frame[i] * frame[i];
    const hopDb = 10 * Math.log10(hopSum / (frame.length - hopStart) + 1e-12);
    const attack = hopDb - this.lastHopDb >= o.attackDb && hopDb > o.silenceDb && time - this.lastAttackTime > 0.06;
    this.lastHopDb = hopDb;

    const [hz, clarity] = frameDb > o.silenceDb ? this.detect(frame, o.sampleRate) : [0, 0];
    const voiced = clarity >= o.minClarity && hz >= o.minHz && hz <= o.maxHz;

    if (attack) {
      this.lastAttackTime = time;
      // A new pick: close whatever is sounding at the moment of the attack and start a new note.
      const onset = time - this.hopSeconds / 2;
      if (this.current) this.close(Math.min(onset, this.current.lastLoudTime), events);
      this.current = { base: NaN, onsetTime: onset, lastVoicedTime: onset, lastLoudTime: time, disturbedSince: null, peakBend: 0, levelDb: hopDb, confirmed: false, samples: [] };
      this.recent = [];
      this.lastSmoothed = null;
      this.jumpCandidate = null;
    }

    if (this.current && hopDb > o.silenceDb) this.current.lastLoudTime = time;
    if (!voiced) {
      const cur = this.current;
      if (cur && cur.confirmed && cur.disturbedSince === null) cur.disturbedSince = time;
      if (cur && time - cur.lastVoicedTime > o.releaseMs / 1000) this.close(Math.min(cur.lastLoudTime, cur.lastVoicedTime), events);
      return events;
    }

    // Median of the last three raw pitches removes one-frame octave errors.
    this.recent.push(hzToMidi(hz));
    if (this.recent.length > 3) this.recent.shift();
    const pitch = median(this.recent);

    if (!this.current) {
      // Sound without a detected attack (e.g. fade-in): start a note now.
      const onset = time - this.frameSeconds / 2;
      this.current = { base: NaN, onsetTime: onset, lastVoicedTime: time, lastLoudTime: time, disturbedSince: null, peakBend: 0, levelDb: hopDb, confirmed: false, samples: [] };
    }
    const cur = this.current;
    cur.lastVoicedTime = time;

    if (!cur.confirmed) {
      // Skip frames that still mostly contain the previous note: wait until the window has filled.
      if (time - cur.onsetTime < this.frameSeconds * 0.55) return events;
      cur.samples.push(pitch);
      if (cur.samples.length >= 3) {
        cur.base = median(cur.samples);
        cur.confirmed = true;
        this.lastSmoothed = pitch;
        events.push({ type: 'on', note: this.snapshot(cur, time) });
      }
      return events;
    }

    const step = this.lastSmoothed === null ? 0 : pitch - this.lastSmoothed;
    this.lastSmoothed = pitch;
    const fromBase = pitch - cur.base;
    const raw = this.recent[this.recent.length - 1];
    // Remember when the pitch first left the note, to date a hammer-on or pull-off accurately.
    if (Math.abs(raw - cur.base) > 0.5 && Math.abs(raw - cur.base) < 0.5 + o.maxBendSemitones && cur.disturbedSince === null && Math.abs(raw - pitch) > 0.4) cur.disturbedSince = time;
    if (Math.abs(raw - cur.base) <= 0.3) cur.disturbedSince = null;

    // A pending jump is confirmed when the new pitch holds for a second frame.
    if (this.jumpCandidate) {
      if (Math.abs(pitch - this.jumpCandidate.pitch) < 0.5) {
        this.jumpCandidate.frames++;
        if (this.jumpCandidate.frames >= 2) {
          const changeAt = (cur.disturbedSince ?? this.jumpCandidate.time - this.frameSeconds / 2) - this.hopSeconds / 2;
          const onset = Math.max(changeAt, cur.onsetTime + o.minNoteMs / 1000);
          this.close(onset, events);
          const next: Current = { base: pitch, onsetTime: Math.max(onset, this.lastClosedEnd), lastVoicedTime: time, lastLoudTime: time, disturbedSince: null, peakBend: 0, levelDb: hopDb, confirmed: true, samples: [] };
          this.current = next;
          this.jumpCandidate = null;
          events.push({ type: 'on', note: this.snapshot(next, time) });
        }
        return events;
      }
      this.jumpCandidate = null;
    }

    const abrupt = Math.abs(step) >= o.jumpSemitones;
    const outOfBendRange = fromBase > o.maxBendSemitones || fromBase < -o.jumpSemitones;
    if (abrupt || outOfBendRange) {
      // Hammer-on, pull-off, slide step, or too far to be a bend: wait one more frame to confirm.
      this.jumpCandidate = { pitch, time, frames: 1 };
      return events;
    }
    // Gradual change: a bend (upward) or vibrato. Track the highest point reached.
    if (fromBase > cur.peakBend) cur.peakBend = fromBase;
    return events;
  }

  private lastClosedEnd = -Infinity;

  private snapshot(cur: Current, time: number): TrackedNote {
    const midi = Math.round(cur.base);
    return {
      midi,
      cents: Math.round((cur.base - midi) * 100),
      onsetTime: cur.onsetTime,
      endTime: time,
      duration: time - cur.onsetTime,
      peakBendCents: Math.max(0, Math.round(cur.peakBend * 100)),
      levelDb: Math.round(cur.levelDb),
    };
  }

  private close(end: number, events: TrackerEvent[]) {
    const cur = this.current;
    this.current = null;
    this.jumpCandidate = null;
    if (!cur || !cur.confirmed) return;
    const endTime = Math.max(Math.min(end, cur.lastLoudTime), cur.onsetTime);
    if ((endTime - cur.onsetTime) * 1000 < this.opts.minNoteMs) return;
    this.lastClosedEnd = endTime;
    const note = this.snapshot(cur, endTime);
    note.endTime = endTime;
    note.duration = endTime - cur.onsetTime;
    events.push({ type: 'off', note });
  }

  /** End the current note (call when recording stops). */
  flush(time?: number): TrackerEvent[] {
    const events: TrackerEvent[] = [];
    if (this.current) this.close(time ?? this.current.lastLoudTime, events);
    return events;
  }

  reset() {
    this.current = null;
    this.recent = [];
    this.lastHopDb = -120;
    this.lastSmoothed = null;
    this.jumpCandidate = null;
    this.lastClosedEnd = -Infinity;
  }
}

/** Collects finished notes from tracker events. */
export function collectNotes(events: TrackerEvent[], into: TrackedNote[] = []) {
  for (const e of events) if (e.type === 'off') into.push(e.note);
  return into;
}
