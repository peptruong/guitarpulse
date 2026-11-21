import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { LATE_MARGIN, dropRepeatedTicks, startTime } from '../lib/audio/timing';

describe('notes the scheduler hands over late', () => {
  it('keeps a note that arrives on time at its scheduled time', () => {
    assert.equal(startTime(10.1, 10), 10.1);
  });

  // A note scheduled in the past makes Web Audio skip its attack and ramps; the jumps click.
  it('starts a late note a moment from now, so its attack is not skipped', () => {
    assert.equal(startTime(9.95, 10), 10 + LATE_MARGIN);
    assert.equal(startTime(10.005, 10), 10 + LATE_MARGIN);
  });

  // Two late notes on one voice must not share a start: Tone.js throws "Start time must be
  // strictly greater than previous start time" and the note is lost.
  it('starts a voice strictly after its previous note, even when both arrive late', () => {
    const first = startTime(9.9, 10);
    const second = startTime(9.95, 10, first);
    assert.ok(second > first, `${second} should be after ${first}`);
    assert.equal(startTime(10.5, 10, first), 10.5);
  });
});

// When one clock update ends and the next begins, Tone.js can hand the same tick over twice, about
// 1e-13 s apart. Drums and bass then throw on the second start, and keys and pad play the chord doubled.
describe('ticks Tone.js delivers twice', () => {
  it('plays an event once when its tick is delivered twice', () => {
    const times: number[] = [];
    const play = dropRepeatedTicks((time) => times.push(time));
    play(285.238666667);
    play(285.238666667 + 5.7e-14);
    assert.deepEqual(times, [285.238666667]);
  });

  it('plays the event again when the loop comes back to it', () => {
    const times: number[] = [];
    const play = dropRepeatedTicks((time) => times.push(time));
    play(10);
    play(55);
    assert.deepEqual(times, [10, 55]);
  });

  it('lets different events on the same beat each play', () => {
    const played: string[] = [];
    const kick = dropRepeatedTicks(() => played.push('kick'));
    const bass = dropRepeatedTicks(() => played.push('bass'));
    kick(10);
    bass(10);
    assert.deepEqual(played, ['kick', 'bass']);
  });
});
