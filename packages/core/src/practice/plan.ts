import { METRIC_TARGETS } from '../coach/metrics.js';
import { LICKS } from '../licks/index.js';
import type { Lick, LickGenre } from '../licks/types.js';
import { parseNote, pcName, prefersFlats } from '../theory/notes.js';

export const GOALS = [
  'phrasing',
  'bends',
  'fretboard',
  'chord-tones',
  'modes',
  'jazz',
  'neo-soul',
  'funk',
  'blues',
  'rock',
  'metal',
  'country',
  'speed',
  'ear-training',
] as const;
export type Goal = (typeof GOALS)[number];

interface Module {
  id: string;
  level: number;
  elective?: boolean;
  title: string;
  focus: string;
  exercise: string;
  track: { genre: string; key: string; progression: string; bpm: number; progressionIndex?: number };
  target: { metric: keyof typeof METRIC_TARGETS; value: number };
  tags: Goal[];
  lickScales: string[];
}

const M = (m: Module) => m;

/** The core path follows the level table: each level unlocks when its coach target is met. */
const CORE: Module[] = [
  M({ id: 'pent-box1', level: 1, title: 'Minor pentatonic box 1', focus: 'Five notes, one position, in time with a metronome', exercise: 'Play box 1 up and down at 60 BPM, then improvise using only quarter and eighth notes. Sing each note before you play it for the last 2 minutes.', track: { genre: 'slow-blues', key: 'A', progression: '12-bar I7-IV7-V7', bpm: 70 }, target: { metric: 'scaleAdherence', value: 0.9 }, tags: ['blues', 'rock'], lickScales: ['minor-pentatonic', 'minor-blues'] }),
  M({ id: 'bends-vibrato', level: 2, title: 'Bends and vibrato', focus: 'Half- and whole-step bends that land in tune; even vibrato', exercise: 'Play the target note first, then bend up to match it. Ten slow bends per string set, then use only bent notes as phrase endings.', track: { genre: 'slow-blues', key: 'A', progression: '12-bar I7-IV7-V7', bpm: 72 }, target: { metric: 'bendAccuracyMeanCents', value: 25 }, tags: ['bends', 'blues'], lickScales: ['minor-pentatonic', 'mixolydian', 'major-pentatonic'] }),
  M({ id: 'call-response', level: 3, title: 'Call and response', focus: 'Two-bar phrases with two bars of silence', exercise: 'Play a 2-bar "question", rest 2 bars, then answer it with a variation. Count the rests out loud.', track: { genre: 'texas-shuffle', key: 'A', progression: '12-bar shuffle', bpm: 100 }, target: { metric: 'restRatio', value: 0.3 }, tags: ['phrasing', 'blues'], lickScales: ['minor-pentatonic', 'aeolian', 'minor-blues'] }),
  M({ id: 'connect-boxes', level: 4, title: 'Connect boxes 1-3', focus: 'Slide between positions instead of staying in box 1', exercise: 'Play one lick in box 1, then the same lick in box 2 and box 3. Improvise with the rule "change position every 2 bars".', track: { genre: 'classic-rock', key: 'A', progression: 'I-bVII-IV', bpm: 110 }, target: { metric: 'rangeSemitones', value: 19 }, tags: ['fretboard', 'rock'], lickScales: ['minor-pentatonic'] }),
  M({ id: 'all-boxes', level: 4, title: 'All five boxes', focus: 'The whole neck in one key', exercise: 'Ascend in box 4, descend in box 5, and finish every phrase on the root in a different octave.', track: { genre: 'minor-blues', key: 'A', progression: 'minor 12-bar i7-iv7-V7', bpm: 90 }, target: { metric: 'rangeSemitones', value: 24 }, tags: ['fretboard'], lickScales: ['minor-pentatonic', 'aeolian'] }),
  M({ id: 'major-minor', level: 5, title: 'Mixing major and minor pentatonic', focus: 'Major pentatonic over the I chord, minor over the IV', exercise: 'Over each I7 bar, land on the major 3rd; over IV7, land on its 3rd (the b7 of the key). Then mix freely.', track: { genre: 'texas-shuffle', key: 'E', progression: '12-bar shuffle', bpm: 104 }, target: { metric: 'chordToneOnStrongBeats', value: 0.4 }, tags: ['blues', 'country'], lickScales: ['major-pentatonic', 'major-blues', 'mixolydian'] }),
  M({ id: 'chord-tones', level: 6, title: 'Targeting chord tones', focus: 'Land on the 3rd of each chord on beat 1', exercise: 'Find the 3rd of I7, IV7 and V7 in one position. Improvise freely but hit that 3rd on every chord change.', track: { genre: 'texas-shuffle', key: 'A', progression: '12-bar I7-IV7-V7', bpm: 96 }, target: { metric: 'chordToneOnStrongBeats', value: 0.5 }, tags: ['chord-tones', 'jazz', 'blues'], lickScales: ['mixolydian', 'bebop-dominant', 'major-blues'] }),
  M({ id: 'arpeggios', level: 6, title: 'Arpeggios through the changes', focus: 'Spell each chord, then end phrases on chord tones', exercise: 'Arpeggiate each chord for one bar, then improvise and end every phrase on a chord tone.', track: { genre: 'jazz-ii-v-i', key: 'C', progression: 'Dm7-G7-Cmaj7', bpm: 100 }, target: { metric: 'phraseEndsOnChordTone', value: 0.6 }, tags: ['chord-tones', 'jazz'], lickScales: ['ionian', 'bebop-dominant', 'dorian'] }),
  M({ id: 'dorian', level: 7, title: 'Dorian over a minor vamp', focus: 'The natural 6th is the Dorian sound', exercise: 'Over i7-IV7, put the 6th on strong beats in every phrase, then resolve it down to the 5th.', track: { genre: 'funk', key: 'E', progression: 'Em7-A7', bpm: 100 }, target: { metric: 'scaleAdherence', value: 0.9 }, tags: ['modes', 'funk'], lickScales: ['dorian'] }),
  M({ id: 'mixo-lydian', level: 7, title: 'Mixolydian and Lydian', focus: 'Hear b7 versus #4 against the same root', exercise: 'Alternate 4 bars of Mixolydian and 4 bars of Lydian over one chord; repeat a short motif in both.', track: { genre: 'modal-vamp', key: 'A', progression: 'A7 for 4 bars, then Amaj7#11', bpm: 110 }, target: { metric: 'repeatedMotifs', value: 2 }, tags: ['modes', 'rock'], lickScales: ['mixolydian', 'lydian'] }),
  M({ id: 'ii-v-i', level: 8, title: 'ii-V-I with enclosures', focus: 'Chromatic notes that resolve within a beat', exercise: 'Enclose the 3rd of each chord (note above, note below, target). Then improvise eighth-note lines that land on chord tones.', track: { genre: 'jazz-ii-v-i', key: 'G', progression: 'Am7-D7-Gmaj7', bpm: 120 }, target: { metric: 'resolvedChromaticism', value: 0.6 }, tags: ['jazz', 'chord-tones'], lickScales: ['bebop-dominant', 'ionian', 'mixolydian'] }),
  M({ id: 'phrygian-dominant', level: 8, title: 'Phrygian dominant over V in minor', focus: 'b2 and major 3rd over the V chord', exercise: 'Over the E chord in Am-G-F-E, play E Phrygian dominant and resolve G# to A on the Am.', track: { genre: 'flamenco-rumba', key: 'A', progression: 'Am-G-F-E7', bpm: 110 }, target: { metric: 'scaleAdherence', value: 0.85 }, tags: ['modes', 'metal'], lickScales: ['harmonic-minor', 'phrygian-dominant', 'phrygian'] }),
  M({ id: 'outside', level: 9, title: 'Outside and back', focus: 'Tension that always resolves', exercise: 'Side-slip a pentatonic shape up a half step for one beat, then resolve. Try the altered scale over the V7.', track: { genre: 'jazz-blues', key: 'F', progression: 'jazz blues', bpm: 130 }, target: { metric: 'resolvedChromaticism', value: 0.7 }, tags: ['jazz'], lickScales: ['altered', 'whole-tone', 'minor-pentatonic'] }),
];

