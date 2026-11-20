/**
 * Self-check: starts the built server over stdio, calls every tool as Claude would, and exits
 * non-zero on any failure. Run with: npm run build && npm run smoke
 */
import { strict as assert } from 'node:assert';
import { Client } from '@modelcontextprotocol/client';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { decodeJam } from '@guitarpulse/core/session';

const client = new Client({ name: 'guitarpulse-smoke', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: 'node', args: ['dist/index.js'], env: { ...getDefaultEnvironment(), GUITARPULSE_APP_URL: 'https://guitarpulse.example' } }));

const text = (r: { content?: unknown }) => ((r.content as { type: string; text: string }[])?.[0]?.text ?? '');
const call = async (name: string, args: Record<string, unknown>) => {
  const r = await client.callTool({ name, arguments: args });
  assert.ok(!r.isError, `${name} failed: ${text(r)}`);
  return r;
};

const { tools } = await client.listTools();
assert.deepEqual(tools.map((t) => t.name).sort(), [
  'guitarpulse_analyze_improv_session',
  'guitarpulse_create_jam_session',
  'guitarpulse_generate_practice_plan',
  'guitarpulse_get_chord_voicings',
  'guitarpulse_get_scale',
  'guitarpulse_list_catalog',
  'guitarpulse_mutate_lick',
  'guitarpulse_search_licks',
  'guitarpulse_song_to_practice',
  'guitarpulse_suggest_scales_for_progression',
]);
for (const t of tools) assert.equal(t.annotations?.readOnlyHint, true, `${t.name} should be read-only`);

const catalog = await call('guitarpulse_list_catalog', { response_format: 'json' });
assert.ok((catalog.structuredContent as { scales: unknown[] }).scales.length >= 35);
assert.ok((catalog.structuredContent as { grooves: { id: string }[] }).grooves.some((g) => g.id === 'cai-luong'));
assert.ok((catalog.structuredContent as { lickGenres: string[] }).lickGenres.includes('vietnamese'));

const scale = await call('guitarpulse_get_scale', { root: 'A', scale: 'minor pentatonic', pattern: 'box', position: 1 });
assert.match(text(scale), /String 6: 5\(R\) A, 8 C/);

const voicings = await call('guitarpulse_get_chord_voicings', { chord: 'Cmaj7', systems: ['drop2', 'shell'], response_format: 'json' });
assert.ok((voicings.structuredContent as { voicings: unknown[] }).voicings.length >= 4);

const prog = await call('guitarpulse_suggest_scales_for_progression', { progression: 'Dm7 G7 Cmaj7', key: 'C' });
assert.match(text(prog), /\*\*Best:\*\* D Dorian/);

const licks = await call('guitarpulse_search_licks', { genre: 'neo-soul', limit: 3 });
assert.match(text(licks), /```alphatex/);
assert.match(text(licks), /More results: call again with offset=3/);

const page = await call('guitarpulse_search_licks', { limit: 30, include_tab: true, response_format: 'json' });
assert.ok(text(page).length <= 25_000, 'search results must stay under the character limit');

const session = await call('guitarpulse_analyze_improv_session', {
  bpm: 90,
  total_beats: 8,
  chords: [{ symbol: 'A7', start_beat: 0, end_beat: 8 }],
  notes: [
    { midi: 73, onset_beat: 0, duration_beats: 1 },
    { midi: 76, onset_beat: 1, duration_beats: 0.5 },
    { midi: 69, onset_beat: 2, duration_beats: 2, peak_bend_cents: 190 },
  ],
});
assert.match(text(session), /Chord tones on beats 1 and 3: 1/);

const plan = await call('guitarpulse_generate_practice_plan', { level: 2, goals: ['neo-soul'], weeks: 6 });
assert.match(text(plan), /## Week 6: Review and record/);

const mutated = await call('guitarpulse_mutate_lick', { lick_id: 'bb-king-1', mutations: [{ op: 'transpose', to_key: 'C' }, { op: 'displace' }], response_format: 'json' });
const ml = (mutated.structuredContent as { lick: { key: string; alphaTex: string }; steps: unknown[] });
assert.equal(ml.lick.key, 'C');
assert.equal(ml.steps.length, 2);
assert.match(text(await call('guitarpulse_mutate_lick', { lick_id: 'bb-king-1', mutations: [{ op: 'flip' }] })), /```alphatex/);

const song = await call('guitarpulse_song_to_practice', { chart: '| Fmaj7 | E7 | Am7 | Gm7 C7 |', groove: 'neo-soul' });
assert.match(text(song), /Song practice in F major/);
assert.match(text(song), /Just the Two of Us/);
const songLink = /https:\/\/guitarpulse\.example\/jam\?s=([\w-]+)/.exec(text(song));
assert.ok(songLink, 'song practice returns an app link');
const songJam = decodeJam(songLink[1]);
assert.ok(songJam.ok && songJam.session.mode === 'song' && songJam.session.groove === 'neo-soul');

const jam = await call('guitarpulse_create_jam_session', { mode: 'trade', groove: 'city-pop', key: 'D', bpm: 104, lick_ids: ['city-pop-1'], focus: 'Answer with the same rhythm' });
const jamData = jam.structuredContent as { link: string; summary: string };
assert.match(jamData.link, /^https:\/\/guitarpulse\.example\/jam\?s=/);
const decoded = decodeJam(new URL(jamData.link).searchParams.get('s')!);
assert.ok(decoded.ok && decoded.session.groove === 'city-pop' && decoded.session.licks?.[0] === 'city-pop-1');
assert.match(jamData.summary, /Trading fours, City pop in D at 104 BPM/);
const ear = await call('guitarpulse_create_jam_session', { mode: 'ear', ear_mode: 'chord', ear_minutes: 5 });
assert.match(text(ear), /5 minutes of chords/);
const badJam = await client.callTool({ name: 'guitarpulse_create_jam_session', arguments: { mode: 'trade', groove: 'slow-blues', progression: 7 } });
assert.equal(badJam.isError, true);
assert.match(text(badJam), /has 2 progression/);
const noGroove = await client.callTool({ name: 'guitarpulse_create_jam_session', arguments: { mode: 'coach' } });
assert.equal(noGroove.isError, true);
assert.match(text(noGroove), /Give a groove or a chord chart/);
const badLick = await client.callTool({ name: 'guitarpulse_mutate_lick', arguments: { lick_id: 'nobody-9', mutations: [{ op: 'flip' }] } });
assert.equal(badLick.isError, true);
assert.match(text(badLick), /guitarpulse_search_licks/);

// Bad input must come back as a readable tool error, not a crash.
const badChord = await client.callTool({ name: 'guitarpulse_get_chord_voicings', arguments: { chord: 'H7' } });
assert.equal(badChord.isError, true);
assert.match(text(badChord), /Try forms like/);
const badRoot = await client.callTool({ name: 'guitarpulse_get_scale', arguments: { root: 'Z', scale: 'dorian' } });
assert.equal(badRoot.isError, true);

await client.close();
console.error(`Smoke test passed: ${tools.length} tools answered correctly over stdio.`);
