/**
 * Backing-track grooves, written as data, and a renderer that turns a groove plus chords into
 * timed events in beats. The browser engine (Tone.js) plays the events; tempo only converts beats
 * to seconds, so changing tempo can never change pitch (bug 1), and changing key re-renders from
 * Roman numerals.
 */
import type { ChordSpan } from './coach/assess.js';
import { parseChord, type ParsedChord } from './theory/chords.js';
import { parseNote, pc } from './theory/notes.js';
import { romanToChord } from './song.js';

export type DrumInst = 'kick' | 'snare' | 'hat' | 'openhat' | 'ride' | 'clap' | 'rim' | 'tom' | 'shaker' | 'clapper' | 'gong';

export interface Groove {
  id: string;
  name: string;
  category: 'core' | 'asia';
  family: string;
  description: string;
  bpm: { min: number; default: number; max: number };
  /** 0 = straight, 1 = full triplet swing. */
  swing: number;
  swingUnit: 8 | 16;
  /** One character per 16th note: x accent, o normal, g ghost, . silent. Length 16, 32 or 64 (1, 2 or 4 bars). */
  drums: Partial<Record<DrumInst, string>>;
  /** 16 space-separated tokens per bar: R 3 5 6 b7 7 8 (chord-relative), A (approach to next chord), - (hold), . (rest); or walking / drone / none. */
  bass: string;
  keys: { style: 'stab' | 'sustain' | 'arp' | 'none'; pattern?: string; voicing: 'triad' | 'seventh' | 'rich' | 'power'; length?: number };
  pad?: 'drone' | 'chord';
  /** Roman numerals, one bar each; join two chords in a bar with "+". */
  progressions: { name: string; roman: string; key: string }[];
  scales: string[];
  instruments: string;
  about?: string;
}

const STRAIGHT8 = 'o.o.o.o.o.o.o.o.';
const BACKBEAT = '....x.......x...';

