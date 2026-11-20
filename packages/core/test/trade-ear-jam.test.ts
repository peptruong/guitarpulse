import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { NoteEvent } from '../src/coach/metrics.js';
import { answerQuestion, EarSession, initialEarState, LEVELS, nextQuestion, unlockedItems, type EarState } from '../src/ear.js';
import { progressionChords } from '../src/grooves.js';
import { addSession, currentStreak, emptyProgress, MAX_SESSIONS, mergeProgress, metricTrend, type SessionRecord } from '../src/progress.js';
import { decodeJam, describeJam, encodeJam, jamLink, type JamSession } from '../src/session.js';
import { parseChord } from '../src/theory/chords.js';
import { pc } from '../src/theory/notes.js';
import { compareReply, createCall, extractMotif, respondTo, rng, TECHNIQUES, type TradeContext } from '../src/trading.js';

const blues = progressionChords('I7 IV7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', 'A');
// Your four bars over bars 1-4, played with human timing: A C D, then C A, then G.
const yourBars: NoteEvent[] = [
  { midi: 69, onsetBeat: 0.03, durationBeats: 0.45 },
  { midi: 72, onsetBeat: 0.52, durationBeats: 0.44 },
  { midi: 74, onsetBeat: 0.98, durationBeats: 0.9 },
  { midi: 72, onsetBeat: 4.02, durationBeats: 0.5 },
  { midi: 69, onsetBeat: 4.5, durationBeats: 1.4 },
  { midi: 67, onsetBeat: 8, durationBeats: 2 },
];
const ctx = (round: number): TradeContext => ({ chords: blues, windowStart: 16, key: 'A', scale: 'minor-pentatonic', round, seed: 3 });
const chordAt = (beat: number) => blues.find((c) => beat >= c.startBeat && beat < c.endBeat)!;

describe('trading fours', () => {
  it('hears the first idea in your phrase despite human timing', () => {
    const m = extractMotif(yourBars)!;
    assert.deepEqual(m.intervals, [3, 2]);
    assert.deepEqual(m.offsets, [0, 0.5, 1]);
  });

  for (let round = 0; round < TECHNIQUES.length; round++) {
    it(`answer ${round + 1} (${TECHNIQUES[round]}) is playable over the next four bars`, () => {
      const r = respondTo(yourBars, ctx(round));
      assert.equal(r.technique, TECHNIQUES[round]);
      assert.equal(r.fromYou, true);
      assert.ok(r.notes.length >= 6, 'enough notes to be a phrase');
      for (let i = 0; i < r.notes.length; i++) {
        const n = r.notes[i];
        assert.ok(n.onsetBeat >= 16 && n.onsetBeat < 32, `note at ${n.onsetBeat} is outside the answer`);
        assert.ok(n.midi >= 55 && n.midi <= 81, `note ${n.midi} is outside the register`);
        if (i > 0) assert.ok(r.notes[i - 1].onsetBeat + r.notes[i - 1].durationBeats <= n.onsetBeat + 1e-9, 'notes overlap');
        const inBar = (n.onsetBeat - 16) % 4;
        if (Math.abs(inBar - Math.round(inBar)) < 1e-9 && Math.round(inBar) % 2 === 0) {
          const chord = chordAt(n.onsetBeat);
          assert.ok(parseChord(chord.symbol).pcs.includes(pc(n.midi)), `beat ${n.onsetBeat}: ${n.midi} is not in ${chord.symbol}`);
        }
      }
      // Bar 1 states your rhythm and shape.
      const bar1 = r.notes.filter((n) => n.onsetBeat < 20);
      assert.deepEqual(bar1.map((n) => n.onsetBeat - 16), [0, 0.5, 1]);
      assert.ok(bar1[1].midi > bar1[0].midi && bar1[2].midi > bar1[1].midi, 'keeps the upward shape');
      // Bar 4 lands on the 3rd of A7 (C#) on the downbeat.
      const landing = r.notes[r.notes.length - 1];
      assert.equal(landing.onsetBeat, 28);
      assert.equal(pc(landing.midi), 1);
      assert.match(r.description, /your 3-note idea/);
    });
  }

  it('develops the idea the way each technique says', () => {
    const bar2 = (round: number) => respondTo(yourBars, ctx(round)).notes.filter((n) => n.onsetBeat >= 20 && n.onsetBeat < 24).map((n) => n.onsetBeat - 20);
    assert.deepEqual(bar2(TECHNIQUES.indexOf('displace')), [0.5, 1, 1.5]);
    assert.deepEqual(bar2(TECHNIQUES.indexOf('augment')), [0, 1, 2]);
    assert.deepEqual(bar2(TECHNIQUES.indexOf('fragment')), [0, 0.5, 1, 2, 2.5, 3]);
    const inv = respondTo(yourBars, ctx(TECHNIQUES.indexOf('invert'))).notes.filter((n) => n.onsetBeat >= 20 && n.onsetBeat < 24);
    assert.ok(inv[1].midi < inv[0].midi && inv[2].midi < inv[1].midi, 'inversion goes down where you went up');
  });

  it('is repeatable and can open the trade itself', () => {
    assert.deepEqual(respondTo(yourBars, ctx(2)), respondTo(yourBars, ctx(2)));
    const call = createCall({ ...ctx(0), windowStart: 0 });
    assert.equal(call.fromYou, false);
    assert.match(call.description, /for you to answer/);
    assert.ok(call.notes.every((n) => n.onsetBeat >= 0 && n.onsetBeat < 16));
  });

  it('scores your reply against the idea it answered', () => {
    const answer = respondTo(yourBars, ctx(0));
    const window = 32;
    const echo = answer.motif.offsets.map((o, i) => ({
      midi: 64 + answer.motif.intervals.slice(0, i).reduce((a, b) => a + b, 0),
      onsetBeat: window + o + 0.02,
      durationBeats: answer.motif.durations[i],
    }));
    echo.push({ midi: 69, onsetBeat: window + 8, durationBeats: 2 }); // A over A7 (bar 11)
    const close = compareReply(answer.motif, echo, blues, window);
    assert.equal(close.rhythm, 1);
    assert.equal(close.contour, 1);
    assert.equal(close.landedOnChordTone, true);
    assert.match(close.comment, /echoed my idea/);
    const silent = compareReply(answer.motif, [], blues, window);
    assert.match(silent.comment, /did not hear a reply/);
    const wrongEnd = compareReply(answer.motif, [{ midi: 70, onsetBeat: window + 9, durationBeats: 1 }], blues, window);
    assert.equal(wrongEnd.landedOnChordTone, false);
  });
});

