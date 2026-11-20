import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import * as alphaTab from '@coderline/alphatab';
import { LICKS } from '../src/licks/index.js';
import { parseAlphaTexBody, serializeAlphaTex, splitTicks, texEvents } from '../src/tex/alphatex.js';
import { TUNINGS } from '../src/theory/notes.js';

type Flat = { start: number; ticks: number; notes: string[] };

function alphaTabBeats(tex: string): Flat[] {
  const imp = new alphaTab.importer.AlphaTexImporter();
  imp.initFromString(tex, new alphaTab.Settings());
  const score = imp.readScore();
  const staff = score.tracks[0].staves[0];
  const out: Flat[] = [];
  let pos = 0;
  for (const bar of staff.bars) {
    for (const b of bar.voices[0].beats) {
      const notes = b.notes
        .filter((n) => !n.isDead && !n.isTieDestination)
        .map((n) => `${staff.tuning.length - n.string + 1}:${n.fret}`)
        .sort();
      out.push({ start: pos, ticks: b.playbackDuration, notes });
      pos += b.playbackDuration;
    }
  }
  return out;
}

function ourBeats(body: string, ts: [number, number]): Flat[] {
  return parseAlphaTexBody(body, ts).beats.map((b) => ({
    start: b.start,
    ticks: b.ticks,
    notes: b.notes.filter((n) => n.kind === 'fretted').map((n) => `${n.string}:${n.fret}`).sort(),
  }));
}

const tsOf = (l: { timeSignature: string }) => l.timeSignature.split('/').map(Number) as [number, number];

describe('alphaTex reader and writer', () => {
  it('reads every vault lick exactly as alphaTab does', () => {
    for (const lick of LICKS) {
      assert.deepEqual(ourBeats(lick.body, tsOf(lick)), alphaTabBeats(lick.alphaTex), lick.id);
    }
  });
  it('writes every lick back out so alphaTab reads the same music', () => {
    for (const lick of LICKS) {
      const ts = tsOf(lick);
      const parsed = parseAlphaTexBody(lick.body, ts);
      const written = serializeAlphaTex(parsed.beats, ts);
      const header = `\\tempo ${lick.bpm} .${ts[0] === 4 && ts[1] === 4 ? '' : ` \\ts ${ts[0]} ${ts[1]}`} `;
      assert.deepEqual(alphaTabBeats(header + written), alphaTabBeats(lick.alphaTex), `${lick.id}: ${written}`);
    }
  });
  it('turns beats into pitched events (bends, harmonics, ties)', () => {
    const std = TUNINGS.standard.midi;
    const ev = texEvents(parseAlphaTexBody('12.2{b (0 4) v}.4 12.3{nh}.4 5.3.4 -.3.4'), std);
    assert.deepEqual(ev.map((e) => e.midi), [71, 67, 60]);
    assert.equal(ev[0].bendSemitones, 2);
    assert.equal(ev[2].durationBeats, 2); // the tie extends the note
  });
  it('splits any straight length into writable values', () => {
    assert.deepEqual(splitTicks(1440).map((d) => [d.duration, d.dotted]), [[4, true]]);
    assert.deepEqual(splitTicks(1200).map((d) => d.duration), [4, 16]);
    assert.throws(() => splitTicks(320));
  });
});
