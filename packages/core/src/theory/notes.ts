/**
 * Pitch-class core. Every note is stored as a number (MIDI or pitch class 0-11, C = 0)
 * and only turned into a name when displayed, spelled for the current key or scale.
 */

/** A pitch class: 0-11 with C = 0. */
export type PitchClass = number;

export const pc = (n: number): PitchClass => ((n % 12) + 12) % 12;

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
/** Semitones of each major-scale degree (1..7). */
export const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export interface NoteName {
  letter: number; // index into LETTERS
  alter: number; // -2..2
  pc: PitchClass;
  name: string;
}

/** Parse "C", "F#", "Bb", "Ebb", "C##" (also accepts unicode ♯/♭). */
export function parseNote(input: string): NoteName | null {
  const m = /^([A-Ga-g])([#♯]{1,2}|[b♭]{1,2})?$/.exec(input.trim());
  if (!m) return null;
  const letter = LETTERS.indexOf(m[1].toUpperCase() as (typeof LETTERS)[number]);
  const acc = (m[2] ?? '').replace(/♯/g, '#').replace(/♭/g, 'b');
  const alter = acc.startsWith('#') ? acc.length : -acc.length;
  const p = pc(LETTER_PC[letter] + alter);
  return { letter, alter, pc: p, name: LETTERS[letter] + accidental(alter) };
}

const accidental = (alter: number) => (alter > 0 ? '#'.repeat(alter) : 'b'.repeat(-alter));

/** "b3" -> { number: 3, alter: -1 }, "#11" -> { number: 11, alter: 1 }, "bb7" -> { number: 7, alter: -2 }. */
export function parseDegree(label: string): { number: number; alter: number } {
  const m = /^(bb|b|##|#)?(\d{1,2})$/.exec(label);
  if (!m) throw new Error(`Bad degree label "${label}"`);
  const acc = m[1] ?? '';
  return { number: Number(m[2]), alter: acc.startsWith('#') ? acc.length : -acc.length };
}

/** Semitones above the root for a degree label, e.g. "b3" = 3, "9" = 14, "#11" = 18. */
export function degreeSemitones(label: string): number {
  const { number, alter } = parseDegree(label);
  const idx = (number - 1) % 7;
  const octaves = Math.floor((number - 1) / 7);
  return MAJOR_STEPS[idx] + 12 * octaves + alter;
}

/** Turn a semitone offset back into the plainest degree label (used for chord tones). */
export function semitoneToDegree(semi: number): string {
  return ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'][pc(semi)];
}

/**
 * Spell a degree from a root so the letter names follow the degree number:
 * Bb + "b3" = "Db", F# + "3" = "A#", C + "#4" = "F#". Falls back to a simple
 * sharp/flat name if the correct spelling would need more than two accidentals.
 */
export function spellDegree(root: NoteName, label: string): string {
  const { number } = parseDegree(label);
  const letter = (root.letter + (number - 1)) % 7;
  const target = pc(root.pc + degreeSemitones(label));
  let diff = pc(target - LETTER_PC[letter]);
  if (diff > 6) diff -= 12;
  // Double sharps/flats are correct on paper but hard to read on a fretboard, so use the plain name instead.
  if (Math.abs(diff) > 1) return (root.alter < 0 || FLAT_MAJOR_KEYS.has(root.pc) ? FLAT_NAMES : SHARP_NAMES)[target];
  return LETTERS[letter] + accidental(diff);
}

export function pcName(p: number, preferFlats = false): string {
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[pc(p)];
}

export function midiName(midi: number, preferFlats = false): string {
  return pcName(midi, preferFlats) + (Math.floor(midi / 12) - 1);
}

/** Keys whose signatures use flats (major-key tonic pitch classes). */
const FLAT_MAJOR_KEYS = new Set([5, 10, 3, 8, 1, 6]);
export const prefersFlats = (root: NoteName) => root.alter < 0 || (root.alter === 0 && FLAT_MAJOR_KEYS.has(root.pc) && root.pc !== 0);

export const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Tunings, listed lowest string first (MIDI numbers). */
export const TUNINGS: Record<string, { label: string; midi: number[] }> = {
  standard: { label: 'Standard (E A D G B E)', midi: [40, 45, 50, 55, 59, 64] },
  'drop-d': { label: 'Drop D (D A D G B E)', midi: [38, 45, 50, 55, 59, 64] },
  'eb-standard': { label: 'Eb standard (half step down)', midi: [39, 44, 49, 54, 58, 63] },
  'drop-c': { label: 'Drop C (C G C F A D)', midi: [36, 43, 48, 53, 57, 62] },
  dadgad: { label: 'DADGAD', midi: [38, 45, 50, 55, 57, 62] },
  'open-g': { label: 'Open G (D G D G B D)', midi: [38, 43, 50, 55, 59, 62] },
  'open-e': { label: 'Open E (E B E G# B E)', midi: [40, 47, 52, 56, 59, 64] },
  'seven-string': { label: '7-string standard (B E A D G B E)', midi: [35, 40, 45, 50, 55, 59, 64] },
  'eight-string': { label: '8-string standard (F# B E A D G B E)', midi: [30, 35, 40, 45, 50, 55, 59, 64] },
  // Vietnamese cải lương guitar (phím lõm). Note names as taught; octaves are our estimate from the
  // light string gauges used (slack strings make deep pressing possible).
  'day-lai': { label: 'Dây Lai, Vietnamese cải lương guitar (A D G D A D)', midi: [33, 38, 43, 50, 57, 62] },
};

export function getTuning(id: string | undefined): number[] {
  const t = TUNINGS[id ?? 'standard'];
  if (!t) throw new Error(`Unknown tuning "${id}". Options: ${Object.keys(TUNINGS).join(', ')}`);
  return t.midi;
}

/**
 * Guitarist string number (1 = highest-pitched string) from an internal index
 * (0 = lowest string). Every tool output uses guitarist numbering.
 */
export const stringNumber = (index: number, stringCount: number) => stringCount - index;
