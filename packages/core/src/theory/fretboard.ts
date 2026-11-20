/**
 * Fretboard model built on pitch-class integers.
 *
 * Bug fixed here: the blueprint matched scale notes by comparing name strings from a
 * sharp-only list ("A#"), so any scale spelled with flats ("Bb", "Eb", "Gb") never matched
 * and those notes disappeared from the neck. Every comparison below is done on integers
 * (C = 0 … B = 11); names are only produced at the end, spelled for the scale.
 */
import { getTuning, parseNote, pc, pcName, prefersFlats, spellDegree, stringNumber } from './notes.js';
import { findScale, scaleSemitones } from './scales.js';

export interface FretCell {
  /** Guitarist numbering: 1 = highest-pitched string. */
  string: number;
  /** Internal index: 0 = lowest string. */
  stringIndex: number;
  fret: number;
  midi: number;
  pc: number;
  inScale: boolean;
  /** Scale degree label ("1", "b3", "#4"…) when the note is in the scale. */
  degree?: string;
  /** Interval from the root in semitones (0-11). */
  semitones: number;
  /** Note name spelled for the scale (in-scale notes) or for the key signature (others). */
  name: string;
}

export interface FretboardQuery {
  root: string;
  /** Scale id or name; or give `intervals` directly. */
  scale?: string;
  /** Semitones above the root, e.g. [0, 3, 5, 7, 10]. Used when `scale` is not given. */
  intervals?: number[];
  tuning?: string | number[];
  frets?: number;
}

/** Returns a grid [stringIndex][fret] covering every fret, so it can drive both drawing and hit-testing. */
export function fretboardModel(q: FretboardQuery): FretCell[][] {
  const root = parseNote(q.root);
  if (!root) throw new Error(`Unknown root note "${q.root}".`);
  const tuning = Array.isArray(q.tuning) ? q.tuning : getTuning(q.tuning);
  const frets = q.frets ?? 15;
  const def = q.scale ? findScale(q.scale) : undefined;
  if (q.scale && !def) throw new Error(`Unknown scale "${q.scale}".`);
  const semis = def ? scaleSemitones(def) : (q.intervals ?? []).map((i) => pc(i));
  const degreeBySemi = new Map<number, string>();
  if (def) def.degrees.forEach((d, i) => degreeBySemi.set(pc(semis[i]), d));
  const inScale = new Set(semis.map((s) => pc(s)));
  const flats = prefersFlats(root);

  return tuning.map((open, stringIndex) =>
    Array.from({ length: frets + 1 }, (_, fret) => {
      const midi = open + fret;
      const rel = pc(midi - root.pc);
      const hit = inScale.has(rel);
      const degree = hit ? degreeBySemi.get(rel) : undefined;
      return {
        string: stringNumber(stringIndex, tuning.length),
        stringIndex,
        fret,
        midi,
        pc: pc(midi),
        inScale: hit,
        degree,
        semitones: rel,
        name: degree ? spellDegree(root, degree) : pcName(midi, flats),
      };
    }),
  );
}

/** Scale notes only, flattened, in the order strings low → high, frets low → high. */
export function scaleCells(q: FretboardQuery): FretCell[] {
  return fretboardModel(q).flat().filter((c) => c.inScale);
}
