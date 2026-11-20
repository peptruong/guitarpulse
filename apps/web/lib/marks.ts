import { parseChord } from '@guitarpulse/core/theory/chords';
import { getScale } from '@guitarpulse/core/theory/scales';
import { pc } from '@guitarpulse/core/theory/notes';
import type { FretMark } from '@/components/Fretboard';
import { degreeOf, degreeRole } from './degrees';

export interface MarkOptions {
  root: string;
  scale: string;
  tuning?: string;
  pattern?: 'full' | 'box' | '3nps';
  position?: number;
  maxFret?: number;
  labels?: 'degrees' | 'notes';
  /** Colour against this chord: its 3rd and 7th stand out, other chord tones stay bright, the rest dim. */
  chord?: string | null;
}

export function scaleMarks(o: MarkOptions): FretMark[] {
  const s = getScale({ root: o.root, scale: o.scale, tuning: o.tuning ?? 'standard', pattern: o.pattern ?? 'full', position: o.position ?? 1, maxFret: o.maxFret ?? 15 });
  if (!o.chord) {
    return s.fretboard.map((n) => ({ string: n.string, fret: n.fret, label: o.labels === 'notes' ? n.note : n.degree, role: degreeRole(n.degree) }));
  }
  const c = parseChord(o.chord);
  return s.fretboard.map((n) => {
    const deg = degreeOf(n.midi, c.root.pc);
    const inChord = c.pcs.includes(pc(n.midi));
    const role = degreeRole(deg);
    const guide = inChord && (role === 'third' || role === 'seventh');
    return { string: n.string, fret: n.fret, label: o.labels === 'notes' ? n.note : deg, role, emphasis: guide ? 'strong' : inChord ? 'normal' : 'dim' };
  });
}