const ELECTIVES: Module[] = [
  M({ id: 'ear-echo', level: 1, elective: true, title: 'Ear training: echo phrases', focus: 'Hear it, sing it, play it', exercise: 'The app plays a 1-bar phrase; sing it back, then find it on the neck. Start with 3-note phrases.', track: { genre: 'lo-fi', key: 'D', progression: 'Em9-A13-Dmaj9-Bm9', bpm: 80 }, target: { metric: 'repeatedMotifs', value: 2 }, tags: ['ear-training', 'phrasing'], lickScales: ['dorian', 'minor-pentatonic'] }),
  M({ id: 'rhythm-cells', level: 2, elective: true, title: 'Rhythm cells', focus: 'Same notes, different rhythms', exercise: 'Use only 3 notes. Play them as quarters, then eighths, triplets and syncopations, two bars each.', track: { genre: 'classic-rock', key: 'G', progression: 'I-bVII-IV-I', bpm: 100 }, target: { metric: 'rhythmicEntropyBits', value: 1.5 }, tags: ['phrasing', 'funk'], lickScales: ['minor-pentatonic', 'major-pentatonic'] }),
  M({ id: 'funk-16ths', level: 3, elective: true, title: 'Funk sixteenths', focus: 'Keep the hand moving; mute between notes', exercise: 'Strum constant sixteenths with the strings muted, letting chord stabs through on the "e" and "a".', track: { genre: 'funk', key: 'E', progression: 'E9 vamp', bpm: 100, progressionIndex: 1 }, target: { metric: 'timingSdMs', value: 25 }, tags: ['funk'], lickScales: ['mixolydian', 'dorian'] }),
  M({ id: 'neo-soul', level: 4, elective: true, title: 'Neo-soul double stops', focus: 'Dyads, hammer-ons and laid-back timing', exercise: 'Harmonise the melody in 3rds and 4ths on the G and B strings; play slightly behind the beat.', track: { genre: 'neo-soul', key: 'Eb', progression: 'Abmaj9-Gm7-Cm9-Fm9', bpm: 76 }, target: { metric: 'restRatio', value: 0.35 }, tags: ['neo-soul'], lickScales: ['ionian', 'dorian', 'mixolydian', 'major-blues'] }),
  M({ id: 'speed-sequences', level: 4, elective: true, title: 'Speed with sequences', focus: 'Clean speed: add 4 BPM only when it is clean', exercise: 'Play a 4-note sequence through the box with a metronome. Three clean passes, then +4 BPM.', track: { genre: 'hard-rock', key: 'A', progression: 'i-bVI-bVII', bpm: 120 }, target: { metric: 'timingSdMs', value: 20 }, tags: ['speed', 'metal', 'rock'], lickScales: ['minor-pentatonic', 'aeolian', 'harmonic-minor'] }),
  M({ id: 'country-hybrid', level: 4, elective: true, title: 'Country hybrid picking', focus: 'Pick plus fingers, sixths and pedal-steel bends', exercise: 'Play sixths through G major with pick and middle finger, then bend under a held note.', track: { genre: 'country', key: 'G', progression: 'I-IV-V', bpm: 120 }, target: { metric: 'chordToneOnStrongBeats', value: 0.5 }, tags: ['country'], lickScales: ['ionian', 'mixolydian', 'major-blues'] }),
  M({ id: 'motif', level: 5, elective: true, title: 'Motif development', focus: 'Repeat, vary, answer', exercise: 'Invent a 3-note motif. Repeat it, then change one thing each time: rhythm, octave, last note.', track: { genre: 'pop-rock', key: 'D', progression: 'I-V-vi-IV', bpm: 96 }, target: { metric: 'repeatedMotifs', value: 3 }, tags: ['phrasing'], lickScales: ['major-pentatonic', 'ionian'] }),
  M({ id: 'harmonic-minor-metal', level: 5, elective: true, title: 'Harmonic minor for metal', focus: 'The raised 7th as a leading tone', exercise: 'Over i-bVI-V, target the leading tone on the V chord and resolve it to the root.', track: { genre: 'metal', key: 'E', progression: 'Em-C-B7-Em', bpm: 140, progressionIndex: 1 }, target: { metric: 'scaleAdherence', value: 0.9 }, tags: ['metal', 'speed'], lickScales: ['harmonic-minor', 'aeolian', 'phrygian'] }),
];

