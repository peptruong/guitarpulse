import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { assessSession } from '../src/coach/assess.js';
import { computeMetrics, type NoteEvent } from '../src/coach/metrics.js';
import { generatePracticePlan } from '../src/practice/plan.js';

// Two bars of A7 then two of D7 at 90 BPM.
const chords = [
  { symbol: 'A7', startBeat: 0, endBeat: 8 },
  { symbol: 'D7', startBeat: 8, endBeat: 16 },
];
const n = (midi: number, onsetBeat: number, durationBeats = 0.5): NoteEvent => ({ midi, onsetBeat, durationBeats });

describe('improv metrics', () => {
  it('rewards chord tones on strong beats, space and a repeated motif', () => {
    // Phrase lands on C# (3rd of A7) on beat 1, rests, repeats the shape, then lands on F# (3rd of D7) on beat 1 of bar 3.
    const good = [n(69, 0), n(73, 0.5), n(76, 1), n(73, 2, 1), n(69, 4), n(73, 4.5), n(76, 5), n(73, 6, 1), n(78, 8, 1), n(76, 9), n(74, 9.5), n(78, 12, 2)];
    const r = assessSession(good, chords, 90, 16);
    assert.equal(r.metrics.chordToneOnStrongBeats, 1);
    assert.equal(r.metrics.scaleAdherence, 1);
    assert.ok(r.metrics.restRatio >= 0.4);
    assert.ok(r.metrics.repeatedMotifs >= 1);
  });
  it('flags a nonstop scale run with no space as the thing to fix', () => {
    const run = Array.from({ length: 64 }, (_, i) => n(57 + ((i * 2) % 14), i * 0.25, 0.25));
    const r = assessSession(run, chords, 90, 16);
    assert.ok(r.metrics.restRatio < 0.05);
    assert.ok(r.focus, 'a focus should be chosen');
    assert.ok(r.verdicts.find((v) => v.metric === 'restRatio')?.status.startsWith('work on this'));
  });
  it('handles an empty session and reports bend accuracy', () => {
    const empty = computeMetrics([], [{ startBeat: 0, endBeat: 4, rootPc: 9, tones: [0, 4, 7, 10], scale: [0, 2, 4, 5, 7, 9, 10], symbol: 'A7' }], 90, 4);
    assert.equal(empty.noteCount, 0);
    const bent = computeMetrics([{ midi: 69, onsetBeat: 0, durationBeats: 1, peakBendCents: 185 }], [{ startBeat: 0, endBeat: 4, rootPc: 9, tones: [0, 4, 7, 10], scale: [0, 2, 4, 5, 7, 9, 10], symbol: 'A7' }], 90, 4);
    assert.equal(bent.bendAccuracyMeanCents, 15);
  });
});

describe('practice plan', () => {
  it('builds the requested number of weeks with a final review and a routine that adds up', () => {
    const p = generatePracticePlan({ level: 2, goals: ['neo-soul', 'phrasing'], minutesPerDay: 30, weeks: 10 });
    assert.equal(p.weeks.length, 10);
    assert.equal(p.weeks[9].module, 'review');
    assert.equal(p.dailyRoutine.reduce((a, b) => a + b.minutes, 0), 30);
  });
  it('never repeats a new lick and never jumps far past the student’s level', () => {
    const p = generatePracticePlan({ level: 1, weeks: 12 });
    const ids = p.weeks.flatMap((w) => w.newLicks.map((l) => l.id));
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(p.weeks.slice(0, 4).every((w) => w.newLicks.every((l) => l.difficulty <= 2)));
    assert.ok(!p.weeks.some((w) => w.module === 'outside'), 'a level-1 student should not reach level 9 in 12 weeks');
  });
  it('adds goal electives and loops with new keys when the path runs out', () => {
    const p = generatePracticePlan({ level: 9, goals: ['speed'], weeks: 6 });
    assert.ok(p.weeks.some((w) => w.title.includes('new key')));
    const funk = generatePracticePlan({ level: 3, goals: ['funk'], weeks: 6 });
    assert.ok(funk.weeks.some((w) => w.module === 'funk-16ths'));
  });
});

describe('key scale over the changes', () => {
  it('counts minor pentatonic over a dominant blues as inside when that is the chosen scale', async () => {
    const { assessSession } = await import('../src/coach/assess.js');
    const chords = [{ symbol: 'A7', startBeat: 0, endBeat: 8 }, { symbol: 'D7', startBeat: 8, endBeat: 16 }];
    // A C D E G over A7, then C D E G A over D7: all A minor pentatonic.
    const notes = [69, 72, 74, 76, 79, 72, 74, 76, 79, 81].map((midi, i) => ({ midi, onsetBeat: i * 1.5, durationBeats: 1 }));
    const plain = assessSession(notes, chords, 90, 16, 'A');
    const keyed = assessSession(notes, chords, 90, 16, 'A', 'minor-pentatonic');
    assert.ok(plain.metrics.scaleAdherence < 1);
    assert.equal(keyed.metrics.scaleAdherence, 1);
  });
});
