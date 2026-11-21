/**
 * The browser audio engine: one AudioContext shared by Tone.js (backing tracks, lead voice, ear
 * trainer), the microphone tap and the time-stretcher, so every part runs on the same clock.
 *
 * Tempo: tracks are scheduled in beats on the Tone transport, so tempo changes move events in
 * time and never change pitch (bug 1). Recorded audio goes through Signalsmith Stretch instead.
 */
import type * as ToneType from 'tone';
import type { RenderedTrack, TrackEvent } from '@guitarpulse/core/grooves';
import { DrumKit } from './drums';
import { startTime } from './timing';

type ToneLib = typeof ToneType;

export type BusName = 'drums' | 'bass' | 'keys' | 'pad' | 'lead' | 'track' | 'ear' | 'click';
export type MixPart = 'drums' | 'bass' | 'keys' | 'pad' | 'lead';
export const MIX_PARTS: { id: MixPart; label: string }[] = [
  { id: 'drums', label: 'Drums' },
  { id: 'bass', label: 'Bass' },
  { id: 'keys', label: 'Keys' },
  { id: 'pad', label: 'Pad' },
  { id: 'lead', label: 'Lead' },
];

export interface LeadNote {
  midi: number;
  onsetBeat: number;
  durationBeats: number;
  bendSemitones?: number;
  bendRelease?: boolean;
  vibrato?: boolean;
  velocity?: number;
}

export interface PrepareOptions {
  bpm: number;
  /** Length of the looping section in beats (null = no loop). */
  loopBeats: number | null;
  countInBars?: number;
}

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

let tonePromise: Promise<ToneLib> | null = null;
/** Starts downloading Tone.js without creating an AudioContext (no autoplay warning). */
export function preloadAudio() {
  tonePromise ??= import('tone');
  return tonePromise;
}

export class Engine {
  readonly T: ToneLib;
  readonly ctx: AudioContext;
  private readonly buses: Record<BusName, ToneType.Volume>;
  private readonly master: ToneType.Volume;
  private readonly limiter: ToneType.Limiter;
  private readonly drums: DrumKit;
  private readonly bass: ToneType.MonoSynth;
  private readonly keys: ToneType.PolySynth<ToneType.FMSynth>;
  private readonly pad: ToneType.PolySynth<ToneType.Synth>;
  private readonly leads: ToneType.MonoSynth[];
  private readonly leadFx: ToneType.ToneAudioNode[];
  private readonly ear: ToneType.PolySynth<ToneType.Synth>;
  private readonly click: ToneType.Synth;
  private leadNext = 0;
  private readonly listeners = new Set<() => void>();
  /** Transport beats before track beat 0 (the count-in). */
  offsetBeats = 0;
  loopBeats: number | null = null;
  /** Audio-clock time of track beat 0 for the current run, or null when stopped. */
  trackStartTime: number | null = null;

