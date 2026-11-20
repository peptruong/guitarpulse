/**
 * Your own recordings at any speed or key: Signalsmith Stretch changes tempo and pitch
 * independently (bug 1: resampling would have changed both together).
 */
import type { StretchFactory, StretchNode } from '@/types/signalsmith-stretch';
import type { Engine } from './engine';

const STRETCH_URL = '/vendor/signalsmith-stretch-1.3.2.mjs';
let factoryPromise: Promise<StretchFactory> | null = null;

function loadFactory(): Promise<StretchFactory> {
  // Loaded as-is from /public: the library builds its AudioWorklet from its own source at runtime.
  const url = new URL(STRETCH_URL, window.location.origin).href;
  factoryPromise ??= import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url).then((m: { default: StretchFactory }) => m.default);
  return factoryPromise;
}

export interface StretchState {
  duration: number;
  rate: number;
  semitones: number;
  loopStart: number;
  loopEnd: number;
}

export class StretchPlayer {
  private constructor(
    private readonly node: StretchNode,
    private readonly engine: Engine,
  ) {}

  duration = 0;
  private playingFlag = false;

  /**
   * One player per engine: an AudioWorklet processor lives as long as its context, so the app
   * reuses a single stretcher instead of creating one per file.
   */
  static shared(engine: Engine): Promise<StretchPlayer> {
    let p = players.get(engine);
    if (!p) {
      p = loadFactory()
        .then((factory) => factory(engine.ctx, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] }))
        .then(async (node) => {
          // One (unused) input: the processor reads its input list even when playing buffers.
          engine.connectNative(node, 'track');
          // The playback position is reported from the audio thread 20 times a second.
          await node.setUpdateInterval(0.05);
          return new StretchPlayer(node, engine);
        });
      p.catch(() => players.delete(engine));
      players.set(engine, p);
    }
    return p;
  }

  async load(buffer: AudioBuffer) {
    this.pause();
    await this.node.dropBuffers();
    const left = buffer.getChannelData(0).slice();
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1).slice() : left.slice();
    this.duration = await this.node.addBuffers([left, right]);
    this.node.schedule({ input: 0, active: false });
  }

  get playing() {
    return this.playingFlag;
  }

  get position() {
    return this.node.inputTime;
  }

  play(s: { from: number; rate: number; semitones: number; loopStart: number; loopEnd: number }) {
    const output = this.engine.ctx.currentTime + 0.05;
    this.node.schedule({ output, active: true, input: s.from, rate: s.rate, semitones: s.semitones, loopStart: s.loopStart, loopEnd: s.loopEnd });
    this.playingFlag = true;
  }

  /** Changes speed, key or loop while playing, without a gap. */
  update(s: { rate: number; semitones: number; loopStart: number; loopEnd: number }) {
    this.node.schedule({ output: this.engine.ctx.currentTime + 0.03, rate: s.rate, semitones: s.semitones, loopStart: s.loopStart, loopEnd: s.loopEnd });
  }

  pause() {
    if (!this.playingFlag) return;
    this.node.schedule({ output: this.engine.ctx.currentTime, active: false });
    this.playingFlag = false;
  }

  /** Frees the loaded audio (the player itself stays ready for the next file). */
  async unload() {
    this.pause();
    this.duration = 0;
    await this.node.dropBuffers();
  }
}

const players = new WeakMap<Engine, Promise<StretchPlayer>>();
