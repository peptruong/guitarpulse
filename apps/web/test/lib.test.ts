import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { getGroove } from '@guitarpulse/core/grooves';
import { decodeJam, encodeJam } from '@guitarpulse/core/session';
import { buildCoachRequest, COACH_TOOL, CoachRequestSchema, parseCoachResponse, type CoachRequest } from '../lib/coachPrompt';
import { degreeOf, degreeRole, roleInScale } from '../lib/degrees';
import { fretWindow, replayFrame } from '../lib/replay';
import { boxKey, canonicalKey, chordAtBeat, defaultSettings, grooveChords, keyRoot, linkFor, loopLength, settingsFromSession, unrollChords } from '../lib/settings';
import { barInWindow, decisionBeat, notesInWindow, turnFor, windowIndex, windowStart } from '../lib/trade';

const request: CoachRequest = {
  groove: 'slow-blues',
  grooveName: 'Slow blues',
  key: 'A',
  scale: 'minor-pentatonic',
  bpm: 64,
  minutes: 3.2,
  noteCount: 84,
  verdicts: [
    { label: 'Chord tones on beats 1 and 3', value: 0.31, status: 'work on this (target ≥ 0.5)' },
    { label: 'Timing spread', value: 22, status: 'good' },
  ],
  focus: { label: 'Chord tones on beats 1 and 3', exercise: 'Aim for the 3rd of each chord on beat 1.' },
  boxes: { box1Share: 0.82, boxesUsed: 2, lowestFret: 5, highestFret: 10, advice: 'Most notes were in box 1.' },
  opening: [{ note: 'C', beat: 0.5, beats: 1 }],
};

describe('Claude coach request', () => {
  it('forces the feedback tool and sends only measurements', () => {
    const body = buildCoachRequest(request, 'claude-haiku-5-5');
    assert.equal(body.model, 'claude-haiku-5-5');
    assert.deepEqual(body.tool_choice, { type: 'tool', name: COACH_TOOL.name });
    assert.match(body.messages[0].content, /Chord tones on beats 1 and 3: 0.31/);
    assert.match(body.messages[0].content, /82% in pentatonic box 1/);
    assert.ok(!JSON.stringify(body).includes('x-api-key'));
  });
  it('rejects malformed input', () => {
    assert.equal(CoachRequestSchema.safeParse({ ...request, bpm: 5000 }).success, false);
    assert.equal(CoachRequestSchema.safeParse({ ...request, verdicts: 'lots' }).success, false);
  });
  it('accepts a valid tool call and repairs an unknown groove', () => {
    const input = { headline: 'Great feel, now aim at the 3rds.', strengths: ['Timing spread of 22 ms is tight.'], fixes: [{ issue: 'Only 31% chord tones on strong beats.', drill: 'Play C# on beat 1 of every A7 bar.' }], next_session: { groove: 'polka', bpm: 60, focus: 'Land on 3rds.' } };
    const advice = parseCoachResponse({ content: [{ type: 'text', text: 'hi' }, { type: 'tool_use', name: 'coach_feedback', input }] }, 'slow-blues');
    assert.ok(advice);
    assert.equal(advice!.next_session.groove, 'slow-blues');
    assert.equal(parseCoachResponse({ content: [{ type: 'tool_use', name: 'coach_feedback', input: { headline: 'x' } }] }, 'slow-blues'), null);
    assert.equal(parseCoachResponse({ error: 'overloaded' }, 'slow-blues'), null);
  });
});

