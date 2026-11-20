import { pc, semitoneToDegree } from '@guitarpulse/core/theory/notes';

/** Colour and shape coding shared by the fretboard, tab and legends (Okabe-Ito palette, colour-blind safe). */
export type DegreeRole = 'root' | 'third' | 'fifth' | 'seventh' | 'ext' | 'other';

export const ROLE_STYLE: Record<DegreeRole, { color: string; shape: 'square' | 'circle' | 'diamond' | 'triangle' | 'hexagon' | 'ring'; label: string }> = {
  root: { color: '#E69F00', shape: 'square', label: 'Root' },
  third: { color: '#56B4E9', shape: 'circle', label: '3rd' },
  fifth: { color: '#009E73', shape: 'diamond', label: '5th' },
  seventh: { color: '#CC79A7', shape: 'triangle', label: '7th' },
  ext: { color: '#D55E00', shape: 'hexagon', label: '2/4/6 (9/11/13)' },
  other: { color: '#F0E442', shape: 'ring', label: 'Outside' },
};

/** Role of a degree label such as "1", "b3", "#4", "b7", "9". */
export function degreeRole(degree: string): DegreeRole {
  const n = Number.parseInt(degree.replace(/^[b#♭♯]+/, ''), 10);
  if (n === 1 || n === 8) return 'root';
  if (n === 3 || n === 10) return 'third';
  if (n === 5 || n === 12) return 'fifth';
  if (n === 7 || n === 14) return 'seventh';
  if ([2, 4, 6, 9, 11, 13].includes(n)) return 'ext';
  return 'other';
}

/** Degree label of a MIDI note against a root pitch class, e.g. 3 semitones above A is "b3". */
export function degreeOf(midi: number, rootPc: number): string {
  return semitoneToDegree(pc(midi - rootPc));
}

/** Role of a note given the pitch classes that count as "in" (scale) and the root. */
export function roleInScale(midi: number, rootPc: number, scalePcs: number[]): DegreeRole {
  if (!scalePcs.includes(pc(midi))) return 'other';
  return degreeRole(degreeOf(midi, rootPc));
}

export const ROLE_ORDER: DegreeRole[] = ['root', 'third', 'fifth', 'seventh', 'ext', 'other'];
