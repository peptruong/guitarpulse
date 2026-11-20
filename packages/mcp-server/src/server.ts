import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { assessSession } from '@guitarpulse/core/coach/assess';
import { GROOVES } from '@guitarpulse/core/grooves';
import { lickMarkdown, metricsMarkdown, mutationMarkdown, progressionMarkdown, scaleMarkdown, songMarkdown, voicingsMarkdown } from './format.js';
import { ARTISTS, findArtist } from '@guitarpulse/core/licks/artists';
import { getLick, lickFacets, searchLicks } from '@guitarpulse/core/licks/index';
import { LICK_GENRES, type Lick } from '@guitarpulse/core/licks/types';
import { mutateLick, MUTATIONS, type Mutation } from '@guitarpulse/core/mutator';
import { GOALS, generatePracticePlan } from '@guitarpulse/core/practice/plan';
import { describeJam, JAM_MODES, jamLink, jamProblems, type JamSession } from '@guitarpulse/core/session';
import { songToPractice } from '@guitarpulse/core/song';
import { suggestScales } from '@guitarpulse/core/theory/chordScale';
import { getTuning, TUNINGS } from '@guitarpulse/core/theory/notes';
import { getScale, SCALES } from '@guitarpulse/core/theory/scales';
import { getChordVoicings, VOICING_SYSTEMS } from '@guitarpulse/core/theory/voicings';

export const SERVER_NAME = 'guitarpulse-mcp-server';
export const SERVER_VERSION = '2.0.0';
const CHARACTER_LIMIT = 25_000;
const GROOVE_IDS = GROOVES.map((g) => g.id) as [string, ...string[]];

/** Where jam links point. Set GUITARPULSE_APP_URL to your deployed app. */
export function appUrl() {
  return process.env.GUITARPULSE_APP_URL?.trim() || 'http://localhost:3000';
}

const responseFormat = z.enum(['markdown', 'json']).default('markdown').describe("'markdown' for readable text (default), 'json' for the full structured data");
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

type Format = 'markdown' | 'json';
function reply(format: Format, data: Record<string, unknown>, markdown: () => string) {
  if (format === 'json') return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
  return { content: [{ type: 'text' as const, text: markdown() }] };
}

