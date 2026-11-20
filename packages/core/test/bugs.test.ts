/**
 * Regression tests for the four bugs in the original blueprint.
 */
import { strict as assert } from 'node:assert';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'node:test';
import { BeatClock, MicSession, TAP_WORKLET_SOURCE, type MicPlatform, type StreamLike, type TapLike } from '../src/audio/micSession.js';
import { collectNotes, NoteTracker, type TrackedNote } from '../src/audio/noteTracker.js';
import { resamplingPitchShift, stretchSettings } from '../src/audio/tempo.js';
import { fretboardModel, scaleCells } from '../src/theory/fretboard.js';
import { frames, renderGuitar, type SynthNote } from './helpers/guitarSynth.js';

const SR = 48000;

function track(notes: SynthNote[], seconds: number): TrackedNote[] {
  const audio = renderGuitar(notes, SR, seconds);
  const tracker = new NoteTracker({ sampleRate: SR });
  const out: TrackedNote[] = [];
  for (const { frame, time } of frames(audio, SR)) collectNotes(tracker.push(frame, time), out);
  collectNotes(tracker.flush(seconds), out);
  return out;
}

describe('bug 1: tempo changes must not change pitch', () => {
  it('documents the old bug: resampling 25% faster raises pitch by almost 4 semitones', () => {
    assert.ok(Math.abs(resamplingPitchShift(1.25) - 3.86) < 0.01);
  });
  it('time-stretch settings keep speed and key independent', () => {
    assert.deepEqual(stretchSettings({ sourceBpm: 100, targetBpm: 125 }), { rate: 1.25, semitones: 0 });
    assert.deepEqual(stretchSettings({ speedPercent: 75, transpose: -2 }), { rate: 0.75, semitones: -2 });
    assert.throws(() => stretchSettings({ speedPercent: 10 }));
  });
});

describe('bug 2: note logs keep timing, octave and repeated notes', () => {
  it('logs three picked notes with octave, onset and duration', () => {
    const played: SynthNote[] = [
      { midi: 57, start: 0.2, dur: 0.4 },
      { midi: 60, start: 0.7, dur: 0.4 },
      { midi: 76, start: 1.2, dur: 0.4 },
    ];
    const got = track(played, 1.9);
    assert.equal(got.length, 3, JSON.stringify(got));
    got.forEach((n, i) => {
      assert.equal(n.midi, played[i].midi);
      assert.ok(Math.abs(n.onsetTime - played[i].start) < 0.03, `onset ${n.onsetTime} vs ${played[i].start}`);
      assert.ok(Math.abs(n.duration - played[i].dur) < 0.08, `duration ${n.duration} vs ${played[i].dur}`);
    });
  });
  it('keeps a repeated note as two notes (the old code merged them)', () => {
    const got = track(
      [
        { midi: 64, start: 0.2, dur: 0.3, amp: 0.3 },
        { midi: 64, start: 0.5, dur: 0.4, amp: 0.6 },
      ],
      1.2,
    );
    assert.equal(got.length, 2, JSON.stringify(got));
    assert.ok(Math.abs(got[1].onsetTime - 0.5) < 0.03);
  });
  it('splits a hammer-on into two notes without a pick attack', () => {
    const got = track(
      [
        { midi: 57, start: 0.2, dur: 0.3 },
        { midi: 60, start: 0.5, dur: 0.4, legato: true },
      ],
      1.2,
    );
    assert.deepEqual(got.map((n) => n.midi), [57, 60]);
    assert.ok(Math.abs(got[1].onsetTime - 0.5) < 0.05, `legato onset ${got[1].onsetTime}`);
  });
  it('keeps up with sixteenth notes at 120 BPM', () => {
    const run = [57, 60, 62, 64, 67, 69, 67, 64, 62, 60, 57, 55].map((midi, i) => ({ midi, start: 0.2 + i * 0.125, dur: 0.12 }));
    const got = track(run, 2);
    assert.deepEqual(got.map((n) => n.midi), run.map((n) => n.midi));
    got.forEach((n, i) => assert.ok(Math.abs(n.onsetTime - run[i].start) < 0.03, `note ${i} onset ${n.onsetTime}`));
  });
  it('splits pull-offs into separate notes', () => {
    const got = track(
      [
        { midi: 64, start: 0.2, dur: 0.25 },
        { midi: 62, start: 0.45, dur: 0.25, legato: true },
        { midi: 60, start: 0.7, dur: 0.3, legato: true },
      ],
      1.2,
    );
    assert.deepEqual(got.map((n) => n.midi), [64, 62, 60]);
  });
  it('keeps a whole-step bend as one note and measures how far it went', () => {
    const got = track([{ midi: 67, start: 0.2, dur: 0.8, bend: { semitones: 2, at: 0.15, over: 0.15 } }], 1.3);
    assert.equal(got.length, 1, JSON.stringify(got));
    assert.equal(got[0].midi, 67);
    assert.ok(Math.abs(got[0].peakBendCents - 200) <= 25, `bend ${got[0].peakBendCents}`);
  });
  it('keeps vibrato as one note', () => {
    const got = track([{ midi: 64, start: 0.2, dur: 0.9, vibrato: { cents: 30, rate: 6 } }], 1.3);
    assert.equal(got.length, 1);
    assert.equal(got[0].midi, 64);
  });
  it('hears drop C (65 Hz) and fret 24 on the high E (1319 Hz), which the old 70-1000 Hz gate cut off', () => {
    assert.deepEqual(track([{ midi: 36, start: 0.2, dur: 0.6 }], 1).map((n) => n.midi), [36]);
    assert.deepEqual(track([{ midi: 88, start: 0.2, dur: 0.4 }], 0.8).map((n) => n.midi), [88]);
  });
  it('ignores silence and hiss', () => {
    assert.equal(track([], 1).length, 0);
  });
  it('places notes on the backing track’s beat grid with latency compensation', () => {
    const clock = new BeatClock(10, 120, 0.02);
    assert.equal(clock.toBeat(10.02), 0);
    assert.equal(clock.toBeat(11.02), 2);
    assert.equal(clock.toTime(4), 12.02);
  });
});