describe('ear trainer', () => {
  const t0 = Date.UTC(2026, 9, 1, 12);
  it('starts with four easy intervals and never repeats a question back to back', () => {
    const rand = rng(1);
    const s = initialEarState();
    assert.deepEqual(unlockedItems(s, 'interval').map((i) => i.short), ['P5', 'M3', 'm3', 'P8']);
    let last: string | undefined;
    for (let k = 0; k < 50; k++) {
      const q = nextQuestion(s, 'interval', rand, t0, last);
      assert.notEqual(q.item.id, last);
      assert.ok(LEVELS.interval[0].includes(q.item.id));
      assert.equal(q.choices.length, 4);
      const span = Math.abs(q.midis[q.midis.length - 1] - q.midis[0]);
      assert.equal(span, q.item.tones[1]);
      if (q.style === 'descending') assert.ok(q.midis[0] > q.midis[1]);
      last = q.item.id;
    }
  });

  it('moves right answers up the boxes and brings wrong ones back soon', () => {
    let s: EarState = initialEarState();
    const q = nextQuestion(s, 'chord', rng(2), t0);
    let r = answerQuestion(s, q, q.item.id, t0);
    assert.equal(r.state.items[q.item.id].box, 2);
    assert.equal(r.state.items[q.item.id].due, t0 + 86_400_000);
    s = r.state;
    r = answerQuestion(s, q, q.item.id, t0 + 1000);
    assert.equal(r.state.items[q.item.id].box, 3);
    const wrong = q.choices.find((c) => c.id !== q.item.id)!;
    r = answerQuestion(r.state, q, wrong.id, t0 + 2000);
    assert.equal(r.correct, false);
    assert.equal(r.state.items[q.item.id].box, 1);
    assert.equal(r.state.items[q.item.id].due, t0 + 22_000);
  });

  it('unlocks the next set once the current one is solid', () => {
    let s = initialEarState();
    let unlocked = false;
    for (const id of LEVELS.chord[0]) {
      for (let k = 0; k < 3; k++) {
        const q = { ...nextQuestion(s, 'chord', rng(k), t0), item: unlockedItems(s, 'chord').find((i) => i.id === id)! };
        const r = answerQuestion(s, q, id, t0 + k);
        s = r.state;
        unlocked ||= r.unlockedNew;
      }
    }
    assert.ok(unlocked);
    assert.equal(s.unlocked.chord, 2);
    assert.equal(unlockedItems(s, 'chord').length, 5);
  });

  it('runs a five-minute session on its own clock', () => {
    let now = t0;
    const session = new EarSession(initialEarState(), 'mixed', () => now, rng(9));
    let answered = 0;
    while (session.next()) {
      const q = session.current!;
      session.answer(answered % 5 === 4 ? q.choices.find((c) => c.id !== q.item.id)!.id : q.item.id);
      answered++;
      now += 4000;
    }
    assert.equal(answered, 75);
    const sum = session.summary();
    assert.equal(sum.answered, 75);
    assert.equal(sum.correct, 60);
    assert.equal(sum.accuracy, 0.8);
    assert.ok(sum.hardest.length > 0);
    assert.equal(session.finish().sessions, 1);
  });
});