export interface PlanQuery {
  level: number;
  goals?: Goal[];
  minutesPerDay?: number;
  weeks?: number;
  daysPerWeek?: number;
  genres?: LickGenre[];
}

const LEVEL_DIFFICULTY = (level: number) => (level <= 2 ? 2 : level <= 4 ? 3 : level <= 6 ? 4 : 5);

function transpose(key: string, semitones: number) {
  const n = parseNote(key);
  if (!n) return key;
  return pcName(n.pc + semitones, prefersFlats(n));
}

function routine(minutes: number, goals: Goal[]) {
  const share = { technique: 0.15, ear: 0.15, vocabulary: 0.3, improvise: 0.4 };
  if (goals.includes('speed')) { share.technique += 0.1; share.improvise -= 0.1; }
  if (goals.includes('ear-training')) { share.ear += 0.1; share.vocabulary -= 0.1; }
  const raw = Object.entries(share).map(([k, v]) => [k, Math.max(2, Math.round(minutes * v))] as const);
  const total = raw.reduce((a, [, m]) => a + m, 0);
  const fix = minutes - total;
  const blocks = raw.map(([k, m], i) => ({ block: k, minutes: i === raw.length - 1 ? Math.max(2, m + fix) : m }));
  const what: Record<string, string> = {
    technique: 'This week’s exercise with a metronome at one fixed tempo.',
    ear: 'Sing then play: the app plays a phrase, you echo it.',
    vocabulary: 'This week’s licks plus the review licks, each in two keys or positions.',
    improvise: 'Jam over this week’s track with the coach listening; read the report after.',
  };
  return blocks.map((b) => ({ ...b, what: what[b.block] }));
}