describe('bug 3: the microphone is always released', () => {
  function fakePlatform(opts: { deny?: boolean; tapFails?: boolean; slow?: boolean } = {}) {
    const tracks = [{ stopped: false, stop() { this.stopped = true; }, getSettings: () => ({ latency: 0.01 }) }];
    const log: string[] = [];
    let resolveMic: ((s: StreamLike) => void) | null = null;
    const stream: StreamLike = { getTracks: () => tracks, getAudioTracks: () => tracks };
    const platform: MicPlatform = {
      getUserMedia: () => {
        if (opts.deny) return Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
        if (opts.slow) return new Promise((r) => (resolveMic = r));
        return Promise.resolve(stream);
      },
      createSource: () => ({ connect: () => log.push('connect'), disconnect: () => log.push('source-disconnect') }),
      createTap: async () => {
        if (opts.tapFails) throw new Error('no worklet');
        const tap: TapLike = { port: { onmessage: null, close: () => log.push('port-close') }, connect: () => undefined, disconnect: () => log.push('tap-disconnect') };
        return tap;
      },
      outputLatency: () => 0.02,
    };
    return { platform, tracks, log, release: () => resolveMic?.(stream) };
  }

  it('stops every track on stop()', async () => {
    const f = fakePlatform();
    const mic = new MicSession(f.platform);
    assert.equal(await mic.start(() => undefined), null);
    assert.equal(mic.micOpen, true);
    assert.ok(Math.abs(mic.latency - 0.03) < 1e-9);
    mic.stop();
    assert.equal(f.tracks[0].stopped, true);
    assert.equal(mic.micOpen, false);
    assert.ok(f.log.includes('port-close') && f.log.includes('tap-disconnect') && f.log.includes('source-disconnect'));
    mic.stop(); // second stop is harmless
  });
  it('releases the mic if the audio tap fails after permission was granted', async () => {
    const f = fakePlatform({ tapFails: true });
    const mic = new MicSession(f.platform);
    assert.equal(await mic.start(() => undefined), 'tap-failed');
    assert.equal(f.tracks[0].stopped, true);
  });
  it('releases the mic when stop() is called while the permission prompt is still open', async () => {
    const f = fakePlatform({ slow: true });
    const mic = new MicSession(f.platform);
    const pending = mic.start(() => undefined);
    mic.stop();
    f.release();
    assert.equal(await pending, 'stopped');
    assert.equal(f.tracks[0].stopped, true);
  });
  it('reports a denied permission without throwing', async () => {
    const mic = new MicSession(fakePlatform({ deny: true }).platform);
    assert.equal(await mic.start(() => undefined), 'mic-denied');
  });
  it('the worklet posts 2048-sample frames every 512 samples with audio-clock times', () => {
    const posted: { frame: Float32Array; t: number }[] = [];
    let Processor: new (o: unknown) => { process(i: Float32Array[][]): boolean; port: unknown } = class {} as never;
    class AudioWorkletProcessor {
      port = { postMessage: (m: { frame: Float32Array; t: number }) => posted.push(m) };
    }
    const scope = {
      AudioWorkletProcessor,
      registerProcessor: (_: string, p: typeof Processor) => (Processor = p),
      currentTime: 0,
      sampleRate: 48000,
      Float32Array,
    };
    runInNewContext(TAP_WORKLET_SOURCE, scope);
    const node = new Processor({ processorOptions: { frameSize: 2048, hopSize: 512 } });
    for (let block = 0; block < 32; block++) {
      scope.currentTime = (block * 128) / 48000; // the audio thread advances currentTime every 128-sample block
      node.process([[new Float32Array(128).fill(block)]]);
    }
    assert.equal(posted.length, 5); // 4096 samples: first full frame at 2048, then every 512
    assert.equal(posted[0].frame.length, 2048);
    assert.ok(Math.abs(posted[0].t - 2048 / 48000) < 1e-9);
  });
});

describe('bug 4: notes are matched by pitch class, so flat keys work', () => {
  it('shows Bb major on the neck, spelled with flats', () => {
    const cells = scaleCells({ root: 'Bb', scale: 'ionian', frets: 12 });
    const aString1stFret = cells.find((c) => c.string === 5 && c.fret === 1);
    assert.ok(aString1stFret, 'Bb on the A string, fret 1, must be shown');
    assert.equal(aString1stFret!.name, 'Bb');
    assert.equal(aString1stFret!.degree, '1');
    assert.ok(cells.some((c) => c.name === 'Eb'));
    // The old code compared names from ['C','C#',...,'A#','B'] against 'Bb' and found nothing.
    const sharpNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    assert.ok(!sharpNames.includes('Bb'));
  });
  it('gives every scale the right number of notes per octave in any key', () => {
    for (const root of ['Gb', 'Db', 'F#', 'C#', 'Ab']) {
      const row = fretboardModel({ root, scale: 'dorian', frets: 12 })[0];
      assert.equal(row.slice(0, 12).filter((c) => c.inScale).length, 7, root);
    }
  });
});
