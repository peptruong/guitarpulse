/**
 * Microphone listening in the browser: MicSession (which always releases the mic) plus the
 * NoteTracker, wired to an AudioWorklet tap on the shared AudioContext.
 */
import { MicSession, TAP_WORKLET_SOURCE, type MicError, type MicPlatform, type StreamLike, type TapLike } from '@guitarpulse/core/audio/micSession';
import { NoteTracker, type TrackedNote } from '@guitarpulse/core/audio/noteTracker';

const FRAME = 2048;
const HOP = 512;
const loadedContexts = new WeakMap<BaseAudioContext, Promise<void>>();

function loadTapModule(ctx: AudioContext) {
  let p = loadedContexts.get(ctx);
  if (!p) {
    const url = URL.createObjectURL(new Blob([TAP_WORKLET_SOURCE], { type: 'application/javascript' }));
    p = ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
    loadedContexts.set(ctx, p);
  }
  return p;
}

export function browserMicPlatform(ctx: AudioContext): MicPlatform {
  return {
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints as MediaStreamConstraints) as Promise<StreamLike>,
    createSource: (stream) => ctx.createMediaStreamSource(stream as MediaStream),
    createTap: async () => {
      await loadTapModule(ctx);
      // No outputs: the browser still runs the processor while the microphone feeds it.
      return new AudioWorkletNode(ctx, 'guitarpulse-tap', { numberOfInputs: 1, numberOfOutputs: 0, processorOptions: { frameSize: FRAME, hopSize: HOP } }) as unknown as TapLike;
    },
    outputLatency: () => (ctx.outputLatency || 0) + (ctx.baseLatency || 0),
  };
}

export const MIC_MESSAGES: Record<MicError, string> = {
  'mic-denied': 'The microphone is blocked. Allow it for this site in your browser’s address bar or site settings, then press Start again.',
  'mic-unavailable': 'No microphone was found. Plug in an audio interface or headset, or check your system sound settings.',
  'tap-failed': 'This browser could not start audio analysis. Try a recent Chrome, Edge, Firefox or Safari.',
  stopped: 'Listening was stopped before it started.',
};

export interface Listener {
  /** Resolves to an error, or null when listening has started. */
  start(): Promise<MicError | null>;
  /** Stops listening, releases the microphone and reports the last note. */
  stop(): void;
  readonly latency: number;
  readonly open: boolean;
}

/**
 * onNote fires when a note ends (with its true start time and length); onAttack fires as soon as a
 * note is recognised, for live displays.
 */
export function createListener(ctx: AudioContext, onNote: (n: TrackedNote) => void, onAttack?: (n: TrackedNote) => void): Listener {
  const session = new MicSession(browserMicPlatform(ctx));
  const tracker = new NoteTracker({ sampleRate: ctx.sampleRate, frameSize: FRAME, hopSize: HOP });
  const handle = (events: ReturnType<NoteTracker['push']>) => {
    for (const e of events) {
      if (e.type === 'on') onAttack?.(e.note);
      else onNote(e.note);
    }
  };
  let running = false;
  return {
    async start() {
      tracker.reset();
      const err = await session.start((frame, t) => handle(tracker.push(frame, t)));
      running = err === null;
      return err;
    },
    stop() {
      const wasRunning = running;
      running = false;
      session.stop();
      if (wasRunning) handle(tracker.flush(ctx.currentTime));
    },
    get latency() {
      return session.latency;
    },
    get open() {
      return session.micOpen;
    },
  };
}