export function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    'guitarpulse_list_catalog',
    {
      title: 'List GuitarPulse catalog',
      description: `List what GuitarPulse knows: scale ids, tunings, chord-voicing systems, backing-track grooves (with their progressions), lick genres and artists, and practice goals.
Call this first when you are unsure of a valid scale id, tuning id, groove id, genre or artist name for the other guitarpulse_* tools.`,
      inputSchema: z.strictObject({ response_format: responseFormat }),
      annotations: READ_ONLY,
    },
    async ({ response_format }) => {
      const data = {
        scales: SCALES.map((s) => ({ id: s.id, name: s.name, family: s.family, formula: s.degrees.join(' '), difficulty: s.difficulty })),
        tunings: Object.entries(TUNINGS).map(([id, t]) => ({ id, label: t.label, strings: t.midi.length })),
        voicingSystems: VOICING_SYSTEMS,
        grooves: GROOVES.map((g) => ({ id: g.id, name: g.name, category: g.category, description: g.description, bpm: g.bpm, progressions: g.progressions.map((p, i) => ({ index: i, ...p })), scales: g.scales })),
        lickGenres: LICK_GENRES,
        licks: lickFacets(),
        goals: GOALS,
      };
      return reply(response_format, data, () =>
        [
          '# GuitarPulse catalog',
          '## Scales (id: formula)',
          ...SCALES.map((s) => `- ${s.id}: ${s.degrees.join(' ')} (${s.family})`),
          '## Tunings',
          ...Object.entries(TUNINGS).map(([id, t]) => `- ${id}: ${t.label}`),
          '## Backing-track grooves (id: name, BPM range; progressions by index)',
          ...GROOVES.map((g) => `- ${g.id}: ${g.name}${g.category === 'asia' ? ' [Asia pack]' : ''}, ${g.bpm.min}-${g.bpm.max} BPM; ${g.progressions.map((p, i) => `${i}: ${p.name} (${p.roman}, key ${p.key})`).join('; ')}`),
          `## Voicing systems\n${VOICING_SYSTEMS.join(', ')}`,
          `## Licks: ${data.licks.total} style studies`,
          `- Genres: ${Object.entries(data.licks.genres).map(([g, n]) => `${g} (${n})`).join(', ')}`,
          `- Artists: ${ARTISTS.map((a) => a.name).join(', ')}`,
          `## Practice goals\n${GOALS.join(', ')}`,
        ].join('\n'),
      );
    },
  );

  server.registerTool(
    'guitarpulse_get_scale',
    {
      title: 'Get scale',
      description: `Spell any scale or mode from any root and map it onto the fretboard.

Returns the notes (spelled correctly for the key), formula, pitch classes, the colour notes that define the mode, and every fret position with its degree.
Use pattern "box" (pentatonic boxes 1-5) or "3nps" (7-note 3-notes-per-string patterns 1-7) to get one playable position instead of the whole neck.

Examples:
  - "Show me A minor pentatonic box 1" -> root="A", scale="minor-pentatonic", pattern="box", position=1
  - "What notes are in Eb dorian?" -> root="Eb", scale="dorian"
  - "G major 3nps pattern 3 on 7-string" -> root="G", scale="ionian", pattern="3nps", position=3, tuning="seven-string"
Scale names are flexible ("harmonic minor", "phrygian dominant", "altered"); guitarpulse_list_catalog lists every id.`,
      inputSchema: z.strictObject({
        root: z.string().regex(/^[A-Ga-g][#b♯♭]?$/).describe('Root note, e.g. "A", "F#", "Bb"'),
        scale: z.string().min(2).max(40).describe('Scale id or name, e.g. "minor-pentatonic", "dorian", "harmonic minor"'),
        tuning: z.string().default('standard').describe('Tuning id: standard, drop-d, eb-standard, drop-c, dadgad, open-g, open-e, seven-string, eight-string'),
        pattern: z.enum(['full', 'box', '3nps']).default('full').describe("'full' = whole neck, 'box' = 2 notes per string (pentatonics), '3nps' = 3 notes per string (7-note scales)"),
        position: z.number().int().min(1).max(7).default(1).describe('Which box or 3NPS pattern (1-5 for boxes, 1-7 for 3NPS)'),
        max_fret: z.number().int().min(5).max(24).default(15).describe('Highest fret to include in full-neck mode'),
        response_format: responseFormat,
      }),
      annotations: READ_ONLY,
    },
    async ({ root, scale, tuning, pattern, position, max_fret, response_format }) => {
      const s = getScale({ root, scale, tuning, pattern, position, maxFret: max_fret });
      return reply(response_format, { ...s }, () => scaleMarkdown(s, getTuning(tuning).length));
    },
  );

  server.registerTool(
    'guitarpulse_get_chord_voicings',
    {
      title: 'Get chord voicings',
      description: `Find playable voicings for a chord symbol, grouped by system: CAGED shapes, triads on each string set, shell voicings (root-3-7), drop-2 and drop-3.

Each voicing has a chart (lowest string first, e.g. "x32010"), suggested fingers, notes, scale degrees, inversion and any barre.
Accepts symbols like C, Am7, G7, Cmaj9, F#m7b5, Bb7#9, E7alt, Bdim7, C6/9, Dsus4 and slash chords (Am7/G).

Examples:
  - "How do I play Cmaj7 as drop-2?" -> chord="Cmaj7", systems=["drop2"]
  - "Triad inversions of D on the top strings" -> chord="D", systems=["triad"]
  - "Jazz shells for G7" -> chord="G7", systems=["shell"]`,
      inputSchema: z.strictObject({
        chord: z.string().min(1).max(20).describe('Chord symbol, e.g. "Am7", "G7", "F#m7b5", "C/E"'),
        systems: z.array(z.enum(VOICING_SYSTEMS as [string, ...string[]])).max(5).default([]).describe('Any of caged, triad, shell, drop2, drop3. Empty = all'),
        tuning: z.string().default('standard').describe('Tuning id (CAGED needs standard)'),
        max_fret: z.number().int().min(3).max(24).default(15).describe('Highest fret to search'),
        limit_per_system: z.number().int().min(1).max(12).default(4).describe('Voicings to return per system'),
        response_format: responseFormat,
      }),
      annotations: READ_ONLY,
    },
    async ({ chord, systems, tuning, max_fret, limit_per_system, response_format }) => {
      const r = getChordVoicings({ chord, systems: systems as typeof VOICING_SYSTEMS, tuning, maxFret: max_fret, limitPerSystem: limit_per_system });
      return reply(response_format, { ...r }, () => voicingsMarkdown(r));
    },
  );

  server.registerTool(
    'guitarpulse_suggest_scales_for_progression',
    {
      title: 'Suggest scales for a progression',
      description: `For each chord in a progression: chord tones, guide tones (3rd and 7th), ranked scales with the reason each fits, and avoid notes.
Also gives one-scale-for-everything options (key scale, pentatonic, blues) and a guide-tone line showing how each 3rd/7th moves to the next chord.
It recognises V7 chords resolving down a fifth (suggesting altered or Phrygian dominant) and 12-bar blues (suggesting minor/major pentatonic).

Examples:
  - "What do I play over Dm7 G7 Cmaj7?" -> progression=["Dm7","G7","Cmaj7"], key="C"
  - "Scales for a blues in A" -> progression=["A7","D7","E7"]
  - "Soloing over Am G F E" -> progression=["Am","G","F","E"], key="A minor"`,
      inputSchema: z.strictObject({
        progression: z.union([z.array(z.string().min(1).max(20)).min(1).max(32), z.string().min(1).max(400)]).describe('Chord symbols as an array, or one string separated by spaces, commas or bars'),
        key: z.string().max(30).optional().describe('Optional key, e.g. "C", "Em", "E minor", "A dorian"'),
        loops: z.boolean().default(true).describe('Whether the last chord goes back to the first (affects V-I detection)'),
        response_format: responseFormat,
      }),
      annotations: READ_ONLY,
    },
    async ({ progression, key, loops, response_format }) => {
      const chords = Array.isArray(progression) ? progression : progression.split(/[\s,|]+/).filter(Boolean);
      const a = suggestScales(chords, key, loops);
      return reply(response_format, { ...a }, () => progressionMarkdown(a));
    },
  );

  server.registerTool(
    'guitarpulse_search_licks',
    {
      title: 'Search the licks vault',
      description: `Search ${searchLicks({}).total} original style-study licks across ${ARTISTS.length} guitarists (two or more per player).
Each lick is newly written in the style of the artist (not a transcription) and comes as alphaTex tab, playable in alphaTab with speed control and looping.

Filter by artist, genre, technique, key, scale, difficulty (1-5) or free text. Results are paginated with offset/limit.
Set include_tab=false for a quick overview; call again with include_tab=true for the tab.

Examples:
  - "Easy blues licks" -> genre="blues", max_difficulty=2
  - "Tapping licks" -> technique="tapping"
  - "Licks in the style of Gilmour" -> artist="Gilmour"
  - "Something over a ii-V-I" -> text="ii V I"`,
      inputSchema: z.strictObject({
        artist: z.string().max(60).optional().describe('Part of an artist name, e.g. "Mayer", "B.B."'),
        genre: z.enum(LICK_GENRES).optional().describe('Genre filter'),
        technique: z.string().max(40).optional().describe('Technique, e.g. "bend", "tapping", "hybrid-picking", "double-stop", "legato"'),
        key: z.string().max(3).optional().describe('Key root, e.g. "A", "E", "Bb"'),
        scale: z.string().max(40).optional().describe('Scale id, e.g. "minor-pentatonic", "dorian"'),
        min_difficulty: z.number().int().min(1).max(5).optional().describe('Lowest difficulty (1 easy - 5 hard)'),
        max_difficulty: z.number().int().min(1).max(5).optional().describe('Highest difficulty (1 easy - 5 hard)'),
        text: z.string().max(100).optional().describe('Words to match in title, theory note, chord or techniques'),
        include_tab: z.boolean().default(true).describe('Include the alphaTex tab for each lick'),
        limit: z.number().int().min(1).max(30).default(8).describe('Licks to return'),
        offset: z.number().int().min(0).default(0).describe('Licks to skip, for pagination'),
        response_format: responseFormat,
      }),
      annotations: READ_ONLY,
    },
    async (q) => {
      const page = searchLicks({
        artist: q.artist,
        genre: q.genre,
        technique: q.technique,
        key: q.key,
        scale: q.scale,
        minDifficulty: q.min_difficulty as Lick['difficulty'] | undefined,
        maxDifficulty: q.max_difficulty as Lick['difficulty'] | undefined,
        text: q.text,
        limit: q.limit,
        offset: q.offset,
      });
      const artistInfo = q.artist ? findArtist(q.artist) : undefined;
      const render = (licks: Lick[]) => {
        const next = q.offset + licks.length;
        const hasMore = page.total > next;
        const data = {
          total: page.total,
          count: licks.length,
          offset: q.offset,
          has_more: hasMore,
          ...(hasMore ? { next_offset: next } : {}),
          ...(artistInfo ? { artist: artistInfo } : {}),
          licks: licks.map((l) => (q.include_tab ? l : { ...l, alphaTex: undefined, body: undefined })),
        };
        if (q.response_format === 'json') return { data, text: JSON.stringify(data, null, 2) };
        const lines = [`# ${page.total} lick${page.total === 1 ? '' : 's'} found, showing ${licks.length}`];
        if (artistInfo) lines.push(`${artistInfo.name}: ${artistInfo.traits}. Tone: ${artistInfo.tone}.`);
        lines.push('', ...licks.map((l) => lickMarkdown(l, q.include_tab)));
        if (hasMore) lines.push('', `More results: call again with offset=${next}.`);
        return { data, text: lines.join('\n') };
      };
      let licks = page.licks;
      let out = render(licks);
      while (licks.length > 1 && out.text.length > CHARACTER_LIMIT) {
        licks = licks.slice(0, Math.ceil(licks.length / 2));
        out = render(licks);
      }
      if (!page.total) {
        return { content: [{ type: 'text' as const, text: 'No licks match. Loosen a filter (difficulty, key or technique), or call guitarpulse_list_catalog for valid artists and genres.' }] };
      }
      if (q.response_format === 'json') return { content: [{ type: 'text' as const, text: out.text }], structuredContent: out.data };
      return { content: [{ type: 'text' as const, text: out.text }] };
    },
  );

  server.registerTool(
    'guitarpulse_analyze_improv_session',
    {
      title: 'Analyze an improvisation',
      description: `Measure an improvised solo against the backing track: chord tones on strong beats, notes in the scale, outside notes that resolve, use of space, phrase length, motifs, range, rhythmic variety, timing and bend accuracy.
Returns every metric, a verdict for each, and the single biggest thing to work on with an exercise.

Input is the note list from the GuitarPulse pitch tracker: MIDI number, start beat and length in beats (beat 0 = start of the backing track). Give the chords with their beat spans; the best-fitting scale for each chord is chosen automatically unless you name one.

Example: bpm=90, total_beats=16, chords=[{symbol:"A7",start_beat:0,end_beat:8},{symbol:"D7",start_beat:8,end_beat:16}], notes=[{midi:69,onset_beat:0,duration_beats:1}, ...]`,
      inputSchema: z.strictObject({
        bpm: z.number().min(30).max(300).describe('Backing-track tempo'),
        total_beats: z.number().positive().max(4000).describe('Length of the session in beats'),
        key: z.string().max(30).optional().describe('Optional key, e.g. "A minor", to help pick scales'),
        chords: z
          .array(
            z.strictObject({
              symbol: z.string().min(1).max(20),
              start_beat: z.number().min(0),
              end_beat: z.number().positive(),
              scale: z.string().max(40).optional().describe('Optional scale id to judge this chord against'),
            }),
          )
          .min(1)
          .max(200)
          .describe('Chord timeline'),
        notes: z
          .array(
            z.strictObject({
              midi: z.number().int().min(20).max(110),
              onset_beat: z.number().min(0),
              duration_beats: z.number().positive(),
              peak_bend_cents: z.number().min(0).max(400).optional(),
            }),
          )
          .max(5000)
          .describe('Detected notes in time order'),
        response_format: responseFormat,
      }),
      annotations: READ_ONLY,
    },
    async ({ bpm, total_beats, key, chords, notes, response_format }) => {
      if (chords.some((c) => c.end_beat <= c.start_beat)) throw new Error('Each chord needs end_beat greater than start_beat.');
      const r = assessSession(
        notes.map((n) => ({ midi: n.midi, onsetBeat: n.onset_beat, durationBeats: n.duration_beats, peakBendCents: n.peak_bend_cents })),
        chords.map((c) => ({ symbol: c.symbol, startBeat: c.start_beat, endBeat: c.end_beat, scale: c.scale })),
        bpm,
        total_beats,
        key,
      );
      return reply(response_format, { ...r }, () => {
        const text = metricsMarkdown(r.metrics, r.verdicts);
        return r.focus ? `${text}\n\n## Work on next: ${r.focus.label}\n${r.focus.exercise}` : `${text}\n\nEvery measure is in a healthy range. Try a faster tempo or a harder progression next.`;
      });
    },
  );

  server.registerTool(
    'guitarpulse_generate_practice_plan',
    {
      title: 'Generate a practice plan',
      description: `Build a week-by-week practice plan from a level (1-9), goals, minutes per day and number of weeks.
Each week has a focus, an exercise, a backing track (genre, key, progression, start and target BPM), a coach target to unlock the next level, two new licks from the vault and review licks from 1 and 3 weeks earlier. Plans with 4+ weeks end with a review week.

Levels: 1 minor pentatonic box 1, 2 bends and vibrato, 3 call-and-response phrasing, 4 connecting the five boxes, 5 major/minor pentatonic mix, 6 chord tones and arpeggios, 7 modes over vamps, 8 ii-V-I and enclosures, 9 outside playing.

Example: "I know box 1 and want neo-soul, 30 min a day for 10 weeks" -> level=2, goals=["neo-soul","phrasing"], minutes_per_day=30, weeks=10`,
      inputSchema: z.strictObject({
        level: z.number().int().min(1).max(9).describe('Current level (1-9), see description'),
        goals: z.array(z.enum(GOALS)).max(6).default([]).describe('Goals that add elective modules and shape lick choice'),
        minutes_per_day: z.number().int().min(10).max(120).default(30),
        weeks: z.number().int().min(1).max(16).default(10),
        days_per_week: z.number().int().min(3).max(7).default(6),
        genres: z.array(z.enum(LICK_GENRES)).max(6).default([]).describe('Preferred lick genres'),
        response_format: responseFormat,
      }),
      annotations: READ_ONLY,
    },
    async ({ level, goals, minutes_per_day, weeks, days_per_week, genres, response_format }) => {
      const plan = generatePracticePlan({ level, goals, minutesPerDay: minutes_per_day, weeks, daysPerWeek: days_per_week, genres });
      return reply(response_format, { ...plan }, () => {
        const lines = [
          `# ${plan.summary.weeks}-week plan from level ${plan.summary.level}`,
          `${plan.summary.minutesPerDay} min/day, ${plan.summary.daysPerWeek} days/week. ${plan.summary.restDay}`,
          '',
          '## Daily routine',
          ...plan.dailyRoutine.map((b) => `- ${b.block} (${b.minutes} min): ${b.what}`),
        ];
        for (const w of plan.weeks) {
          lines.push('', `## Week ${w.week}: ${w.title}`, `- Focus: ${w.focus}`, `- Exercise: ${w.exercise}`);
          if (w.track.targetBpm) lines.push(`- Track: ${w.track.genre} in ${w.track.key}, ${w.track.progression}, ${w.track.startBpm} → ${w.track.targetBpm} BPM`);
          lines.push(`- Coach target: ${w.coachTarget.label} ${w.coachTarget.target}`);
          if (w.newLicks.length) lines.push(`- New licks: ${w.newLicks.map((l) => `${l.title} (${l.artist}, ${l.id})`).join('; ')}`);
          if (w.reviewLicks.length) lines.push(`- Review: ${w.reviewLicks.join(', ')}`);
        }
        lines.push('', '## How to use it', ...plan.howToUse.map((h) => `- ${h}`));
        return lines.join('\n');
      });
    },
  );

  server.registerTool(
    'guitarpulse_mutate_lick',
    {
      title: 'Mutate a lick',
      description: `Turn a lick from the vault into new vocabulary. Mutations run in order, and each one re-bars, re-fingers and re-checks the tab:
${MUTATIONS.map((m) => `- ${m.op}: ${m.label}. ${m.description}`).join('\n')}

transpose needs to_key (e.g. "C", "F#"); retarget needs the chord to land on (e.g. "D7"). Returns the new lick as alphaTex with an explanation of each step.

Examples:
  - "Give me that B.B. lick in C" -> lick_id="bb-1", mutations=[{op:"transpose", to_key:"C"}]
  - "Make it land on the 3rd of D7, then shift it an eighth" -> mutations=[{op:"retarget", chord:"D7"},{op:"displace"}]
Find lick ids with guitarpulse_search_licks.`,
      inputSchema: z.strictObject({
        lick_id: z.string().min(1).max(60).describe('Lick id from guitarpulse_search_licks, e.g. "gilmour-1"'),
        mutations: z
          .array(
            z.discriminatedUnion('op', [
              z.strictObject({ op: z.literal('transpose'), to_key: z.string().regex(/^[A-Ga-g][#b♯♭]?$/).describe('New key root, e.g. "C", "Bb"') }),
              z.strictObject({ op: z.literal('displace') }),
              z.strictObject({ op: z.literal('flip') }),
              z.strictObject({ op: z.literal('retarget'), chord: z.string().min(1).max(20).describe('Chord to land on, e.g. "D7", "Fmaj7"') }),
              z.strictObject({ op: z.literal('reverse') }),
            ]),
          )
          .min(1)
          .max(5)
          .describe('Mutations to apply in order'),
        response_format: responseFormat,
      }),
      annotations: READ_ONLY,
    },
    async ({ lick_id, mutations, response_format }) => {
      const original = getLick(lick_id);
      if (!original) throw new Error(`Unknown lick id "${lick_id}". Find ids with guitarpulse_search_licks (set include_tab=false for a quick list).`);
      let lick = original;
      const steps: { op: string; explanation: string; warnings: string[] }[] = [];
      for (const m of mutations) {
        const mutation: Mutation = m.op === 'transpose' ? { op: 'transpose', toKey: m.to_key } : m.op === 'retarget' ? { op: 'retarget', chord: m.chord } : { op: m.op };
        const r = mutateLick(lick, mutation);
        steps.push({ op: m.op, explanation: r.explanation, warnings: r.warnings });
        lick = r.lick;
      }
      return reply(response_format, { original: original.id, steps, lick }, () => mutationMarkdown(original, steps, lick));
    },
  );

  server.registerTool(
    'guitarpulse_song_to_practice',
    {
      title: 'Turn a song into practice',
      description: `Paste a chord chart and get everything needed to practise soloing over it: the key, the progression's name if it is a famous one, the best scale for each chord with its notes, the 3rd and 7th to aim for, a guide-tone line, one focus tip, and a link that opens the song in GuitarPulse with a backing track.

Chart format (4/4): bars split by "|", one chord per bar or several ("C G"), "/" repeats the previous chord for a beat, "%" repeats the last bar, "x2" repeats a line, [Verse] labels are fine.
Example: chart="| Fmaj7 | E7 | Am7 | Gm7 C7 |", groove="neo-soul"`,
      inputSchema: z.strictObject({
        chart: z.string().min(1).max(2000).describe('Chord chart, e.g. "| Am7 | D7 | Gmaj7 | Cmaj7 |"'),
        key: z.string().max(12).optional().describe('Key if you know it, e.g. "A minor", "Eb"; detected otherwise'),
        groove: z.enum(GROOVE_IDS).default('pop-rock').describe('Backing-track feel for the link, e.g. pop-rock, neo-soul, bossa-nova, jazz-ii-v-i, slow-blues'),
        bpm: z.number().int().min(40).max(240).optional().describe('Tempo for the link; the groove default otherwise'),
        response_format: responseFormat,
      }),
      annotations: READ_ONLY,
    },
    async ({ chart, key, groove, bpm, response_format }) => {
      const s = songToPractice(chart, { key });
      const session: JamSession = { v: 1, mode: 'song', title: s.named?.name ?? `Song in ${s.key.key}`, chart, groove, key: s.key.key, bpm };
      const link = chart.length <= 600 && !jamProblems(session).length ? jamLink(appUrl(), session) : null;
      const grooveName = GROOVES.find((g) => g.id === groove)!.name.toLowerCase();
      return reply(response_format, { ...s, link }, () => songMarkdown(s, link, grooveName));
    },
  );

  server.registerTool(
    'guitarpulse_create_jam_session',
    {
      title: 'Set up a jam in GuitarPulse',
      description: `Build a practice session and return a link that opens GuitarPulse ready to play. Use it when someone asks you to set up a jam, a backing track, a trading-fours session, a song to practise or an ear-training drill.

Modes:
- studio: backing track with the scale on the fretboard
- coach: backing track with the microphone coach (report and neck heatmap at the end)
- trade: trading fours: they play 4 bars, GuitarPulse answers with 4 built from their idea
- song: their chord chart with a backing track, scale map and 3rd/7th line
- ear: timed interval and chord-quality drill (set ear_mode and ear_minutes)

studio, coach and trade need a groove (ids and progression indexes from guitarpulse_list_catalog); song needs a chart. Lick ids add licks to work into the jam.
Links point to ${appUrl()} (set GUITARPULSE_APP_URL to change it); if it is localhost, tell the user to start the app first.

Examples:
  - "Set me up a slow blues in G to work on bends" -> mode="coach", groove="slow-blues", key="G", focus="Bend to pitch on the b3"
  - "Trade fours with me over city pop" -> mode="trade", groove="city-pop"
  - "Five minutes of interval practice" -> mode="ear", ear_mode="interval", ear_minutes=5`,
      inputSchema: z.strictObject({
        mode: z.enum(JAM_MODES).describe('studio, coach, trade, song or ear'),
        groove: z.enum(GROOVE_IDS).optional().describe('Groove id, e.g. "slow-blues", "city-pop", "cai-luong"'),
        progression: z.number().int().min(0).max(9).optional().describe('Which of the groove’s progressions (index from the catalog); 0 by default'),
        key: z.string().regex(/^[A-Ga-g][#b♯♭]?$/).optional().describe('Key root, e.g. "G", "Bb"; the groove default otherwise'),
        chart: z.string().max(600).optional().describe('Chord chart for song mode, e.g. "| Am7 | D7 | Gmaj7 | Cmaj7 |"'),
        bpm: z.number().int().min(40).max(240).optional().describe('Tempo; the groove default otherwise'),
        scale: z.string().max(40).optional().describe('Scale to show, e.g. "minor-pentatonic", "dorian"'),
        lick_ids: z.array(z.string().max(60)).max(6).optional().describe('Licks to work into the jam, from guitarpulse_search_licks'),
        focus: z.string().max(200).optional().describe('One thing to work on, shown at the top of the session'),
        ear_mode: z.enum(['interval', 'chord', 'mixed']).optional().describe('Ear mode: what to drill'),
        ear_minutes: z.number().int().min(1).max(30).optional().describe('Ear mode: drill length (5 by default)'),
        title: z.string().max(80).optional().describe('Short title for the session'),
      }),
      annotations: READ_ONLY,
    },
    async (q) => {
      const session: JamSession = {
        v: 1,
        mode: q.mode,
        ...(q.title ? { title: q.title } : {}),
        ...(q.groove ? { groove: q.groove } : {}),
        ...(q.progression !== undefined ? { progression: q.progression } : {}),
        ...(q.key ? { key: q.key } : {}),
        ...(q.chart ? { chart: q.chart } : {}),
        ...(q.bpm ? { bpm: q.bpm } : {}),
        ...(q.scale ? { scale: q.scale } : {}),
        ...(q.lick_ids?.length ? { licks: q.lick_ids } : {}),
        ...(q.focus ? { focus: q.focus } : {}),
        ...(q.mode === 'ear' ? { ear: { mode: q.ear_mode ?? 'mixed', minutes: q.ear_minutes ?? 5 } } : {}),
      };
      const problems = jamProblems(session);
      if (problems.length) throw new Error(`${problems.join(' ')} Call guitarpulse_list_catalog for valid groove ids, progressions and scales.`);
      const link = jamLink(appUrl(), session);
      const summary = describeJam(session);
      const next = {
        studio: 'Press Play; the fretboard follows the chords.',
        coach: 'Press Start, allow the microphone, and play. Stopping shows the report and the neck heatmap.',
        trade: 'Press Start trading: play 4 bars, GuitarPulse answers with 4 built from your idea, then you reply.',
        song: 'The chart loads with its backing track, the scale for each chord and the 3rd/7th line.',
        ear: 'The drill starts with a timer; answers are saved to your progress.',
      }[q.mode];
      const data = { link, summary, session, app_url: appUrl() };
      return {
        content: [{ type: 'text' as const, text: `# Jam ready: ${summary}\n\nOpen in GuitarPulse: ${link}\n\n${next}${q.focus ? `\n\nFocus: ${q.focus}` : ''}` }],
        structuredContent: data,
      };
    },
  );

  return server;
}