  private constructor(T: ToneLib, ctx: AudioContext) {
    this.T = T;
    this.ctx = ctx;
    this.limiter = new T.Limiter(-1).toDestination();
    this.master = new T.Volume(-4).connect(this.limiter);
    const bus = (db: number) => new T.Volume(db).connect(this.master);
    this.buses = { drums: bus(-2), bass: bus(-4), keys: bus(-9), pad: bus(-14), lead: bus(-6), track: bus(0), ear: bus(-6), click: bus(-8) };

    this.drums = new DrumKit(T, this.buses.drums);
    this.bass = new T.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { Q: 1.5, type: 'lowpass', rolloff: -24 },
      envelope: { attack: 0.004, decay: 0.25, sustain: 0.55, release: 0.12 },
      filterEnvelope: { attack: 0.004, decay: 0.18, sustain: 0.3, release: 0.2, baseFrequency: 110, octaves: 2.6 },
      volume: -6,
    }).connect(this.buses.bass);
    this.keys = new T.PolySynth(T.FMSynth, {
      harmonicity: 3,
      modulationIndex: 2.2,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.004, decay: 0.9, sustain: 0.25, release: 0.6 },
      modulationEnvelope: { attack: 0.004, decay: 0.4, sustain: 0.1, release: 0.4 },
      volume: -10,
    });
    this.keys.maxPolyphony = 24;
    const keysChorus = new T.Chorus(3, 2.5, 0.25).start();
    this.keys.chain(keysChorus, this.buses.keys);
    this.pad = new T.PolySynth(T.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 24 },
      envelope: { attack: 0.5, decay: 0.4, sustain: 0.75, release: 1.4 },
      volume: -18,
    });
    this.pad.maxPolyphony = 16;
    const padFilter = new T.Filter(1100, 'lowpass');
    this.pad.chain(padFilter, this.buses.pad);

    const drive = new T.Distortion(0.28);
    const leadTone = new T.Filter(3200, 'lowpass');
    const delay = new T.FeedbackDelay('8n.', 0.22);
    delay.wet.value = 0.16;
    const verb = new T.Freeverb({ roomSize: 0.62, dampening: 2600 });
    verb.wet.value = 0.18;
    drive.chain(leadTone, delay, verb, this.buses.lead);
    this.leadFx = [drive, leadTone, delay, verb, keysChorus, padFilter];
    this.leads = [0, 1, 2].map(() =>
      new T.MonoSynth({
        oscillator: { type: 'sawtooth' },
        filter: { Q: 1, type: 'lowpass', rolloff: -24 },
        envelope: { attack: 0.004, decay: 0.3, sustain: 0.65, release: 0.22 },
        filterEnvelope: { attack: 0.003, decay: 0.35, sustain: 0.45, release: 0.3, baseFrequency: 500, octaves: 3 },
        volume: -8,
      }).connect(drive),
    );

    this.ear = new T.PolySynth(T.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.008, decay: 0.5, sustain: 0.35, release: 1 }, volume: -6 }).connect(this.buses.ear);
    this.click = new T.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 }, volume: -10 }).connect(this.buses.click);

    ctx.addEventListener('statechange', () => this.emit());
  }

  static async create(): Promise<Engine> {
    const T = await preloadAudio();
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    T.setContext(ctx);
    return new Engine(T, ctx);
  }

  get status(): AudioContextState | 'interrupted' {
    return this.ctx.state as AudioContextState | 'interrupted';
  }

  /** Call from a click or key handler: browsers only start audio after a user gesture. */
  async resume() {
    await this.T.start();
    if (this.ctx.state !== 'running') await this.ctx.resume();
    this.emit();
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  get playing() {
    return this.T.getTransport().state === 'started';
  }

  get bpm() {
    return this.T.getTransport().bpm.value;
  }

  /** Output delay of the device: what you hear lags the audio clock by this much. */
  get outputLatency() {
    return (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
  }

  /** Clears everything scheduled and sets tempo, loop and count-in for the next run. */
  prepare(opts: PrepareOptions) {
    const tr = this.T.getTransport();
    tr.stop();
    tr.cancel(0);
    this.releaseAll();
    tr.bpm.value = opts.bpm;
    tr.timeSignature = 4;
    this.offsetBeats = (opts.countInBars ?? 0) * 4;
    this.loopBeats = opts.loopBeats;
    if (opts.loopBeats) {
      tr.loop = true;
      tr.loopStart = this.tick(this.offsetBeats);
      tr.loopEnd = this.tick(this.offsetBeats + opts.loopBeats);
    } else {
      tr.loop = false;
    }
    for (let b = 0; b < this.offsetBeats; b++) {
      tr.schedule((time) => this.play(this.click, time, (t) => this.click.triggerAttackRelease(b % 4 === 0 ? 1760 : 1320, 0.03, t, b % 4 === 0 ? 1 : 0.7)), this.tick(b));
    }
    this.emit();
  }

  /** Transport position string for a transport beat. */
  private tick(transportBeat: number) {
    return `${Math.round(transportBeat * this.T.getTransport().PPQ)}i`;
  }

  /** Schedules a rendered backing track; it repeats with the loop. */
  addBacking(track: RenderedTrack) {
    const tr = this.T.getTransport();
    for (const e of track.events) tr.schedule((time) => this.trigger(e, time), this.tick(this.offsetBeats + e.beat));
  }

  /** A click on every beat of the loop (and an accent on beat 1). */
  addMetronome(beats: number) {
    const tr = this.T.getTransport();
    for (let b = 0; b < beats; b++) tr.schedule((time) => this.play(this.click, time, (t) => this.click.triggerAttackRelease(b % 4 === 0 ? 1760 : 1320, 0.03, t, b % 4 === 0 ? 0.9 : 0.55)), this.tick(this.offsetBeats + b));
  }

  /**
   * Schedules lead-voice notes at a track beat. repeat=true replays them on every loop (licks);
   * repeat=false plays them once at the next time the transport reaches them (trading answers).
   */
  addLead(notes: LeadNote[], atTrackBeat: number, repeat: boolean): number[] {
    const tr = this.T.getTransport();
    return notes.map((n) => {
      let pos = atTrackBeat + n.onsetBeat;
      if (!repeat && this.loopBeats) pos = ((pos % this.loopBeats) + this.loopBeats) % this.loopBeats;
      const at = this.tick(this.offsetBeats + pos);
      const cb = (time: number) => this.playLead(n, time);
      return repeat ? tr.schedule(cb, at) : tr.scheduleOnce(cb, at);
    });
  }

  clearEvents(ids: number[]) {
    const tr = this.T.getTransport();
    for (const id of ids) tr.clear(id);
  }

  /** Starts the transport; returns the audio-clock time of track beat 0. */
  start(): number {
    const tr = this.T.getTransport();
    const t0 = this.T.now() + 0.08;
    tr.start(t0, 0);
    this.trackStartTime = t0 + (this.offsetBeats * 60) / tr.bpm.value;
    this.emit();
    return this.trackStartTime;
  }

  stop() {
    const tr = this.T.getTransport();
    tr.stop();
    this.releaseAll();
    this.trackStartTime = null;
    this.emit();
  }

  /** Clears the schedule and stops: used when a page closes. */
  reset() {
    const tr = this.T.getTransport();
    tr.stop();
    tr.cancel(0);
    tr.loop = false;
    this.releaseAll();
    this.trackStartTime = null;
    this.emit();
  }

  setBpm(bpm: number) {
    this.T.getTransport().bpm.rampTo(bpm, 0.05);
  }

  /** Track beat being heard right now (loop-relative, negative during the count-in), or null when stopped. */
  heardBeat(): number | null {
    const tr = this.T.getTransport();
    if (tr.state !== 'started') return null;
    const t = Math.max(0, this.ctx.currentTime - this.outputLatency);
    return tr.getTicksAtTime(t) / tr.PPQ - this.offsetBeats;
  }

  setVolume(bus: BusName, db: number) {
    this.buses[bus].volume.rampTo(db, 0.05);
  }

  setMuted(bus: BusName, muted: boolean) {
    this.buses[bus].mute = muted;
  }

  /** Connects a native node (the time-stretcher) to a mixer bus. */
  connectNative(node: AudioNode, bus: BusName) {
    this.T.connect(node, this.buses[bus]);
  }

  private readonly lastStart = new Map<unknown, number>();

  /**
   * Starts one transport event on one voice. An event the busy main thread delivers late starts a
   * moment from now and after the voice's previous start (see startTime). One that still cannot be
   * scheduled is skipped: the error would otherwise stop Tone.js delivering the rest of the batch.
   */
  private play(voice: unknown, scheduled: number, start: (time: number) => void) {
    const time = startTime(scheduled, this.ctx.currentTime, this.lastStart.get(voice));
    try {
      start(time);
    } catch (err) {
      console.warn('GuitarPulse skipped a note it could not schedule in time.', err);
    }
    // Tone.js starts anything already due at the clock's current time, so that is when this voice really started.
    this.lastStart.set(voice, Math.max(time, this.ctx.currentTime));
  }

  private trigger(e: TrackEvent, scheduled: number) {
    this.play(e.part === 'drums' ? `drums:${e.inst}` : e.part, scheduled, (time) => {
      const spb = 60 / this.T.getTransport().bpm.value;
      const dur = Math.max(0.04, e.duration * spb);
      switch (e.part) {
        case 'drums':
          if (e.inst) this.drums.hit(e.inst, time, e.velocity);
          break;
        case 'bass':
          if (e.midi !== undefined) this.bass.triggerAttackRelease(hz(e.midi), dur * 0.94, time, e.velocity);
          break;
        case 'keys':
          if (e.midis?.length) this.keys.triggerAttackRelease(e.midis.map(hz), dur * 0.95, time, e.velocity * 0.75);
          break;
        case 'pad':
          if (e.midis?.length) this.pad.triggerAttackRelease(e.midis.map(hz), dur, time, e.velocity * 0.6);
          break;
      }
    });
  }

  private playLead(n: LeadNote, scheduled: number) {
    const v = this.leads[this.leadNext];
    this.leadNext = (this.leadNext + 1) % this.leads.length;
    this.play(v, scheduled, (time) => this.leadNote(v, n, time));
  }

  private leadNote(v: ToneType.MonoSynth, n: LeadNote, time: number) {
    const spb = 60 / this.T.getTransport().bpm.value;
    const dur = Math.max(0.06, n.durationBeats * spb);
    const f = hz(n.midi);
    v.frequency.cancelScheduledValues(time);
    v.detune.cancelScheduledValues(time);
    v.detune.setValueAtTime(0, time);
    v.triggerAttack(f, time, n.velocity ?? 0.8);
    if (n.bendSemitones) {
      const target = f * 2 ** (n.bendSemitones / 12);
      const rise = Math.min(dur * 0.4, 0.2);
      v.frequency.setValueAtTime(f, time + 0.015);
      v.frequency.linearRampToValueAtTime(target, time + 0.015 + rise);
      if (n.bendRelease) {
        v.frequency.setValueAtTime(target, time + dur * 0.6);
        v.frequency.linearRampToValueAtTime(f, time + dur * 0.92);
      }
    }
    if (n.vibrato && dur > 0.25) {
      const len = dur - 0.12;
      const steps = Math.max(12, Math.round(len * 48));
      const curve: number[] = [];
      for (let i = 0; i < steps; i++) {
        const t = (i / (steps - 1)) * len;
        curve.push(26 * Math.sin(2 * Math.PI * 5.6 * t) * Math.min(1, t / 0.15));
      }
      v.detune.setValueCurveAtTime(curve, time + 0.1, len);
      v.detune.setValueAtTime(0, time + 0.1 + len + 0.005);
    }
    v.triggerRelease(time + dur);
  }

  /** Plays notes right now (ear trainer, fretboard taps): 'together' as a chord, 'up'/'down' one after another. */
  playNow(midis: number[], style: 'together' | 'sequence', gap = 0.55, length = 1.4) {
    const now = this.T.now() + 0.02;
    if (style === 'together') {
      this.ear.triggerAttackRelease(midis.map(hz), length, now, 0.7);
      return;
    }
    midis.forEach((m, i) => this.ear.triggerAttackRelease(hz(m), Math.min(length, gap * 1.6), now + i * gap, 0.75));
  }

  private releaseAll() {
    const now = this.T.now();
    this.keys.releaseAll(now);
    this.pad.releaseAll(now);
    this.ear.releaseAll(now);
    for (const v of this.leads) v.triggerRelease(now);
    this.bass.triggerRelease(now);
  }

  dispose() {
    this.reset();
    this.drums.dispose();
    for (const n of [this.bass, this.keys, this.pad, this.ear, this.click, ...this.leads, ...this.leadFx]) n.dispose();
    for (const b of Object.values(this.buses)) b.dispose();
    this.master.dispose();
    this.limiter.dispose();
    void this.ctx.close();
  }
}

let enginePromise: Promise<Engine> | null = null;
let engineInstance: Engine | null = null;

/** The shared engine (created on first use). */
export function getEngine(): Promise<Engine> {
  enginePromise ??= Engine.create().then((e) => (engineInstance = e));
  return enginePromise;
}

/** The engine if it already exists, without creating it. */
export function peekEngine(): Engine | null {
  return engineInstance;
}
