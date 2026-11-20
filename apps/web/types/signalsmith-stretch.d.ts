/** Types for the parts of Signalsmith Stretch 1.3 that GuitarPulse uses. */
export interface StretchSchedule {
  output?: number;
  active?: boolean;
  input?: number;
  rate?: number;
  semitones?: number;
  tonalityHz?: number;
  loopStart?: number;
  loopEnd?: number;
}

export interface StretchNode extends AudioWorkletNode {
  inputTime: number;
  schedule(change: StretchSchedule): void;
  start(when?: number, offset?: number, duration?: number, rate?: number, semitones?: number): void;
  stop(when?: number): void;
  addBuffers(channels: Float32Array[]): Promise<number>;
  dropBuffers(toSeconds?: number): Promise<{ start: number; end: number } | number>;
  /** Resolves to the node's latency in live-input mode, in seconds. */
  latency(): Promise<number>;
  setUpdateInterval(seconds: number, callback?: (inputTime: number) => void): Promise<unknown>;
}

export type StretchFactory = (context: BaseAudioContext, options?: AudioWorkletNodeOptions) => Promise<StretchNode>;
