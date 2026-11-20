import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { beatToSeconds, GROOVES, progressionChords, renderGroove, renderTrack } from '../src/grooves.js';
import { generatePracticePlan, GOALS } from '../src/practice/plan.js';
import { detectKey, nameProgression, parseChordChart, romanToChord, songToPractice } from '../src/song.js';
import { parseChord } from '../src/theory/chords.js';
import { parseNote, pc } from '../src/theory/notes.js';
import { findScale, scalePcs } from '../src/theory/scales.js';

describe('chord charts', () => {
  it('reads bars, slashes, repeats and line repeats', () => {
    const a = parseChordChart('| Am7 | D7 | Gmaj7 | Cmaj7 |');
    assert.deepEqual(a.chords.map((c) => [c.symbol, c.startBeat, c.endBeat]), [['Am7', 0, 4], ['D7', 4, 8], ['Gmaj7', 8, 12], ['Cmaj7', 12, 16]]);
    const b = parseChordChart('| C / / / | G / Am / |');
    assert.deepEqual(b.chords.map((c) => [c.symbol, c.endBeat - c.startBeat]), [['C', 4], ['G', 2], ['Am', 2]]);
    const c = parseChordChart('| F | % | C G |\n[Chorus] Am F C G x2');
    assert.equal(c.bars, 3 + 8);
    assert.deepEqual(c.chords.slice(0, 4).map((x) => x.symbol), ['F', 'F', 'C', 'G']);
  });
  it('reports chords it cannot read with the bar number', () => {
    const r = parseChordChart('| Am | Hm7 | C |');
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0].message, /Bar 2/);
  });
});

describe('keys and Roman numerals', () => {
  const key = (s: string) => detectKey(parseChordChart(s).chords).key;
  it('detects common keys', () => {
    assert.equal(key('Dm7 G7 Cmaj7'), 'C major');
    assert.equal(key('Am F C G'), 'A minor');
    assert.equal(key('Em C G D'), 'E minor');
    assert.equal(key('C G Am F'), 'C major');
    assert.equal(key('Am Dm E7 Am'), 'A minor');
    assert.equal(key('Gmaj7 A7 F#m7 Bm7'), 'D major');
  });
  it('spells Roman numerals in any key', () => {
    assert.equal(romanToChord('IVmaj7', 'D'), 'Gmaj7');
    assert.equal(romanToChord('iii7', 'D'), 'F#m7');
    assert.equal(romanToChord('bVII', 'C'), 'Bb');
    assert.equal(romanToChord('iiø7', 'A'), 'Bm7b5');
    assert.equal(romanToChord('V/VII', 'Eb'), 'Bb/D');
    assert.equal(romanToChord('I5', 'G'), 'G5');
    assert.equal(romanToChord('Isus2', 'G'), 'Gsus2');
  });
  it('names well-known progressions', () => {
    assert.match(nameProgression(['Gmaj7', 'A7', 'F#m7', 'Bm7'], 'D')!.name, /Royal road/);
    assert.match(nameProgression(['Dm7', 'G7', 'Cmaj7'], 'C')!.name, /ii–V–I/);
    assert.match(nameProgression(['Am', 'G', 'F', 'E'], 'A')!.name, /Andalusian/);
  });
  it('turns a song into a practice timeline', () => {
    const s = songToPractice('| Fmaj7 | E7 | Am7 | Gm7 C7 |');
    assert.equal(s.key.key, 'F major');
    assert.equal(s.timeline.length, 5);
    assert.ok(s.timeline.every((t) => t.scale && t.guideTones.length));
    assert.match(s.focus, /E7/); // E7 leaves the key
    assert.match(s.named!.name, /Just the Two of Us/);
  });
});

describe('grooves', () => {
  it('every groove renders every progression with sensible pitches', () => {
    for (const g of GROOVES) {
      for (let p = 0; p < g.progressions.length; p++) {
        const t = renderGroove(g.id, { progression: p });
        assert.ok(t.events.length > 0, g.id);
        for (const e of t.events) {
          assert.ok(e.beat >= 0 && e.beat < t.lengthBeats + 0.5, `${g.id} event at ${e.beat}`);
          if (e.part === 'bass') assert.ok(e.midi! >= 28 && e.midi! <= 60, `${g.id} bass ${e.midi}`);
          if (e.midis) for (const m of e.midis) assert.ok(m >= 40 && m <= 90, `${g.id} chord note ${m}`);
        }
        for (const inst of Object.keys(g.drums)) assert.ok(t.events.some((e) => e.inst === inst), `${g.id} ${inst}`);
      }
    }
  });
  it('bug 1 stays fixed: tempo changes timing only, never pitch', () => {
    const t = renderGroove('texas-shuffle');
    const at = (bpm: number) => t.events.map((e) => ({ s: beatToSeconds(e.beat, bpm), pitches: e.midis ?? (e.midi ?? null) }));
    const slow = at(90);
    const fast = at(135);
    assert.deepEqual(fast.map((e) => e.pitches), slow.map((e) => e.pitches));
    for (let i = 1; i < slow.length; i++) if (slow[i].s > 0) assert.ok(Math.abs(fast[i].s / slow[i].s - 90 / 135) < 1e-9);
  });
  it('changing key moves every pitched note by the same interval', () => {
    const inA = renderGroove('pop-rock', { key: 'A' }).events.filter((e) => e.part === 'bass').map((e) => e.midi!);
    const inB = renderGroove('pop-rock', { key: 'B' }).events.filter((e) => e.part === 'bass').map((e) => e.midi!);
    inA.forEach((m, i) => assert.equal(pc(inB[i] - m), 2));
  });
  it('Asia pack chords use only notes of their mode', () => {
    for (const [id, scale] of [['vietnamese-folk', 'dieu-bac'], ['wuxia', 'yu'], ['cai-luong', 'hoi-oan']] as const) {
      const g = GROOVES.find((x) => x.id === id)!;
      const prog = g.progressions[0];
      const allowed = new Set(scalePcs(findScale(scale)!, parseNote(prog.key)!.pc));
      for (const c of progressionChords(prog.roman, prog.key)) for (const p of parseChord(c.symbol).pcs) assert.ok(allowed.has(p), `${id}: ${c.symbol}`);
    }
  });
  it('every practice-plan week points at a groove the app can play', () => {
    const seen = new Set<string>();
    for (let level = 1; level <= 9; level++) {
      for (const week of generatePracticePlan({ level, goals: [...GOALS], weeks: 16 }).weeks) {
        seen.add(week.module);
        if (week.track.genre === 'your choice') continue;
        const g = GROOVES.find((x) => x.id === week.track.genre);
        assert.ok(g, `${week.module}: no groove "${week.track.genre}"`);
        assert.ok(week.track.progressionIndex < g.progressions.length, `${week.module}: progression ${week.track.progressionIndex}`);
        assert.ok(parseNote(week.track.key), `${week.module}: key ${week.track.key}`);
      }
    }
    assert.ok(seen.size >= 20, `only ${seen.size} modules checked`);
  });
  it('slash chords put their bass note in the bass (K-ballad falling line)', () => {
    const t = renderTrack(GROOVES.find((g) => g.id === 'k-ballad')!, progressionChords('Imaj7 V/VII', 'Eb'));
    const bass = t.events.filter((e) => e.part === 'bass' && e.beat >= 4 && e.beat < 5);
    assert.equal(pc(bass[0].midi!), 2); // D under Bb
  });
});
