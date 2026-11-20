import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseChord } from '../src/theory/chords.js';
import { suggestScales } from '../src/theory/chordScale.js';
import { getTuning, parseNote, pc, spellDegree } from '../src/theory/notes.js';
import { getScale, SCALES, scalePcs } from '../src/theory/scales.js';
import { getChordVoicings } from '../src/theory/voicings.js';

describe('spelling', () => {
  it('spells major keys with one letter per degree', () => {
    const spell = (root: string) => getScale({ root, scale: 'ionian' }).notes.join(' ');
    assert.equal(spell('Bb'), 'Bb C D Eb F G A');
    assert.equal(spell('F#'), 'F# G# A# B C# D# E#');
    assert.equal(spell('Db'), 'Db Eb F Gb Ab Bb C');
  });
  it('spells modes and minor scales correctly', () => {
    assert.equal(getScale({ root: 'Eb', scale: 'dorian' }).notes.join(' '), 'Eb F Gb Ab Bb C Db');
    assert.equal(getScale({ root: 'C#', scale: 'harmonic minor' }).notes.join(' '), 'C# D# E F# G# A B#');
    assert.equal(getScale({ root: 'E', scale: 'altered' }).notes.join(' '), 'E F G G# A# C D');
  });
  it('avoids double accidentals on the fretboard', () => {
    for (const s of SCALES) for (const r of ['C', 'Db', 'F#', 'Gb', 'B']) {
      for (const n of getScale({ root: r, scale: s.id }).notes) assert.ok(!/##|bb/.test(n), `${r} ${s.id}: ${n}`);
    }
  });
  it('matches every scale formula to its semitones', () => {
    const am = getScale({ root: 'A', scale: 'minor-pentatonic' });
    assert.deepEqual(am.pitchClasses, [9, 0, 2, 4, 7]);
    for (const s of SCALES) assert.equal(new Set(scalePcs(s, 0)).size, s.degrees.length, `${s.id} has repeated notes`);
  });
  it('spells chord tones from the root', () => {
    assert.equal(spellDegree(parseNote('F#')!, 'b7'), 'E');
    assert.deepEqual(parseChord('Bdim7').notes, ['B', 'D', 'F', 'Ab']);
    assert.deepEqual(parseChord('C6/9').degrees, ['1', '3', '5', '6', '9']);
    assert.equal(parseChord('Am7/G').bass?.name, 'G');
  });
});

describe('scale patterns', () => {
  it('gives the classic A minor pentatonic box 1 at the 5th fret', () => {
    const box = getScale({ root: 'A', scale: 'minor-pentatonic', pattern: 'box', position: 1 });
    const byString = (s: number) => box.fretboard.filter((n) => n.string === s).map((n) => n.fret);
    assert.deepEqual(byString(6), [5, 8]);
    assert.deepEqual(byString(2), [5, 8]);
    assert.deepEqual(byString(1), [5, 8]);
  });
  it('gives 7 notes ascending with 3 per string for 3NPS', () => {
    const p = getScale({ root: 'G', scale: 'ionian', pattern: '3nps', position: 1 });
    assert.equal(p.fretboard.length, 18);
    const midis = p.fretboard.map((n) => n.midi);
    for (let i = 1; i < midis.length; i++) assert.ok(midis[i] > midis[i - 1]);
  });
  it('explains when a pattern does not fit the scale', () => {
    assert.throws(() => getScale({ root: 'C', scale: 'ionian', pattern: 'box' }), /needs a 5-note scale/);
  });
});

describe('chord voicings', () => {
  const chords = ['C', 'Am', 'G7', 'Am7', 'Cmaj7', 'F#m7b5', 'Bdim7', 'E7alt', 'Cmaj9', 'C6/9', 'D7#11', 'Bb7', 'Ebmaj7', 'Dsus4', 'E7sus4'];
  for (const symbol of chords) {
    it(`every ${symbol} voicing uses only chord tones and plays on the strings it names`, () => {
      const chord = parseChord(symbol);
      const tuning = getTuning('standard');
      const r = getChordVoicings({ chord: symbol, limitPerSystem: 12 });
      assert.ok(r.voicings.length > 0, `no voicings for ${symbol}`);
      for (const v of r.voicings) {
        const sounding = v.frets.map((f, i) => (f === null ? null : tuning[i] + f)).filter((m): m is number => m !== null);
        for (const m of sounding) assert.ok(chord.pcs.includes(pc(m)), `${symbol} ${v.chart} has a non-chord tone`);
        for (const f of v.frets) if (f !== null) assert.ok(f >= 0 && f <= 15);
        const fretted = v.frets.filter((f): f is number => f !== null && f > 0);
        if (fretted.length) assert.ok(Math.max(...fretted) - Math.min(...fretted) <= 5, `${symbol} ${v.chart} is too wide a stretch`);
        assert.equal(v.fingers.length, 6);
        if (v.system === 'drop2' || v.system === 'drop3') {
          assert.equal(sounding.length, 4);
          const raised = [sounding[0] + 12, ...sounding.slice(1)].sort((a, b) => a - b);
          assert.ok(raised[3] - raised[0] < 12, `${symbol} ${v.chart} is not a ${v.system}`);
        }
        if (v.system === 'shell') assert.equal(v.degrees[0], '1');
      }
    });
  }
  it('finds the open C and the A-shape barre with CAGED', () => {
    const charts = getChordVoicings({ chord: 'C', systems: ['caged'] }).voicings.map((v) => v.chart);
    assert.ok(charts.includes('x32010'));
    assert.ok(charts.includes('x35553'));
  });
  it('honours slash-chord bass notes', () => {
    const r = getChordVoicings({ chord: 'Am7/G', systems: ['drop2'] });
    assert.ok(r.voicings.length > 0);
    for (const v of r.voicings) assert.equal(v.notes[0], 'G');
  });
});

describe('scale suggestions', () => {
  it('puts Dorian first on a ii chord and Mixolydian on V in a major ii-V-I', () => {
    const a = suggestScales(['Dm7', 'G7', 'Cmaj7'], 'C');
    assert.equal(a.chords[0].scales[0].id, 'dorian');
    assert.equal(a.chords[1].scales[0].id, 'mixolydian');
    assert.match(a.chords[1].function ?? '', /V7 resolving/);
    assert.ok(a.guideToneLine.some((g) => g.includes('C (b7) down a half step to B (3)')));
  });
  it('puts Phrygian dominant first on V7 resolving to minor', () => {
    const a = suggestScales(['Bm7b5', 'E7', 'Am7'], 'A minor');
    assert.equal(a.chords[1].scales[0].id, 'phrygian-dominant');
  });
  it('treats a plain major V triad in minor as a dominant', () => {
    const a = suggestScales(['Am', 'G', 'F', 'E'], 'A minor');
    assert.equal(a.chords[3].scales[0].id, 'phrygian-dominant');
  });
  it('recognises a blues and offers pentatonics', () => {
    const a = suggestScales(['A7', 'D7', 'E7']);
    assert.match(a.chords[0].function ?? '', /blues/);
    assert.ok(a.chords[0].scales.slice(0, 3).some((s) => s.id === 'minor-pentatonic'));
    assert.ok(a.wholeProgression[0].scale.includes('minor pentatonic'));
  });
  it('rejects chords it cannot read with a helpful message', () => {
    assert.throws(() => suggestScales(['X7']), /Try forms like/);
  });
});
