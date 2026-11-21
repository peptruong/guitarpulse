import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { LATE_MARGIN, startTime } from '../lib/audio/timing';

describe('notes the scheduler hands over late', () => {
  it('keeps a note that arrives on time at its scheduled time', () => {
    assert.equal(startTime(10.1, 10), 10.1);
  });

  // A note scheduled in the past makes Web Audio skip its attack and ramps; the jumps click.
  it('starts a late note a moment from now, so its attack is not skipped', () => {
    assert.equal(startTime(9.95, 10), 10 + LATE_MARGIN);
    assert.equal(startTime(10.005, 10), 10 + LATE_MARGIN);
  });
});