export const GROOVES: Groove[] = [
  {
    id: 'slow-blues', name: 'Slow blues', category: 'core', family: 'blues', description: '12/8 feel, lots of space for bends',
    bpm: { min: 50, default: 64, max: 80 }, swing: 1, swingUnit: 8,
    drums: { kick: 'x.......o.......', snare: BACKBEAT, hat: STRAIGHT8 },
    bass: 'R . . . 3 . . . 5 . . . 6 . . .',
    keys: { style: 'sustain', voicing: 'seventh' },
    progressions: [
      { name: '12-bar, quick change', roman: 'I7 IV7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', key: 'A' },
      { name: '12-bar', roman: 'I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', key: 'A' },
    ],
    scales: ['minor-pentatonic', 'minor-blues', 'major-pentatonic', 'mixolydian'], instruments: 'Drums, bass, organ',
  },
  {
    id: 'texas-shuffle', name: 'Texas shuffle', category: 'core', family: 'blues', description: 'Driving shuffle with a boogie bass line',
    bpm: { min: 92, default: 112, max: 132 }, swing: 1, swingUnit: 8,
    drums: { kick: 'x...o...x...o...', snare: BACKBEAT, hat: STRAIGHT8 },
    bass: 'R . 5 . 6 . b7 . 8 . b7 . 6 . 5 .',
    keys: { style: 'stab', pattern: '....x.......x...', voicing: 'seventh', length: 2 },
    progressions: [{ name: '12-bar', roman: 'I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', key: 'E' }],
    scales: ['minor-pentatonic', 'major-pentatonic', 'minor-blues', 'mixolydian'], instruments: 'Drums, bass, rhythm stabs',
  },
  {
    id: 'minor-blues', name: 'Minor blues', category: 'core', family: 'blues', description: 'Dark 12-bar in a minor key',
    bpm: { min: 60, default: 80, max: 100 }, swing: 1, swingUnit: 8,
    drums: { kick: 'x.......x.......', snare: BACKBEAT, hat: STRAIGHT8 },
    bass: 'R . . . 3 . . . 5 . . . b7 . . .',
    keys: { style: 'sustain', voicing: 'seventh' },
    progressions: [{ name: 'Minor 12-bar', roman: 'i7 i7 i7 i7 iv7 iv7 i7 i7 bVI7 V7 i7 V7', key: 'A' }],
    scales: ['minor-pentatonic', 'minor-blues', 'aeolian', 'dorian'], instruments: 'Drums, bass, electric piano',
  },
  {
    id: 'classic-rock', name: 'Classic rock', category: 'core', family: 'rock', description: 'Straight eighths, I–bVII–IV',
    bpm: { min: 100, default: 120, max: 140 }, swing: 0, swingUnit: 8,
    drums: { kick: 'x.....x.x.......', snare: BACKBEAT, hat: STRAIGHT8 },
    bass: 'R . R . R . R . R . R . R . R .',
    keys: { style: 'stab', pattern: 'x.......x.......', voicing: 'triad', length: 6 },
    progressions: [{ name: 'I–bVII–IV–I', roman: 'I bVII IV I', key: 'A' }],
    scales: ['minor-pentatonic', 'mixolydian', 'major-pentatonic'], instruments: 'Drums, bass, crunchy chords',
  },
  {
    id: 'hard-rock', name: 'Hard rock', category: 'core', family: 'rock', description: 'Minor key, driving bass',
    bpm: { min: 110, default: 128, max: 150 }, swing: 0, swingUnit: 8,
    drums: { kick: 'x.x...x.x.x...x.', snare: BACKBEAT, hat: STRAIGHT8 },
    bass: 'R . R . R . R . R . R . R . R .',
    keys: { style: 'sustain', voicing: 'power' },
    progressions: [{ name: 'i–bVI–bVII–i', roman: 'i bVI bVII i', key: 'E' }],
    scales: ['aeolian', 'minor-pentatonic', 'harmonic-minor'], instruments: 'Drums, bass, power chords',
  },
  {
    id: 'pop-rock', name: 'Pop-rock', category: 'core', family: 'rock', description: 'The I–V–vi–IV everyone knows',
    bpm: { min: 88, default: 100, max: 124 }, swing: 0, swingUnit: 8,
    drums: { kick: 'x.......x.x.....', snare: BACKBEAT, hat: STRAIGHT8 },
    bass: 'R . . . . . R . R . . . 5 . . .',
    keys: { style: 'stab', pattern: 'x.....x...x.....', voicing: 'triad', length: 4 },
    progressions: [{ name: 'I–V–vi–IV', roman: 'I V vi IV', key: 'C' }],
    scales: ['major-pentatonic', 'ionian'], instruments: 'Drums, bass, piano',
  },
  {
    id: 'funk', name: 'Funk vamp', category: 'core', family: 'funk', description: 'Sixteenth-note pocket on a Dorian vamp',
    bpm: { min: 92, default: 100, max: 116 }, swing: 0.15, swingUnit: 16,
    drums: { kick: 'x..x..x...x..x..', snare: '....x..g.g..x..g', hat: 'oooooooooooooooo' },
    bass: 'R . . R . . 8 . R . R . b7 . 5 .',
    keys: { style: 'stab', pattern: '.x..x..x..x...x.', voicing: 'seventh', length: 1 },
    progressions: [
      { name: 'i7–IV7 (Dorian)', roman: 'i7 i7 IV7 IV7', key: 'E' },
      { name: 'One-chord E9', roman: 'I9 I9 I9 I9', key: 'E' },
    ],
    scales: ['dorian', 'minor-pentatonic', 'mixolydian'], instruments: 'Drums, slap-style bass, clav stabs',
  },
  {
    id: 'neo-soul', name: 'Neo-soul', category: 'core', family: 'neo-soul', description: 'Lazy swung sixteenths and rich chords',
    bpm: { min: 64, default: 72, max: 88 }, swing: 0.6, swingUnit: 16,
    drums: { kick: 'x......x..x.....', snare: BACKBEAT, hat: 'o.o.o.oo.o.o.o.o' },
    bass: 'R - - - . . . 5 . . R - - - . .',
    keys: { style: 'sustain', voicing: 'rich' },
    progressions: [{ name: 'IVmaj9–iii7–vi9–ii9', roman: 'IVmaj9 iii7 vi9 ii9', key: 'C' }],
    scales: ['ionian', 'dorian', 'major-pentatonic'], instruments: 'Lazy drums, bass, Rhodes',
  },
  {
    id: 'jazz-ii-v-i', name: 'Jazz ii–V–I', category: 'core', family: 'jazz', description: 'Swing with a walking bass',
    bpm: { min: 100, default: 130, max: 220 }, swing: 1, swingUnit: 8,
    drums: { ride: 'o...x.o.o...x.o.', hat: '....x.......x...', kick: 'g...g...g...g...' },
    bass: 'walking',
    keys: { style: 'stab', pattern: '...x......x.....', voicing: 'rich', length: 3 },
    progressions: [
      { name: 'ii–V–I', roman: 'ii7 V7 Imaj7 Imaj7', key: 'C' },
      { name: 'Minor ii–V–i', roman: 'iiø7 V7 i7 i7', key: 'A' },
    ],
    scales: ['dorian', 'mixolydian', 'ionian', 'bebop-dominant'], instruments: 'Ride cymbal, walking bass, piano comping',
  },
  {
    id: 'jazz-blues', name: 'Jazz blues', category: 'core', family: 'jazz', description: '12-bar blues with jazz changes',
    bpm: { min: 110, default: 140, max: 220 }, swing: 1, swingUnit: 8,
    drums: { ride: 'o...x.o.o...x.o.', hat: '....x.......x...', kick: 'g...g...g...g...' },
    bass: 'walking',
    keys: { style: 'stab', pattern: '...x......x.....', voicing: 'rich', length: 3 },
    progressions: [{ name: 'Jazz blues', roman: 'I7 IV7 I7 I7 IV7 IV7 I7 VI7 ii7 V7 I7 V7', key: 'F' }],
    scales: ['mixolydian', 'bebop-dominant', 'minor-blues', 'dorian'], instruments: 'Ride, walking bass, piano',
  },
  {
    id: 'bossa-nova', name: 'Bossa nova', category: 'core', family: 'latin', description: 'Gentle straight-eighth Brazilian groove',
    bpm: { min: 100, default: 120, max: 140 }, swing: 0, swingUnit: 8,
    drums: { rim: 'x..x..x...x..x..', shaker: 'gggggggggggggggg', kick: 'x..o....x..o....' },
    bass: 'R . . . . . 5 . R . . . . . 5 .',
    keys: { style: 'stab', pattern: '.x.x..x..x.x..x.', voicing: 'rich', length: 1 },
    progressions: [{ name: 'Imaj7–II7–ii7–V7', roman: 'Imaj7 Imaj7 II7 II7 ii7 V7 Imaj7 Imaj7', key: 'C' }],
    scales: ['ionian', 'lydian', 'mixolydian', 'dorian'], instruments: 'Rim click, shaker, bass, nylon-style chords',
  },
  {
    id: 'reggae', name: 'Reggae one-drop', category: 'core', family: 'latin', description: 'Off-beat skank, kick on 3',
    bpm: { min: 66, default: 76, max: 90 }, swing: 0.2, swingUnit: 16,
    drums: { kick: '........x.......', rim: '........x.......', hat: STRAIGHT8 },
    bass: 'R - - - . . 5 . . . . . 3 - . .',
    keys: { style: 'stab', pattern: '..x...x...x...x.', voicing: 'triad', length: 1 },
    progressions: [{ name: 'i–bVII', roman: 'i i bVII bVII', key: 'A' }],
    scales: ['aeolian', 'minor-pentatonic', 'dorian'], instruments: 'One-drop drums, deep bass, skank chords',
  },
  {
    id: 'country', name: 'Country train', category: 'core', family: 'country', description: 'Boom-chick with alternating bass',
    bpm: { min: 100, default: 120, max: 150 }, swing: 0, swingUnit: 8,
    drums: { kick: 'x.......x.......', snare: 'g.g.x.g.g.g.x.g.', hat: STRAIGHT8 },
    bass: 'R . . . . . . . 5 . . . . . . .',
    keys: { style: 'stab', pattern: '....x.......x...', voicing: 'triad', length: 2 },
    progressions: [{ name: 'I–IV–V', roman: 'I I IV IV V V I I', key: 'G' }],
    scales: ['major-pentatonic', 'mixolydian', 'major-blues'], instruments: 'Train-beat drums, bass, chords',
  },
  {
    id: 'lo-fi', name: 'Lo-fi hip-hop', category: 'core', family: 'neo-soul', description: 'Dusty swung beat, jazzy chords',
    bpm: { min: 70, default: 80, max: 90 }, swing: 0.55, swingUnit: 16,
    drums: { kick: 'x......x..x.....', snare: BACKBEAT, hat: STRAIGHT8 },
    bass: 'R - - . . . . . 5 - . . . . . .',
    keys: { style: 'sustain', voicing: 'rich' },
    progressions: [{ name: 'ii9–V13–Imaj9–vi9', roman: 'ii9 V13 Imaj9 vi9', key: 'C' }],
    scales: ['dorian', 'ionian', 'major-pentatonic'], instruments: 'Dusty drums, sub bass, Rhodes',
  },
  {
    id: 'synthwave', name: '80s synthwave', category: 'core', family: 'electronic', description: 'Four on the floor and arpeggios',
    bpm: { min: 85, default: 100, max: 118 }, swing: 0, swingUnit: 8,
    drums: { kick: 'x...x...x...x...', snare: BACKBEAT, openhat: '..o...o...o...o.' },
    bass: 'R . R . 8 . R . R . R . 8 . R .',
    keys: { style: 'arp', pattern: 'xxxxxxxxxxxxxxxx', voicing: 'triad', length: 1 },
    pad: 'chord',
    progressions: [{ name: 'i–bVI–bIII–bVII', roman: 'i bVI bIII bVII', key: 'A' }],
    scales: ['aeolian', 'dorian', 'minor-pentatonic'], instruments: 'Drum machine, synth bass, arpeggio, pad',
  },
  {
    id: 'metal', name: 'Metal', category: 'core', family: 'metal', description: 'Double kick and power chords',
    bpm: { min: 120, default: 140, max: 180 }, swing: 0, swingUnit: 8,
    drums: { kick: 'oooooooooooooooo', snare: BACKBEAT, hat: STRAIGHT8 },
    bass: 'R . R . R . R . R . R . R . R .',
    keys: { style: 'sustain', voicing: 'power' },
    progressions: [
      { name: 'i–bVI–bVII–i', roman: 'i bVI bVII i', key: 'E' },
      { name: 'i–bVI–V7–i (harmonic minor)', roman: 'i bVI V7 i', key: 'E' },
    ],
    scales: ['aeolian', 'phrygian', 'harmonic-minor', 'minor-pentatonic'], instruments: 'Double-kick drums, bass, power chords',
  },
  {
    id: 'modal-vamp', name: 'Modal vamp', category: 'core', family: 'modal', description: 'Long single chords so each mode’s colour note stands out',
    bpm: { min: 80, default: 104, max: 130 }, swing: 0, swingUnit: 8,
    drums: { kick: 'x.....x...x.....', snare: BACKBEAT, ride: 'o.o.o.o.o.o.o.o.' },
    bass: 'R . . . R . 5 . R . . . 8 . 5 .',
    keys: { style: 'sustain', voicing: 'rich' },
    progressions: [
      { name: 'Mixolydian, then Lydian (4 bars each)', roman: 'I7 I7 I7 I7 Imaj7#11 Imaj7#11 Imaj7#11 Imaj7#11', key: 'A' },
      { name: 'Dorian vamp', roman: 'i7 i7 i7 i7', key: 'D' },
      { name: 'Phrygian vamp', roman: 'i i bII i', key: 'E' },
      { name: 'Lydian vamp (I–II)', roman: 'Imaj7#11 Imaj7#11 II II', key: 'F' },
    ],
    scales: ['mixolydian', 'lydian', 'dorian', 'phrygian'], instruments: 'Drums with ride, bass, sustained keys',
  },
  {
    id: 'flamenco-rumba', name: 'Flamenco rumba', category: 'core', family: 'latin', description: 'Andalusian cadence with a 3+3+2 rumba strum and palmas',
    bpm: { min: 90, default: 112, max: 132 }, swing: 0, swingUnit: 8,
    drums: { kick: 'x..x....x..x....', rim: '....x.......x...', clap: '..x...x...x...x.' },
    bass: 'R . . R . . 5 . R . . R . . 5 .',
    keys: { style: 'stab', pattern: 'x..x..x.x..x..x.', voicing: 'triad', length: 1 },
    progressions: [{ name: 'Andalusian cadence i–bVII–bVI–V7', roman: 'i bVII bVI V7', key: 'A' }],
    scales: ['phrygian-dominant', 'harmonic-minor', 'phrygian'], instruments: 'Cajón, palmas, bass, nylon-style strums',
  },
  // ── Asia sound pack ───────────────────────────────────────────────────────
  {
    id: 'city-pop', name: 'City pop', category: 'asia', family: 'city-pop', description: 'Disco-funk groove with lush 7th chords',
    bpm: { min: 100, default: 112, max: 124 }, swing: 0.1, swingUnit: 16,
    drums: { kick: 'x...x...x...x...', snare: BACKBEAT, hat: 'g.g.g.g.g.g.g.g.', openhat: '..o...o...o...o.' },
    bass: 'R . 8 . R . 8 . R . 8 . R . 8 .',
    keys: { style: 'stab', pattern: '.x.....x..x.....', voicing: 'rich', length: 2 },
    progressions: [
      { name: 'Royal road (IVmaj7–V7–iii7–vi7)', roman: 'IVmaj7 V7 iii7 vi7', key: 'D' },
      { name: '"Just the Two of Us" (丸サ)', roman: 'IVmaj7 III7 vi7 v7+I7', key: 'D' },
    ],
    scales: ['ionian', 'major-pentatonic', 'dorian', 'harmonic-minor'],
    instruments: 'Disco drums, octave bass, Rhodes',
    about: 'Japanese city pop (late 1970s–1980s): disco-funk grooves, Rhodes and lush 7th and 9th chords. The royal road progression (IVmaj7–V7–iii7–vi) is the most common progression in J-pop.',
  },
  {
    id: 'anime-rock', name: 'Anime rock', category: 'asia', family: 'anime', description: 'Fast, bright, emotional',
    bpm: { min: 150, default: 172, max: 190 }, swing: 0, swingUnit: 8,
    drums: { kick: 'x.x...x.x.x...x.', snare: BACKBEAT, hat: STRAIGHT8 },
    bass: 'R . R . R . R . R . R . R . R .',
    keys: { style: 'stab', pattern: 'x.......x.......', voicing: 'triad', length: 4 },
    pad: 'chord',
    progressions: [
      { name: 'Royal road', roman: 'IVmaj7 V7 iii7 vi', key: 'A' },
      { name: 'Komuro (vi–IV–V–I)', roman: 'vi IV V I', key: 'A' },
    ],
    scales: ['major-pentatonic', 'ionian', 'minor-pentatonic', 'ryukyu'],
    instruments: 'Driving drums, bass, piano and strings pad',
    about: 'Anime openings are usually fast J-rock built on the same royal road and Komuro progressions as J-pop.',
  },
  {
    id: 'k-ballad', name: 'K-R&B ballad', category: 'asia', family: 'k-pop', description: 'Half-time feel with a falling bass line',
    bpm: { min: 62, default: 70, max: 84 }, swing: 0.3, swingUnit: 16,
    drums: { kick: 'x.........x.....', snare: '........x.......', hat: STRAIGHT8 },
    bass: 'R - - - - - - - R - - - - - - .',
    keys: { style: 'sustain', voicing: 'rich' },
    pad: 'chord',
    progressions: [{ name: 'Falling bass ballad', roman: 'Imaj7 V/VII vi7 I/V IVmaj7 iii7 ii7 V7sus4', key: 'Eb' }],
    scales: ['ionian', 'major-pentatonic', 'major-blues'],
    instruments: 'Half-time drums, bass following slash chords, piano and pad',
    about: 'Korean R&B ballads lean on descending bass lines (slash chords such as V/VII) and rich 7th and 9th chords; licks borrow gospel runs.',
  },
  {
    id: 'wuxia', name: 'Wuxia drone', category: 'asia', family: 'wuxia', description: 'Pentatonic drone, big drums and a gong',
    bpm: { min: 56, default: 66, max: 80 }, swing: 0, swingUnit: 8,
    drums: { tom: 'x.....x...x.....', gong: 'x' + '.'.repeat(63), rim: '....o.......o...' },
    bass: 'drone',
    keys: { style: 'none', voicing: 'power' },
    pad: 'drone',
    progressions: [{ name: 'Drone with a step down', roman: 'I5 I5 bVII5 I5', key: 'A' }],
    scales: ['yu', 'gong', 'shang', 'minor-pentatonic'],
    instruments: 'Toms, gong every four bars, low drone',
    about: 'Wuxia film and game music uses Chinese pentatonic modes (Gong, Shang, Jue, Zhi, Yu) over drones and big drums. Slides and bends imitate the pressed strings of the guzheng.',
  },
  {
    id: 'vietnamese-folk', name: 'Điệu Bắc folk', category: 'asia', family: 'vietnamese', description: 'Bright Vietnamese folk mode with zither-like arpeggios',
    bpm: { min: 80, default: 92, max: 108 }, swing: 0, swingUnit: 8,
    drums: { rim: 'x...o...x...o...', kick: 'o.......o.......', clapper: '............x...' },
    bass: 'R . . . 5 . . . R . . . 5 . . .',
    keys: { style: 'arp', pattern: 'x.x.x.x.x.x.x.x.', voicing: 'triad', length: 2 },
    progressions: [{ name: 'Ngũ cung chords', roman: 'Isus2 ii7 IVsus2 Vsus4', key: 'G' }],
    scales: ['dieu-bac', 'zhi', 'major-pentatonic'],
    instruments: 'Woodblock, light drum, bass, zither-like arpeggios',
    about: 'Inspired by northern Vietnamese folk music in Điệu Bắc (Hò, Xự, Xang, Xê, Cống). The chords are added for practice and use only notes of the mode; traditional music is mostly melody over a drone. Give Xự (2) and Cống (6) a little vibrato (rung).',
  },
  {
    id: 'cai-luong', name: 'Cải lương drone (Hơi Oán)', category: 'asia', family: 'vietnamese', description: 'Slow mournful drone with a song lang–style clapper',
    bpm: { min: 50, default: 60, max: 72 }, swing: 0, swingUnit: 8,
    drums: { clapper: '.'.repeat(60) + 'x...', tom: 'o' + '.'.repeat(15) },
    bass: 'drone',
    keys: { style: 'none', voicing: 'power' },
    pad: 'drone',
    progressions: [{ name: 'Hò drone, move to Xang', roman: 'I5 I5 IV5 I5', key: 'G' }],
    scales: ['hoi-oan', 'nam-ai'],
    instruments: 'Low drone, soft drum, clapper at the end of each 4-bar phrase',
    about: 'A practice drone in the spirit of cải lương and vọng cổ (Hơi Oán). Press Xự (b3) and Cống (b6) upward and vibrate Oan (b7). This is not a vọng cổ arrangement: real vọng cổ follows its own long rhythmic cycles, marked by the song lang.',
  },
];

