/**
 * Microphone lifecycle and beat alignment.
 *
 * Bug fixed here: the blueprint closed its AudioContext on stop but never stopped the
 * MediaStream tracks, so the browser kept the microphone open (recording light on) after the
 * session ended, and again after every restart. MicSession owns the stream and guarantees every
 * track is stopped: on stop(), on errors after permission was granted, and when stop() is called
 * while permission is still being requested.
 *
 * The platform (getUserMedia, AudioWorklet) is injected so the same code is tested in Node.
 */

export interface TrackLike {
  stop(): void;
  readyState?: string;
  getSettings?(): { latency?: number; sampleRate?: number };
}
export interface StreamLike {
  getTracks(): TrackLike[];
  getAudioTracks(): TrackLike[];
}
export interface NodeLike {
  connect(target: NodeLike): unknown;
  disconnect(): void;
}
export interface TapLike extends NodeLike {
  port: { onmessage: ((e: { data: { frame: Float32Array; t: number } }) => void) | null; close(): void };
}
export interface MicPlatform {
  getUserMedia(constraints: { audio: Record<string, unknown> }): Promise<StreamLike>;
  createSource(stream: StreamLike): NodeLike;
  /** Creates the frame tap (an AudioWorkletNode in the browser). */
  createTap(): Promise<TapLike>;
  /** Output and base latency of the audio context, in seconds. */
  outputLatency(): number;
}

export type MicError = 'mic-denied' | 'mic-unavailable' | 'tap-failed' | 'stopped';
export type MicState = 'idle' | 'starting' | 'running' | 'stopped' | 'error';

/** Browser audio processing distorts pitch, so it is switched off. */
export const MIC_CONSTRAINTS = { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } };

export class MicSession {
  state: MicState = 'idle';
  private stream: StreamLike | null = null;
  private source: NodeLike | null = null;
  private tap: TapLike | null = null;
  private generation = 0;
  /** Input + output latency measured at start (seconds); subtract from frame times. */
  latency = 0;

  constructor(private platform: MicPlatform) {}

  /** Starts capture and calls onFrame for each analysis frame. Resolves to an error code, or null on success. */
  async start(onFrame: (frame: Float32Array, time: number) => void): Promise<MicError | null> {
    this.stop();
    const gen = ++this.generation;
    this.state = 'starting';
    let stream: StreamLike;
    try {
      stream = await this.platform.getUserMedia(MIC_CONSTRAINTS);
    } catch (e) {
      if (gen !== this.generation) return 'stopped';
      this.state = 'error';
      return (e as { name?: string })?.name === 'NotAllowedError' || (e as { name?: string })?.name === 'SecurityError' ? 'mic-denied' : 'mic-unavailable';
    }
    // stop() was called while the permission prompt was open: release the mic immediately.
    if (gen !== this.generation) {
      stream.getTracks().forEach((t) => t.stop());
      return 'stopped';
    }
    this.stream = stream;
    let tap: TapLike;
    try {
      tap = await this.platform.createTap();
    } catch {
      this.release();
      this.state = 'error';
      return 'tap-failed';
    }
    if (gen !== this.generation) {
      tap.disconnect();
      tap.port.close();
      return 'stopped';
    }
    const inputLatency = stream.getAudioTracks()[0]?.getSettings?.().latency ?? 0;
    this.latency = inputLatency + this.platform.outputLatency();
    this.tap = tap;
    this.source = this.platform.createSource(stream);
    tap.port.onmessage = (e) => onFrame(e.data.frame, e.data.t);
    this.source.connect(tap);
    this.state = 'running';
    return null;
  }

  /** Stops capture and releases the microphone. Safe to call any number of times. */
  stop() {
    this.generation++;
    this.release();
    if (this.state !== 'idle') this.state = 'stopped';
  }

  private release() {
    if (this.tap) {
      this.tap.port.onmessage = null;
      this.tap.port.close();
      this.tap.disconnect();
      this.tap = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  get micOpen() {
    return !!this.stream;
  }
}

/**
 * Maps audio-clock times to beats of the backing track, so every note knows which chord
 * was sounding. transportStart is the audio-clock time of beat 0.
 */
export class BeatClock {
  constructor(
    public transportStart: number,
    public bpm: number,
    public latency = 0,
  ) {}
  toBeat(time: number) {
    return ((time - this.latency - this.transportStart) * this.bpm) / 60;
  }
  toTime(beat: number) {
    return this.transportStart + this.latency + (beat * 60) / this.bpm;
  }
}

/**
 * AudioWorklet that posts overlapping frames (frameSize samples every hopSize samples) with the
 * audio-clock time of each frame's last sample. Runs on the audio thread, so frames keep coming
 * when the tab is in the background (requestAnimationFrame stops there).
 */
export const TAP_WORKLET_SOURCE = `
class GuitarPulseTap extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.size = o.frameSize || 2048;
    this.hop = o.hopSize || 512;
    this.buf = new Float32Array(this.size);
    this.w = 0;
    this.filled = 0;
    this.sinceHop = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let k = 0; k < ch.length; k++) {
      this.buf[this.w] = ch[k];
      this.w = (this.w + 1) % this.size;
      if (this.filled < this.size) this.filled++;
      this.sinceHop++;
      if (this.sinceHop >= this.hop && this.filled === this.size) {
        this.sinceHop = 0;
        const out = new Float32Array(this.size);
        out.set(this.buf.subarray(this.w));
        out.set(this.buf.subarray(0, this.w), this.size - this.w);
        const t = currentTime + (k + 1) / sampleRate;
        this.port.postMessage({ frame: out, t }, [out.buffer]);
      }
    }
    return true;
  }
}
registerProcessor('guitarpulse-tap', GuitarPulseTap);
`;