describe('settings and links', () => {
  it('reads keys and spells them like the key menu', () => {
    assert.equal(keyRoot('A minor'), 'A');
    assert.equal(keyRoot('Bbm'), 'Bb');
    assert.equal(keyRoot('H'), null);
    assert.equal(canonicalKey('A#'), 'Bb');
    assert.equal(canonicalKey('Gb'), 'F#');
  });
  it('opens a jam link with the groove defaults filled in', () => {
    const s = settingsFromSession({ v: 1, mode: 'trade', groove: 'city-pop', key: 'E minor' });
    assert.deepEqual(s, { grooveId: 'city-pop', progression: 0, key: 'E', bpm: getGroove('city-pop').bpm.default, scale: getGroove('city-pop').scales[0] });
    const back = decodeJam(linkFor('coach', s, { focus: 'Answer with the same rhythm' }).split('?s=')[1]);
    assert.ok(back.ok && back.session.mode === 'coach' && back.session.focus === 'Answer with the same rhythm');
    const fallback = settingsFromSession(JSON.parse(JSON.stringify({ v: 1, mode: 'studio', groove: 'slow-blues', progression: 9 })));
    assert.equal(fallback.progression, 0);
  });
  it('unrolls a looping progression across choruses', () => {
    const chords = grooveChords(defaultSettings('slow-blues'));
    const len = loopLength(chords);
    assert.equal(len, 48);
    const two = unrollChords(chords, len, 0, 96);
    assert.equal(two.length, chords.length * 2);
    assert.equal(two[chords.length].startBeat, 48);
    assert.equal(chordAtBeat(chords, len, 52).chord.symbol, 'D7');
    assert.equal(chordAtBeat(chords, len, 100).chord.symbol, 'D7');
  });
  it('counts pentatonic boxes from the relative minor in major keys', () => {
    assert.deepEqual(boxKey('C', 'major-pentatonic'), { key: 'A', minor: true });
    assert.deepEqual(boxKey('A', 'minor-pentatonic'), { key: 'A', minor: true });
  });
});

describe('trading fours turns', () => {
  it('alternates four-bar windows', () => {
    assert.equal(turnFor(0, true), 'you');
    assert.equal(turnFor(1, true), 'app');
    assert.equal(turnFor(0, false), 'app');
    assert.equal(windowIndex(15.9), 0);
    assert.equal(windowIndex(16), 1);
    assert.equal(windowStart(2), 32);
    assert.equal(decisionBeat(0), 15.25);
    assert.equal(barInWindow(-2), 0);
    assert.equal(barInWindow(21), 2);
  });
  it('collects the notes of a window, allowing a slightly early first note', () => {
    const notes = [15.6, 15.8, 16.1, 20, 31.7, 31.8].map((onsetBeat) => ({ midi: 60, onsetBeat, durationBeats: 0.5 }));
    assert.deepEqual(notesInWindow(notes, 1).map((n) => n.onsetBeat), [15.8, 16.1, 20, 31.7]);
  });
});

describe('heatmap replay', () => {
  const notes = [
    { midi: 69, onsetBeat: 0, durationBeats: 1, string: 1, fret: 5 },
    { midi: 72, onsetBeat: 1, durationBeats: 1, string: 1, fret: 8 },
    { midi: 69, onsetBeat: 2, durationBeats: 2, string: 1, fret: 5 },
  ];
  it('builds heat up to the replay position and lights the sounding note', () => {
    const at = replayFrame(notes, 2.5);
    const a5 = at.find((c) => c.fret === 5)!;
    assert.equal(a5.count, 2);
    assert.equal(a5.active, true);
    assert.equal(a5.heat, 1);
    assert.equal(at.find((c) => c.fret === 8)!.active, false);
    assert.deepEqual(replayFrame(notes, -1), []);
  });
  it('frames the frets that were used', () => {
    assert.deepEqual(fretWindow(notes), { start: 3, end: 15 });
    assert.deepEqual(fretWindow([]), { start: 0, end: 12 });
  });
});

describe('degree colours', () => {
  it('maps degrees to roles and handles flats by pitch class', () => {
    assert.equal(degreeRole('b3'), 'third');
    assert.equal(degreeRole('9'), 'ext');
    assert.equal(degreeOf(70, 7), 'b3'); // Bb over G
    assert.equal(roleInScale(70, 7, [7, 10, 0, 2, 5]), 'third');
    assert.equal(roleInScale(71, 7, [7, 10, 0, 2, 5]), 'other');
  });
});

describe('jam codes survive the URL', () => {
  it('encodes with URL-safe characters only', () => {
    const code = encodeJam({ v: 1, mode: 'song', chart: '| Fmaj7 | E7 | Am7 | Gm7 C7 |', groove: 'neo-soul' });
    assert.match(code, /^[A-Za-z0-9_-]+$/);
  });
});