export function getGroove(id: string) {
  const g = GROOVES.find((x) => x.id === id);
  if (!g) throw new Error(`Unknown groove "${id}". Options: ${GROOVES.map((x) => x.id).join(', ')}`);
  return g;
}

/** Roman-numeral progression in a key → chord spans (4/4, one bar per token, "+" splits a bar). */
export function progressionChords(roman: string, key: string, repeats = 1): ChordSpan[] {
  const bars = roman.trim().split(/\s+/);
  const out: ChordSpan[] = [];
  for (let r = 0; r < repeats; r++) {
    bars.forEach((bar, i) => {
      const parts = bar.split('+');
      const per = 4 / parts.length;
      parts.forEach((p, k) => {
        const start = (r * bars.length + i) * 4 + k * per;
        out.push({ symbol: romanToChord(p, key), startBeat: start, endBeat: start + per });
      });
    });
  }
  return out;
}

export type Part = 'drums' | 'bass' | 'keys' | 'pad';

export interface TrackEvent {
  beat: number;
  duration: number;
  part: Part;
  inst?: DrumInst;
  midi?: number;
  midis?: number[];
  velocity: number;
}

export interface RenderedTrack {
  events: TrackEvent[];
  chords: ChordSpan[];
  lengthBeats: number;
}

const VEL: Record<string, number> = { x: 1, o: 0.72, g: 0.35 };

