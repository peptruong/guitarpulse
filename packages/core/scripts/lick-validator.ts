/**
 * Checks every lick with alphaTab itself (the renderer the app uses), then checks the music:
 * - the alphaTex parses with no errors,
 * - every bar adds up to its time signature,
 * - every sounding pitch (bend targets and natural harmonics included) is in the lick's scale
 *   or in its declared passing notes,
 * - frets stay between 0 and 24, and difficulty, tempo and ids are sensible.
 */
import * as alphaTab from '@coderline/alphatab';
import type { Lick } from '../src/licks/types.js';
import { findScale } from '../src/theory/scales.js';
import { degreeSemitones, parseNote, pc } from '../src/theory/notes.js';

const TICKS_PER_WHOLE = 3840;
const HARMONIC_OFFSET: Record<number, number> = { 12: 12, 7: 19, 19: 19, 5: 24, 24: 24, 4: 28, 9: 28, 16: 28 };

export interface LickProblem {
  id: string;
  problem: string;
}

export function validateLick(lick: Lick): LickProblem[] {
  const problems: LickProblem[] = [];
  const add = (problem: string) => problems.push({ id: lick.id, problem });
  const scale = findScale(lick.scale);
  const root = parseNote(lick.key);
  if (!scale) add(`unknown scale "${lick.scale}"`);
  if (!root) add(`unknown key "${lick.key}"`);
  if (!scale || !root) return problems;
  const allowed = new Set([...scale.degrees, ...lick.passing].map((d) => pc(root.pc + degreeSemitones(d))));

  let score: alphaTab.model.Score;
  try {
    const imp = new alphaTab.importer.AlphaTexImporter();
    imp.initFromString(lick.alphaTex, new alphaTab.Settings());
    score = imp.readScore();
  } catch (e) {
    const err = e as { message?: string; diagnostics?: unknown; cause?: { diagnostics?: unknown } };
    add(`alphaTex does not parse: ${err.message ?? e} ${JSON.stringify(err.diagnostics ?? err.cause?.diagnostics ?? '').slice(0, 300)}`);
    return problems;
  }
  if (score.tempo !== lick.bpm) add(`tempo ${score.tempo} does not match bpm ${lick.bpm}`);

  const staff = score.tracks[0].staves[0];
  staff.bars.forEach((bar, bi) => {
    const mb = bar.masterBar;
    const expected = (mb.timeSignatureNumerator * TICKS_PER_WHOLE) / mb.timeSignatureDenominator;
    for (const voice of bar.voices) {
      if (voice.isEmpty) continue;
      let total = 0;
      for (const beat of voice.beats) {
        if (beat.graceType !== 0) continue;
        total += beat.playbackDuration;
        for (const note of beat.notes) {
          if (note.fret < 0 || note.fret > 24) add(`bar ${bi + 1}: fret ${note.fret} out of range`);
          if (note.isDead) continue;
          const pitches: number[] = [];
          if (note.harmonicType === 1) {
            const off = HARMONIC_OFFSET[note.fret];
            if (off === undefined) add(`bar ${bi + 1}: natural harmonic at fret ${note.fret} is not a standard node`);
            else pitches.push(note.realValue - note.fret + off);
          } else if (note.harmonicType !== 0) {
            continue; // pinch/artificial/tapped harmonics: pitch depends on the pick position
          } else if (note.hasBend) {
            const values = (note.bendPoints ?? []).map((p) => p.value);
            const max = Math.max(...values);
            const min = Math.min(...values);
            if (max % 2 === 0) pitches.push(note.realValue + max / 2);
            if (min % 2 === 0) pitches.push(note.realValue + min / 2);
          } else {
            pitches.push(note.realValue);
          }
          for (const p of pitches) {
            if (!allowed.has(pc(p))) {
              const deg = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'][pc(p - root.pc)];
              add(`bar ${bi + 1}: string ${staff.tuning.length - note.string + 1} fret ${note.fret} sounds degree ${deg}, outside ${lick.key} ${lick.scale}${lick.passing.length ? ` + ${lick.passing.join(',')}` : ''}`);
            }
          }
        }
      }
      if (total !== expected) add(`bar ${bi + 1}: rhythm adds up to ${total / 960} beats, expected ${expected / 960}`);
    }
  });
  if (![1, 2, 3, 4, 5].includes(lick.difficulty)) add('difficulty must be 1-5');
  if (lick.bpm < 40 || lick.bpm > 240) add('bpm should be 40-240');
  if (!lick.theory || lick.theory.length < 20) add('theory note is missing or too short');
  return problems;
}

export function validateAll(licks: Lick[]): LickProblem[] {
  const problems = licks.flatMap(validateLick);
  const seen = new Set<string>();
  for (const l of licks) {
    if (seen.has(l.id)) problems.push({ id: l.id, problem: 'duplicate id' });
    seen.add(l.id);
  }
  return problems;
}