describe('jam links', () => {
  const jam: JamSession = { v: 1, mode: 'trade', title: 'Điệu Bắc jam ♪', groove: 'vietnamese-folk', key: 'G', bpm: 84, scale: 'dieu-bac', licks: ['dieu-bac-1'], focus: 'Land on Xang (C) at the end of each answer.' };
  it('round-trips through a URL, Vietnamese text included', () => {
    const link = jamLink('https://guitarpulse.app/', jam);
    assert.match(link, /^https:\/\/guitarpulse\.app\/jam\?s=[A-Za-z0-9_-]+$/);
    const decoded = decodeJam(new URL(link).searchParams.get('s')!);
    assert.deepEqual(decoded, { ok: true, session: jam });
    assert.equal(encodeJam(jam).includes('='), false);
  });
  it('explains what is wrong with a bad link', () => {
    const bad = decodeJam('not-a-real-link');
    assert.equal(bad.ok, false);
    const unknown = decodeJam(encodeJam({ ...jam, groove: 'polka' }));
    assert.equal(unknown.ok, false);
    if (!unknown.ok) assert.match(unknown.error, /Unknown groove "polka".*slow-blues/);
    const chart = decodeJam(encodeJam({ v: 1, mode: 'song', chart: '| Am7 | Hm7 |' }));
    assert.equal(chart.ok, false);
    if (!chart.ok) assert.match(chart.error, /Bar 2/);
    assert.throws(() => encodeJam({ ...jam, bpm: 900 }));
  });
  it('describes a session in one line', () => {
    assert.equal(describeJam(jam), 'Trading fours, Điệu Bắc folk in G at 84 BPM, using Điệu Bắc (Bắc mode), with 1 lick to work in');
  });
});

describe('progress record', () => {
  const at = (y: number, m: number, d: number, h = 18) => new Date(y, m - 1, d, h);
  const rec = (id: string, d: Date, durationSec = 600, metrics?: Record<string, number>): SessionRecord => ({ id, kind: 'coach', startedAt: d.getTime(), durationSec, title: id, metrics });
  it('counts a streak of practice days and resets after a missed day', () => {
    let p = emptyProgress();
    p = addSession(p, rec('a', at(2026, 10, 1)), at(2026, 10, 1));
    p = addSession(p, rec('b', at(2026, 10, 1, 20)), at(2026, 10, 1, 20));
    p = addSession(p, rec('c', at(2026, 10, 2)), at(2026, 10, 2));
    assert.equal(p.streak.current, 2);
    assert.equal(currentStreak(p, at(2026, 10, 3)), 2);
    assert.equal(currentStreak(p, at(2026, 10, 4)), 0);
    p = addSession(p, rec('d', at(2026, 10, 5), 30), at(2026, 10, 5));
    assert.equal(p.streak.current, 2, 'a 30-second session does not count');
    p = addSession(p, rec('e', at(2026, 10, 5)), at(2026, 10, 5));
    assert.equal(p.streak.current, 1);
    assert.equal(p.streak.best, 2);
    assert.equal(p.totals.sessions, 5);
  });
  it('tracks a metric over time and merges two devices', () => {
    let a = emptyProgress();
    let b = emptyProgress();
    a = addSession(a, rec('x', at(2026, 10, 1), 600, { chordToneRatio: 0.4 }), at(2026, 10, 1));
    b = addSession(b, rec('y', at(2026, 10, 2), 600, { chordToneRatio: 0.55 }), at(2026, 10, 2));
    b = addSession(b, rec('x', at(2026, 10, 1), 600, { chordToneRatio: 0.4 }), at(2026, 10, 2));
    const m = mergeProgress(a, b);
    assert.deepEqual(m.sessions.map((s) => s.id), ['x', 'y']);
    assert.deepEqual(metricTrend(m, 'chordToneRatio').map((t) => t.value), [0.4, 0.55]);
    assert.equal(m.totals.minutes, 20);
  });
  it('keeps the record bounded', () => {
    let p = emptyProgress();
    for (let i = 0; i < MAX_SESSIONS + 20; i++) p = addSession(p, rec(`s${i}`, new Date(2026, 0, 1, 0, i)), new Date(2026, 0, 1, 0, i));
    assert.equal(p.sessions.length, MAX_SESSIONS);
    assert.equal(p.sessions[0].id, 's20');
  });
});