function swingOffset(step: number, groove: Groove) {
  if (!groove.swing) return 0;
  if (groove.swingUnit === 8) return step % 4 === 2 ? (groove.swing / 6) : 0;
  return step % 2 === 1 ? groove.swing / 12 : 0;
}

/** Bass register: roots between A1 (33) and G#2 (44). */
const bassRoot = (rootPc: number) => 33 + pc(rootPc - 9);

function chordTone(c: ParsedChord, token: string): number {
  const has = (s: number) => c.relPcs.includes(s);
  switch (token) {
    case 'R':
      return 0;
    case '3':
      return has(3) && !has(4) ? 3 : has(4) ? 4 : has(5) ? 5 : 2;
    case '5':
      return has(6) && !has(7) ? 6 : has(8) && !has(7) ? 8 : 7;
    case '6':
      return 9;
    case 'b7':
      return 10;
    case '7':
      return has(11) ? 11 : has(9) && !has(10) ? 9 : 10;
    case '8':
      return 12;
    default:
      return 0;
  }
}

/** Chord voicing near the previous one (smooth voice leading) inside a register. */
function voice(c: ParsedChord, style: 'triad' | 'seventh' | 'rich' | 'power', prev: number[] | null, low = 52, high = 76): number[] {
  const rels = c.relPcs;
  let pick: number[];
  if (style === 'power') pick = [0, rels.includes(7) ? 7 : rels.find((r) => r === 6 || r === 8) ?? 7];
  else if (style === 'triad') pick = rels.filter((r) => [0, 2, 3, 4, 5, 6, 7, 8].includes(r)).slice(0, 3);
  else if (style === 'seventh') pick = rels.filter((r) => r !== 2 || !rels.includes(3)).slice(0, 4);
  else pick = rels.slice(0, 5);
  if (!pick.includes(0) && style !== 'rich') pick.unshift(0);
  const target = prev && prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : (low + high) / 2;
  const notes = pick.map((r) => {
    let best = 0;
    let bestD = Infinity;
    for (let m = low; m <= high; m++) {
      if (pc(m) !== pc(c.root.pc + r)) continue;
      const d = Math.abs(m - target);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    return best;
  });
  return [...new Set(notes)].sort((a, b) => a - b);
}

function cycle(pattern: string, step: number) {
  return pattern[step % pattern.length];
}

/**
 * Renders a groove over chord spans. Times are in beats; nothing here depends on tempo.
 * `bars` defaults to the chords' length rounded up to whole bars.
 */
export function renderTrack(groove: Groove, chords: ChordSpan[], bars?: number): RenderedTrack {
  if (!chords.length) throw new Error('A backing track needs at least one chord.');
  const parsed = chords.map((c) => ({ ...c, chord: parseChord(c.symbol) }));
  const lengthBeats = (bars ?? Math.ceil(Math.max(...chords.map((c) => c.endBeat)) / 4)) * 4;
  const steps = lengthBeats * 4;
  const events: TrackEvent[] = [];
  const at = (step: number) => step / 4 + swingOffset(step % 16, groove);
  const chordAt = (beat: number) => parsed.find((c) => beat >= c.startBeat && beat < c.endBeat) ?? parsed[parsed.length - 1];
  const nextChord = (beat: number) => parsed.find((c) => c.startBeat > beat) ?? parsed[0];

  // Drums
  for (const [inst, pattern] of Object.entries(groove.drums) as [DrumInst, string][]) {
    for (let s = 0; s < steps; s++) {
      const ch = cycle(pattern, s);
      if (ch !== '.' && VEL[ch]) events.push({ beat: at(s), duration: 0.25, part: 'drums', inst, velocity: VEL[ch] });
    }
  }

  // Bass
  if (groove.bass === 'walking') {
    for (let beat = 0; beat < lengthBeats; beat++) {
      const c = chordAt(beat).chord;
      const root = bassRoot(c.root.pc);
      const posInChord = beat - chordAt(beat).startBeat;
      const next = nextChord(beat);
      const lastBeatOfChord = beat + 1 >= chordAt(beat).endBeat;
      let midi: number;
      if (posInChord === 0) midi = root;
      else if (lastBeatOfChord) {
        const target = bassRoot(next.chord.root.pc);
        midi = target + (target - 1 >= 33 ? -1 : 1); // chromatic approach from below (or above near the bottom)
      } else midi = root + [chordTone(c, '3'), chordTone(c, '5'), chordTone(c, '6')][(posInChord - 1) % 3];
      events.push({ beat, duration: 0.9, part: 'bass', midi, velocity: posInChord === 0 ? 0.9 : 0.75 });
    }
  } else if (groove.bass === 'drone') {
    for (let bar = 0; bar < lengthBeats / 4; bar++) {
      const c = chordAt(bar * 4).chord;
      events.push({ beat: bar * 4, duration: 4, part: 'bass', midi: bassRoot(c.root.pc), velocity: 0.7 });
    }
  } else if (groove.bass !== 'none') {
    const tokens = groove.bass.split(/\s+/);
    for (let s = 0; s < steps; s++) {
      const tok = tokens[s % tokens.length];
      if (tok === '.' || tok === '-') continue;
      let len = 1;
      while (s + len < steps && tokens[(s + len) % tokens.length] === '-') len++;
      const beat = s / 4;
      const span = chordAt(beat);
      const c = span.chord;
      // Slash chords put their bass note under the root position.
      const rootPc = c.bass ? c.bass.pc : c.root.pc;
      let midi: number;
      if (tok === 'A') midi = bassRoot(nextChord(beat).chord.root.pc) - 1;
      else midi = bassRoot(rootPc) + (tok === 'R' || c.bass ? (tok === '8' ? 12 : 0) : chordTone(c, tok));
      const end = Math.min((s + len) / 4, span.endBeat);
      events.push({ beat: at(s), duration: Math.max(0.2, end - beat - 0.03), part: 'bass', midi, velocity: s % 4 === 0 ? 0.9 : 0.75 });
    }
  }

  // Keys
  let prevVoicing: number[] | null = null;
  if (groove.keys.style === 'sustain') {
    for (const span of parsed) {
      const v = voice(span.chord, groove.keys.voicing, prevVoicing);
      prevVoicing = v;
      events.push({ beat: span.startBeat, duration: span.endBeat - span.startBeat - 0.05, part: 'keys', midis: v, velocity: 0.55 });
    }
  } else if (groove.keys.style === 'stab' || groove.keys.style === 'arp') {
    const pattern = groove.keys.pattern ?? 'x...............';
    let arpIndex = 0;
    for (let s = 0; s < steps; s++) {
      if (cycle(pattern, s) === '.') continue;
      const beat = s / 4;
      const span = chordAt(beat);
      const v = voice(span.chord, groove.keys.voicing, prevVoicing);
      if (groove.keys.style === 'stab') {
        prevVoicing = v;
        const end = Math.min(beat + (groove.keys.length ?? 1) / 4, span.endBeat);
        events.push({ beat: at(s), duration: Math.max(0.1, end - beat - 0.02), part: 'keys', midis: v, velocity: 0.6 });
      } else {
        prevVoicing = v;
        const up = [...v, ...v.map((m) => m + 12)];
        events.push({ beat: at(s), duration: (groove.keys.length ?? 1) / 4, part: 'keys', midi: up[arpIndex++ % up.length], velocity: 0.5 });
      }
    }
  }

  // Pad
  if (groove.pad === 'chord') {
    let prev: number[] | null = null;
    for (const span of parsed) {
      const v = voice(span.chord, 'triad', prev, 55, 72);
      prev = v;
      events.push({ beat: span.startBeat, duration: span.endBeat - span.startBeat, part: 'pad', midis: v, velocity: 0.35 });
    }
  } else if (groove.pad === 'drone') {
    const home = parsed[0].chord.root.pc;
    for (let bar = 0; bar < lengthBeats / 4; bar += 4) {
      const root = 45 + pc(home - 9);
      events.push({ beat: bar * 4, duration: Math.min(16, lengthBeats - bar * 4), part: 'pad', midis: [root, root + 7, root + 12], velocity: 0.4 });
    }
  }

  events.sort((a, b) => a.beat - b.beat);
  return { events, chords: chords.map(({ symbol, startBeat, endBeat }) => ({ symbol, startBeat, endBeat })), lengthBeats };
}

/** Groove + Roman-numeral progression + key in one call. */
export function renderGroove(grooveId: string, opts: { progression?: number; key?: string; repeats?: number } = {}): RenderedTrack {
  const g = getGroove(grooveId);
  const prog = g.progressions[opts.progression ?? 0] ?? g.progressions[0];
  const key = opts.key ?? prog.key;
  if (!parseNote(key)) throw new Error(`Unknown key "${key}".`);
  return renderTrack(g, progressionChords(prog.roman, key, opts.repeats ?? 1));
}

/** Seconds for a beat at a tempo: the only place tempo enters. */
export const beatToSeconds = (beat: number, bpm: number) => (beat * 60) / bpm;
