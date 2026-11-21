import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { LICKS } from '@guitarpulse/core/licks/index';
import type { Lick } from '@guitarpulse/core/licks/types';
import { parseAlphaTexBody, texEvents, TICKS_PER_QUARTER } from '@guitarpulse/core/tex/alphatex';
import { GROOVES } from '@guitarpulse/core/grooves';
import { getTuning } from '@guitarpulse/core/theory/notes';
import { chordIndexAt, chordPoints, countedStep, playheadPoints, playheadStep, playheadView, replayPoints, replayStep } from '../lib/playhead';
import { replayFrame, sortedForReplay } from '../lib/replay';
import { defaultSettings, grooveChords, loopLength } from '../lib/settings';

const STANDARD = getTuning('standard');

function setup(lick: Lick) {
  const score = parseAlphaTexBody(lick.body, lick.timeSignature.split('/').map(Number) as [number, number]);
  const events = texEvents(score, STANDARD);
  const lengthBeats = Math.ceil(score.totalTicks / score.barTicks) * (score.barTicks / TICKS_PER_QUARTER);
  return { score, events, lengthBeats, points: playheadPoints(score, events, lengthBeats) };
}

/** Heard beats through a one-bar count-in and two loops, finer than any note value. */
const heardBeats = (lengthBeats: number) => Array.from({ length: (lengthBeats * 2 + 4) * 128 }, (_, i) => i / 128 - 4);

describe('lick playhead', () => {
  // Redrawing the lick view while it plays is what starves the audio scheduler on phones, so the
  // page must redraw when the highlighted beat or sounding notes change, and at no other time.
  it('asks for a redraw exactly when the highlighted beat or notes change', () => {
    for (const lick of LICKS) {
      const { score, events, lengthBeats, points } = setup(lick);
      let prevStep: number | undefined;
      let prevView = '';
      for (const heard of heardBeats(lengthBeats)) {
        const step = playheadStep(points, lengthBeats, heard);
        const view = JSON.stringify(playheadView(score, events, heard < 0 ? null : heard % lengthBeats));
        if (prevStep !== undefined) assert.equal(step !== prevStep, view !== prevView, `${lick.id} at beat ${heard}: step ${prevStep} -> ${step}, view ${prevView} -> ${view}`);
        prevStep = step;
        prevView = view;
      }
    }
  });

  it('holds one step through the count-in and repeats with the loop', () => {
    const { lengthBeats, points } = setup(LICKS[0]);
    assert.equal(playheadStep(points, lengthBeats, -3.5), playheadStep(points, lengthBeats, -0.01));
    assert.equal(playheadStep(points, lengthBeats, 0.01), playheadStep(points, lengthBeats, lengthBeats + 0.01));
  });

  it('highlights the beat under the playhead and the notes sounding', () => {
    const { score, events } = setup(LICKS[0]);
    assert.deepEqual(playheadView(score, events, null), { activeBeat: null, sounding: [] });
    const first = events[0];
    const view = playheadView(score, events, first.onsetBeat);
    assert.equal(view.activeBeat, first.beat);
    assert.ok(view.sounding.some((n) => n.string === first.string && n.fret === first.fret));
  });
});

describe('chord strip pages (backing tracks, song, coach)', () => {
  it('redraw exactly when the highlighted chord changes, for every groove and progression', () => {
    for (const g of GROOVES) {
      g.progressions.forEach((_, p) => {
        const chords = grooveChords({ ...defaultSettings(g.id), progression: p });
        const loopBeats = loopLength(chords);
        const points = chordPoints(chords, loopBeats);
        let prevStep: number | undefined;
        let prevView = -2;
        for (let i = -4 * 16; i < loopBeats * 2 * 16; i++) {
          const heard = i / 16;
          const step = playheadStep(points, loopBeats, heard);
          const view = chordIndexAt(chords, loopBeats, heard);
          if (prevStep !== undefined) assert.equal(step !== prevStep, view !== prevView, `${g.id} progression ${p} at beat ${heard}: step ${prevStep} -> ${step}, chord ${prevView} -> ${view}`);
          prevStep = step;
          prevView = view;
        }
      });
    }
  });

  it('the coach count-in redraws once a beat, then once a chord', () => {
    const chords = grooveChords(defaultSettings('slow-blues'));
    const loopBeats = loopLength(chords);
    const points = chordPoints(chords, loopBeats);
    const shown = (heard: number) => (heard < 0 ? `count ${Math.ceil(-heard)}` : `chord ${chordIndexAt(chords, loopBeats, heard)}`);
    let prevStep: number | undefined;
    let prevView = '';
    for (let i = -4 * 16; i < loopBeats * 16; i++) {
      const heard = i / 16;
      const step = countedStep(points, loopBeats, heard);
      const view = shown(heard);
      if (prevStep !== undefined) assert.equal(step !== prevStep, view !== prevView, `at beat ${heard}: step ${prevStep} -> ${step}, ${prevView} -> ${view}`);
      prevStep = step;
      prevView = view;
    }
  });
});

describe('coach heatmap replay', () => {
  const solo = sortedForReplay([
    { midi: 69, onsetBeat: 0, durationBeats: 1, string: 1, fret: 5 },
    { midi: 72, onsetBeat: 1.5, durationBeats: 0.5, string: 1, fret: 8 },
    { midi: 67, onsetBeat: 2.25, durationBeats: 1.75, string: 2, fret: 8 },
    { midi: 69, onsetBeat: 4.1, durationBeats: 0.3, string: 1, fret: 5 },
    { midi: 64, onsetBeat: 6, durationBeats: 2.5, string: 2, fret: 5 },
  ]);
  const totalBeats = 12;
  const rings = (beat: number) => JSON.stringify(replayFrame(solo, beat).filter((c) => c.active).map((c) => [c.string, c.fret]));

  it('redraws at every note start and end, and at most 8 times a beat otherwise', () => {
    const points = replayPoints(solo, totalBeats);
    const heards = Array.from({ length: (totalBeats + 1) * 64 }, (_, i) => i / 64);
    for (let i = 1; i < heards.length; i++) {
      if (replayStep(points, heards[i]) === replayStep(points, heards[i - 1])) assert.equal(rings(heards[i]), rings(heards[i - 1]), `rings changed without a redraw at beat ${heards[i]}`);
    }
    const redraws = new Set(heards.map((h) => replayStep(points, h))).size;
    assert.ok(redraws <= (totalBeats + 1) * 8 + 2 * solo.length + 1, `${redraws} redraws over ${totalBeats} beats`);
  });

  it('redraws at least every 1/8 beat, so held notes keep warming up smoothly', () => {
    const points = replayPoints(solo, totalBeats);
    for (let i = 1; i < points.length; i++) assert.ok(points[i] - points[i - 1] <= 1 / 8 + 1e-9, `gap after beat ${points[i - 1]}`);
    assert.ok(points[points.length - 1] >= totalBeats);
  });
});
