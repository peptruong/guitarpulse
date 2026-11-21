import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { LICKS } from '@guitarpulse/core/licks/index';
import type { Lick } from '@guitarpulse/core/licks/types';
import { parseAlphaTexBody, texEvents, TICKS_PER_QUARTER } from '@guitarpulse/core/tex/alphatex';
import { getTuning } from '@guitarpulse/core/theory/notes';
import { playheadPoints, playheadStep, playheadView } from '../lib/playhead';

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
