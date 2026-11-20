import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { validateAll } from '../scripts/lick-validator.js';
import { ARTISTS } from '../src/licks/artists.js';
import { LICKS, searchLicks } from '../src/licks/index.js';

describe('licks vault', () => {
  it('every lick parses in alphaTab, fills its bars and stays in its scale', () => {
    assert.deepEqual(validateAll(LICKS), []);
  });
  it('has at least two style studies for every artist profile, and a profile for every artist', () => {
    for (const a of ARTISTS) assert.ok(LICKS.filter((l) => l.artist === a.name).length >= 2, `${a.name} needs two licks`);
    for (const l of LICKS) assert.ok(ARTISTS.some((a) => a.name === l.artist), `${l.artist} has no profile`);
  });
  it('marks every lick as an original study and covers all five difficulty levels', () => {
    assert.ok(LICKS.every((l) => l.original && l.alphaTex.includes('Original style study')));
    for (const d of [1, 2, 3, 4, 5]) assert.ok(LICKS.some((l) => l.difficulty === d), `no difficulty ${d}`);
  });
  it('searches by artist, genre, technique and difficulty with pagination', () => {
    assert.equal(searchLicks({ artist: 'gilmour' }).total, 2);
    assert.ok(searchLicks({ genre: 'blues', maxDifficulty: 2 }).licks.every((l) => l.genre === 'blues' && l.difficulty <= 2));
    assert.ok(searchLicks({ technique: 'tapping' }).total >= 3);
    const p1 = searchLicks({ limit: 5 });
    const p2 = searchLicks({ limit: 5, offset: 5 });
    assert.equal(p1.hasMore, true);
    assert.notEqual(p1.licks[0].id, p2.licks[0].id);
    assert.equal(searchLicks({ text: 'enclosure' }).licks[0].id, 'benson-1');
  });
});
