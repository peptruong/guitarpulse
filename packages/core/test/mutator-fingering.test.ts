import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { validateLick } from '../scripts/lick-validator.js';
import { assignFingering, boxReport, heatmap } from '../src/fingering.js';
import { LICKS, getLick } from '../src/licks/index.js';
import { mutateLick, type Mutation } from '../src/mutator.js';
import { parseAlphaTexBody, texEvents } from '../src/tex/alphatex.js';
import { getScale } from '../src/theory/scales.js';
import { TUNINGS } from '../src/theory/notes.js';

const STD = TUNINGS.standard.midi;

describe('fingering', () => {
  it('plays an A minor pentatonic run in box 1 at the 5th fret, as a player would', () => {
    const run = [57, 60, 62, 64, 67, 69, 72].map((m) => [m]);
    const path = assignFingering(run).map((p) => p[0]);
    for (const p of path) assert.ok(p.fret >= 5 && p.fret <= 8, JSON.stringify(path));
  });
  it('moves position when a phrase climbs out of the box', () => {
    const path = assignFingering([[69], [72], [74], [76], [79], [81], [84]]).map((p) => p[0]);
    assert.ok(Math.max(...path.map((p) => p.fret)) >= 12);
  });
  it('finds the heatmap and spots a box-1 habit', () => {
    const notes = [57, 60, 62, 64, 67, 69, 72, 69, 67, 64, 62, 60].map((midi) => ({ midi, durationBeats: 0.5 }));
    const { positions, cells } = heatmap(notes);
    assert.equal(positions.length, 12);
    assert.ok(cells.every((c) => c.weight > 0 && c.weight <= 1));
    const report = boxReport(positions, 'A');
    assert.ok(report.box1Share >= 0.7, JSON.stringify(report));
    assert.match(report.advice, /box 1/);
  });
  it('credits playing spread across boxes', () => {
    const positions = [1, 2, 3, 4, 5].flatMap((box) => getScale({ root: 'A', scale: 'minor-pentatonic', pattern: 'box', position: box }).fretboard.map((n) => ({ string: n.string, fret: n.fret })));
    const report = boxReport(positions, 'A');
    assert.equal(report.boxesUsed, 5);
  });
});

describe('lick mutator', () => {
  const ops: Mutation[] = [{ op: 'transpose', toKey: 'D' }, { op: 'transpose', toKey: 'Bb' }, { op: 'displace' }, { op: 'flip' }, { op: 'retarget', chord: 'D7' }, { op: 'reverse' }];
  for (const m of ops) {
    it(`${m.op}${'toKey' in m ? ` to ${m.toKey}` : ''}: every vault lick still parses, fills its bars and fits its scale`, () => {
      for (const lick of LICKS) {
        const r = mutateLick(lick, m);
        assert.deepEqual(validateLick(r.lick), [], `${lick.id} → ${r.lick.body}`);
      }
    });
  }
  it('transposes by moving the same shape', () => {
    const r = mutateLick(getLick('bb-king-1')!, { op: 'transpose', toKey: 'C' });
    assert.equal(r.lick.key, 'C');
    assert.equal(r.lick.chord, 'C7');
    assert.match(r.lick.body, /^13\.2\.8 13\.1\.8/);
  });
  it('displaces by an eighth: every note starts half a beat later', () => {
    const lick = getLick('clapton-2')!;
    const before = texEvents(parseAlphaTexBody(lick.body), STD);
    const after = texEvents(parseAlphaTexBody(mutateLick(lick, { op: 'displace' }).lick.body), STD);
    assert.deepEqual(after.map((e) => e.midi), before.map((e) => e.midi));
    assert.deepEqual(after.map((e) => e.onsetBeat), before.map((e) => e.onsetBeat + 0.5));
  });
  it('flips the contour around the first note', () => {
    const lick = getLick('clapton-2')!; // descends C A G E D C A G
    const flipped = texEvents(parseAlphaTexBody(mutateLick(lick, { op: 'flip' }).lick.body), STD).map((e) => e.midi);
    const orig = texEvents(parseAlphaTexBody(lick.body), STD).map((e) => e.midi);
    assert.equal(flipped[0] % 12, orig[0] % 12); // same first note (it may move an octave to stay on the neck)
    for (let i = 1; i < 6; i++) assert.equal(Math.sign(flipped[i] - flipped[i - 1]), -Math.sign(orig[i] - orig[i - 1]), `step ${i}`);
  });
  it('retargets the ending to the 3rd of the next chord', () => {
    const r = mutateLick(getLick('clapton-2')!, { op: 'retarget', chord: 'D7' });
    const ev = texEvents(parseAlphaTexBody(r.lick.body), STD);
    assert.equal(ev[ev.length - 1].midi % 12, 6); // F#
    assert.match(r.explanation, /3rd of D7/);
  });
});