export function generatePracticePlan(q: PlanQuery) {
  const level = Math.min(9, Math.max(1, Math.round(q.level)));
  const goals = q.goals ?? [];
  const weeks = Math.min(16, Math.max(1, q.weeks ?? 10));
  const minutes = Math.min(120, Math.max(10, q.minutesPerDay ?? 30));
  const days = Math.min(7, Math.max(3, q.daysPerWeek ?? 6));
  const genres = q.genres ?? [];

  // Core spine from the student's level, with goal-matched electives slotted in after their level.
  const spine = CORE.filter((m) => m.level >= level).map((m) => ({ m, order: m.level }));
  const electives = ELECTIVES.filter((e) => e.tags.some((t) => goals.includes(t))).map((m) => ({ m, order: Math.max(m.level, level) + 0.5 }));
  let path = [...spine, ...electives].sort((a, b) => a.order - b.order).map((x) => x.m);
  if (!path.length) path = CORE.slice(-2);
  // Keep the order: a short plan stops earlier on the path rather than skipping ahead past
  // skills the student has not unlocked yet. Goals decide which electives join the path.
  const reviewWeek = weeks >= 4;
  const slots = weeks - (reviewWeek ? 1 : 0);
  if (path.length > slots) path = path.slice(0, slots);

  const used = new Set<string>();
  const weekLicks: string[][] = [];
  const maxDiff = LEVEL_DIFFICULTY(level);
  const plan = [];
  for (let w = 0; w < slots; w++) {
    const base = path[w % path.length];
    const lap = Math.floor(w / path.length);
    const key = transpose(base.track.key, (lap * 5) % 12); // repeat laps move up a 4th
    const bpm = Math.round(base.track.bpm * (1 + 0.08 * lap));
    const levelForLicks = Math.max(level, base.level);
    const ceiling = Math.min(5, Math.max(maxDiff, LEVEL_DIFFICULTY(levelForLicks)));
    const candidates = LICKS.filter((l) => !used.has(l.id) && l.difficulty <= ceiling)
      .map((l) => ({ l, s: lickScore(l, base, genres, goals) }))
      .sort((a, b) => b.s - a.s || a.l.difficulty - b.l.difficulty || a.l.id.localeCompare(b.l.id));
    const chosen = pickVaried(candidates.map((c) => c.l), 2);
    chosen.forEach((l) => used.add(l.id));
    weekLicks.push(chosen.map((l) => l.id));
    const review = [...(weekLicks[w - 1] ?? []).slice(0, 1), ...(weekLicks[w - 3] ?? []).slice(0, 1)];
    const t = METRIC_TARGETS[base.target.metric];
    plan.push({
      week: w + 1,
      module: base.id,
      title: lap ? `${base.title} (round ${lap + 1}, new key)` : base.title,
      focus: base.focus,
      exercise: base.exercise,
      track: { genre: base.track.genre, key, progression: base.track.progression, progressionIndex: base.track.progressionIndex ?? 0, targetBpm: bpm, startBpm: Math.round(bpm * 0.75) },
      coachTarget: { metric: base.target.metric, label: t.label, target: `${t.better === 'higher' ? '≥' : '≤'} ${base.target.value}${t.unit ? ` ${t.unit}` : ''}` },
      newLicks: chosen.map((l) => ({ id: l.id, title: l.title, artist: l.artist, difficulty: l.difficulty, key: l.key })),
      reviewLicks: review,
    });
  }
  if (reviewWeek) {
    plan.push({
      week: weeks,
      module: 'review',
      title: 'Review and record',
      focus: 'Measure how far you have come',
      exercise: 'Record three solos over three different tracks from this plan. Compare each coach report with your first week and pick next month’s focus from the weakest number.',
      track: { genre: 'your choice', key: 'any', progression: 'three tracks from this plan', progressionIndex: 0, targetBpm: 0, startBpm: 0 },
      coachTarget: { metric: 'all', label: 'Every coach target from this plan', target: 'better than week 1' },
      newLicks: [],
      reviewLicks: weekLicks.flat().filter((_, i) => i % 3 === 0),
    });
  }

  return {
    summary: {
      level,
      goals,
      weeks,
      daysPerWeek: days,
      minutesPerDay: minutes,
      restDay: days < 7 ? 'Take the remaining day(s) off or jam with no goal; rest helps skills settle.' : 'Make one day a light, no-goal jam.',
    },
    dailyRoutine: routine(minutes, goals),
    weeks: plan,
    howToUse: [
      'Start each week at startBpm and add 4 BPM only after three clean passes.',
      'Move on when the coach target is met in two sessions in a row, even if the week is not over.',
      'Review licks come back after 1 and 3 weeks (spaced repetition); play them in a new key each time.',
    ],
  };
}

function lickScore(l: Lick, m: Module, genres: LickGenre[], goals: Goal[]) {
  let s = 0;
  if (m.lickScales.includes(l.scale)) s += 5;
  if (genres.includes(l.genre)) s += 3;
  if (goals.some((g) => g === l.genre || (g === 'bends' && l.techniques.some((t) => t.includes('bend'))) || (g === 'speed' && l.techniques.some((t) => /sixteenth|sextuplet|alternate/.test(t))))) s += 2;
  if (l.difficulty >= Math.max(1, Math.min(5, Math.ceil(m.level / 2)))) s += 1;
  return s;
}

/** Take the top picks but avoid two licks by the same artist in one week. */
function pickVaried(sorted: Lick[], n: number) {
  const out: Lick[] = [];
  for (const l of sorted) {
    if (out.some((o) => o.artist === l.artist)) continue;
    out.push(l);
    if (out.length === n) break;
  }
  return out;
}
