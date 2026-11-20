/**
 * Lick mutator: turns one lick into new practice material instead of something to memorise.
 * - transpose: same shape in another key
 * - displace: start an eighth note later (or a beat later for triplet licks)
 * - flip: mirror the contour around the first note, staying in the scale
 * - retarget: end on the 3rd of the next chord
 * - reverse: play it backwards
 * Every result is real alphaTex that alphaTab can render and play.
 */
import { assignFingering, type Position } from './fingering.js';
import { makeLick, type Lick } from './licks/types.js';
import { parseAlphaTexBody, serializeAlphaTex, splitTicks, TICKS_PER_QUARTER, type TexBeat, type TexNote } from './tex/alphatex.js';
import { parseChord } from './theory/chords.js';
import { degreeSemitones, getTuning, parseNote, pc, pcName, prefersFlats, semitoneToDegree } from './theory/notes.js';
import { findScale } from './theory/scales.js';

export type Mutation =
  | { op: 'transpose'; toKey: string }
  | { op: 'displace' }
  | { op: 'flip' }
  | { op: 'retarget'; chord: string }
  | { op: 'reverse' };

export interface MutationResult {
  lick: Lick;
  explanation: string;
  warnings: string[];
}

const STANDARD = getTuning('standard');
const openMidi = (s: number) => STANDARD[STANDARD.length - s];
const tsOf = (l: Lick) => l.timeSignature.split('/').map(Number) as [number, number];
const cloneBeats = (beats: TexBeat[]) => beats.map((b) => ({ ...b, notes: b.notes.map((n) => ({ ...n })), effects: [...b.effects] }));
const NAMES: Record<Mutation['op'], string> = { transpose: 'in', displace: 'displaced', flip: 'flipped', retarget: 'retargeted', reverse: 'reversed' };

function stripEffects(fx: string, remove: RegExp[]) {
  let out = fx;
  for (const r of remove) out = out.replace(r, ' ');
  return out.replace(/\s+/g, ' ').trim();
}
const MOTION_FX = [/\bb\s*\([^)]*\)/g, /\bh\b/g, /\bsl\b/g, /\bss\b/g, /\bsib\b/g, /\bsia\b/g, /\bsou\b/g, /\bsod\b/g, /\btr\s+\d+\s+\d+/g];

function finish(lick: Lick, beats: TexBeat[], changes: Partial<Pick<Lick, 'key' | 'chord' | 'passing'>> & { suffix: string; idSuffix: string }, explanation: string, warnings: string[]): MutationResult {
  const ts = tsOf(lick);
  const tex = serializeAlphaTex(beats, ts);
  const key = changes.key ?? lick.key;
  const passing = [...new Set(changes.passing ?? lick.passing)];
  const out = makeLick(`${lick.id}~${changes.idSuffix}`, lick.artist, lick.genre, `${lick.title} (${changes.suffix})`, {
    key,
    scale: lick.scale,
    chord: changes.chord ?? lick.chord,
    bpm: lick.bpm,
    diff: lick.difficulty,
    tech: lick.techniques,
    targets: lick.targetTones,
    theory: explanation,
    tex,
    passing,
    ts: ts[0] === 4 && ts[1] === 4 ? undefined : ts,
  });
  return { lick: out, explanation, warnings };
}

/** Shift a whole chord-symbol text by semitones ("Am7 D7" → "Bm7 E7"); words that are not chords are kept. */
export function transposeChordText(text: string, semitones: number, preferFlat: boolean) {
  return text
    .split(/\s+/)
    .map((tok) => {
      const m = /^([A-G][#b]?)(.*)$/.exec(tok);
      if (!m) return tok;
      const root = parseNote(m[1]);
      if (!root) return tok;
      const rest = m[2].replace(/\/([A-G][#b]?)/, (_, b: string) => {
        const bn = parseNote(b);
        return bn ? `/${pcName(bn.pc + semitones, preferFlat)}` : `/${b}`;
      });
      return pcName(root.pc + semitones, preferFlat) + rest;
    })
    .join(' ');
}

function sounding(beats: TexBeat[]) {
  const out: { beat: number; note: TexNote; midi: number }[] = [];
  beats.forEach((b, i) =>
    b.notes.forEach((n) => {
      if (n.kind !== 'fretted') return;
      out.push({ beat: i, note: n, midi: openMidi(n.string) + n.fret });
    }),
  );
  return out;
}

/** Re-fingers fretted notes for new pitches, keeping chords together and staying near `near`. */
function refinger(beats: TexBeat[], newMidi: Map<TexNote, number>, near: Map<TexNote, Position>) {
  const groups: { notes: TexNote[]; midis: number[] }[] = [];
  for (const b of beats) {
    const fretted = b.notes.filter((n) => n.kind === 'fretted');
    if (!fretted.length) continue;
    groups.push({ notes: fretted, midis: fretted.map((n) => newMidi.get(n)!) });
  }
  const path = assignFingering(
    groups.map((g) => g.midis),
    { tuning: STANDARD, maxFret: 22, near: groups.map((g) => near.get(g.notes[0]) ?? null) },
  );
  // Apply in time order so ties can follow the note they hold onto its new string.
  const moved = new Map<number, number>(); // original string -> new string of the latest note there
  let gi = 0;
  for (const b of beats) {
    for (const n of b.notes) if (n.kind === 'tie' && moved.has(n.string)) n.string = moved.get(n.string)!;
    const fretted = b.notes.filter((n) => n.kind === 'fretted');
    if (!fretted.length) continue;
    fretted.forEach((n, k) => {
      const orig = n.string;
      n.string = path[gi][k].string;
      n.fret = path[gi][k].fret;
      moved.set(orig, n.string);
    });
    gi++;
  }
}

function transpose(lick: Lick, toKey: string): MutationResult {
  const from = parseNote(lick.key);
  const to = parseNote(toKey);
  if (!from || !to) throw new Error(`Unknown key "${toKey}".`);
  let delta = pc(to.pc - from.pc);
  if (delta > 6) delta -= 12;
  const beats = cloneBeats(parseAlphaTexBody(lick.body, tsOf(lick)).beats);
  const warnings: string[] = [];
  const frets = beats.flatMap((b) => b.notes.filter((n) => n.kind === 'fretted').map((n) => n.fret));
  const fits = (d: number) => frets.every((f) => f + d >= 0 && f + d <= 22);
  const options = [delta, delta + 12, delta - 12].filter((d) => fits(d));
  if (options.length) {
    const d = options[0];
    for (const b of beats)
      for (const n of b.notes) {
        if (n.kind !== 'fretted') continue;
        if (/\bnh\b/.test(n.effects) && d !== 0) {
          n.effects = stripEffects(n.effects, [/\bnh\b/g]);
          if (!warnings.length) warnings.push('Natural harmonics only ring at fixed frets, so they became fretted notes.');
        }
        n.fret += d;
      }
    delta = d;
  } else {
    const newMidi = new Map<TexNote, number>();
    const near = new Map<TexNote, Position>();
    for (const s of sounding(beats)) {
      newMidi.set(s.note, s.midi + delta);
      near.set(s.note, { string: s.note.string, fret: Math.max(0, s.note.fret + delta) });
    }
    refinger(beats, newMidi, near);
    warnings.push('The shape did not fit on the neck as-is, so some notes moved to other strings.');
  }
  const flats = prefersFlats(to);
  const dir = delta === 0 ? 'Same pitch' : `${delta > 0 ? 'Up' : 'Down'} ${Math.abs(delta)} fret${Math.abs(delta) === 1 ? '' : 's'}`;
  return finish(
    lick,
    beats,
    { key: to.name, chord: transposeChordText(lick.chord, pc(to.pc - from.pc), flats), suffix: `in ${to.name}`, idSuffix: `in-${to.name.replace('#', 's')}` },
    `${dir} to ${to.name}: the same shape and the same fingering, so your hands learn that a lick is a pattern you can move, not a fixed set of frets.`,
    warnings,
  );
}

function hasTuplets(beats: TexBeat[]) {
  return beats.some((b) => b.tuplet);
}

/** Re-times beats, splits any that cross a bar line into tied parts, and pads the last bar with rests. */
function rebar(beats: TexBeat[], barTicks: number): TexBeat[] {
  const out: TexBeat[] = [];
  let pos = 0;
  for (const b of beats) {
    const barEnd = (Math.floor(pos / barTicks) + 1) * barTicks;
    if (pos + b.ticks <= barEnd || b.ticks === 0) {
      out.push({ ...b, start: pos });
      pos += b.ticks;
      continue;
    }
    if (b.tuplet) throw new Error('A triplet would cross the bar line.');
    const firstLen = barEnd - pos;
    const parts = [...splitTicks(firstLen), ...splitTicks(b.ticks - firstLen)];
    parts.forEach((p, k) => {
      const notes = b.rest ? [] : b.notes.map((n) => (k === 0 ? { ...n } : { string: n.string, fret: 0, kind: n.kind === 'dead' ? ('dead' as const) : ('tie' as const), effects: '' }));
      out.push({ notes, rest: b.rest, duration: p.duration, tuplet: null, dotted: p.dotted, effects: k === 0 ? [...b.effects] : [], start: pos, ticks: p.ticks });
      pos += p.ticks;
    });
  }
  const remainder = pos % barTicks;
  if (remainder) {
    for (const p of splitTicks(barTicks - remainder)) {
      out.push({ notes: [], rest: true, duration: p.duration, tuplet: null, dotted: p.dotted, effects: [], start: pos, ticks: p.ticks });
      pos += p.ticks;
    }
  }
  return out;
}

function displace(lick: Lick): MutationResult {
  const ts = tsOf(lick);
  const parsed = parseAlphaTexBody(lick.body, ts);
  const warnings: string[] = [];
  const shift = hasTuplets(parsed.beats) ? TICKS_PER_QUARTER : TICKS_PER_QUARTER / 2;
  if (shift === TICKS_PER_QUARTER) warnings.push('This lick uses triplets, so it moves by a whole beat to keep each triplet on the beat.');
  let beats = cloneBeats(parsed.beats);
  // Use up trailing rest first so the lick keeps its length where possible.
  let toTrim = shift;
  while (toTrim > 0 && beats.length && beats[beats.length - 1].rest && !beats[beats.length - 1].tuplet) {
    const last = beats.pop()!;
    if (last.ticks > toTrim) {
      for (const part of splitTicks(last.ticks - toTrim)) beats.push({ ...last, duration: part.duration, dotted: part.dotted, ticks: part.ticks, effects: [] });
      toTrim = 0;
    } else toTrim -= last.ticks;
  }
  const lead: TexBeat[] = splitTicks(shift).map((p) => ({ notes: [], rest: true, duration: p.duration, tuplet: null, dotted: p.dotted, effects: [], start: 0, ticks: p.ticks }));
  beats = [...lead, ...beats];
  const out = rebar(beats, parsed.barTicks);
  const amount = shift === TICKS_PER_QUARTER ? 'a beat' : 'an eighth note';
  return finish(
    lick,
    out,
    { suffix: shift === TICKS_PER_QUARTER ? 'a beat later' : 'an eighth later', idSuffix: 'displaced' },
    `Starts ${amount} later, so notes that landed on the beat now land between beats. Same notes, completely new feel: this is how players stop every phrase from starting on beat 1.`,
    warnings,
  );
}

function scaleLadder(lick: Lick) {
  const root = parseNote(lick.key)!;
  const def = findScale(lick.scale);
  if (!def) throw new Error(`Unknown scale "${lick.scale}".`);
  const rels = new Set(def.degrees.map((d) => pc(degreeSemitones(d))));
  const ladder: number[] = [];
  for (let m = 24; m <= 108; m++) if (rels.has(pc(m - root.pc))) ladder.push(m);
  return { root, ladder };
}

function ladderPos(ladder: number[], midi: number) {
  let i = ladder.findIndex((m) => m >= midi);
  if (i < 0) i = ladder.length - 1;
  if (ladder[i] === midi) return { index: i, offset: 0 };
  return { index: i - 1, offset: midi - ladder[i - 1] }; // chromatic note: above the lower neighbour
}

function flip(lick: Lick): MutationResult {
  const beats = cloneBeats(parseAlphaTexBody(lick.body, tsOf(lick)).beats);
  const { root, ladder } = scaleLadder(lick);
  const notes = sounding(beats);
  if (notes.length < 2) throw new Error('A lick needs at least two notes to flip.');
  const pivot = ladderPos(ladder, notes[0].midi).index;
  const warnings: string[] = [];
  const newMidi = new Map<TexNote, number>();
  const near = new Map<TexNote, Position>();
  let removed = false;
  const mirror = (midi: number) => {
    const { index, offset } = ladderPos(ladder, midi);
    return ladder[Math.max(0, Math.min(ladder.length - 1, 2 * pivot - index))] - offset;
  };
  beats.forEach((b, bi) => {
    const here = notes.filter((s) => s.beat === bi);
    if (!here.length) return;
    if (here.length >= 2) {
      // Chords and double stops move in parallel with their top note, so the shape stays playable.
      const top = here.reduce((a, s) => (s.midi > a.midi ? s : a));
      const delta = mirror(top.midi) - top.midi;
      for (const s of here) newMidi.set(s.note, s.midi + delta);
    } else newMidi.set(here[0].note, mirror(here[0].midi));
    for (const s of here) {
      near.set(s.note, { string: s.note.string, fret: s.note.fret });
      const before = s.note.effects;
      s.note.effects = stripEffects(before, [...MOTION_FX, /\bnh\b/g, /\bph\b/g]);
      if (before !== s.note.effects) removed = true;
    }
  });
  // Keep the result on the neck: move it by octaves if needed.
  const lowest = Math.min(...newMidi.values());
  const highest = Math.max(...newMidi.values());
  let octave = 0;
  if (lowest < STANDARD[0]) octave = 12 * Math.ceil((STANDARD[0] - lowest) / 12);
  else if (highest > STANDARD[STANDARD.length - 1] + 22) octave = -12 * Math.ceil((highest - STANDARD[STANDARD.length - 1] - 22) / 12);
  if (octave) for (const [k, v] of newMidi) newMidi.set(k, v + octave);
  refinger(beats, newMidi, near);
  if (removed) warnings.push('Bends, slides, hammer-ons and harmonics were removed because the notes now move the other way; add your own.');
  const passing = new Set(lick.passing);
  for (const m of newMidi.values()) {
    const deg = semitoneToDegree(m - root.pc);
    if (!findScale(lick.scale)!.degrees.map((d) => pc(degreeSemitones(d))).includes(pc(m - root.pc))) passing.add(deg);
  }
  const first = pcName(notes[0].midi, prefersFlats(root));
  return finish(
    lick,
    beats,
    { suffix: 'flipped', idSuffix: 'flipped', passing: [...passing] },
    `Mirrored around its first note (${first}): where the original climbs, this falls, step for step in ${lick.key} ${findScale(lick.scale)!.name}. Same rhythm, new melody you already half know.`,
    warnings,
  );
}

function retarget(lick: Lick, chordSymbol: string): MutationResult {
  const chord = parseChord(chordSymbol);
  const beats = cloneBeats(parseAlphaTexBody(lick.body, tsOf(lick)).beats);
  const root = parseNote(lick.key)!;
  let lastIdx = -1;
  beats.forEach((b, i) => b.notes.some((n) => n.kind === 'fretted') && (lastIdx = i));
  if (lastIdx < 0) throw new Error('This lick has no notes to retarget.');
  const last = beats[lastIdx];
  const top = last.notes.filter((n) => n.kind === 'fretted').reduce((a, n) => (openMidi(n.string) + n.fret > openMidi(a.string) + a.fret ? n : a));
  const fromMidi = openMidi(top.string) + top.fret;
  const thirdRel = chord.third ? (chord.third === '3' ? 4 : 3) : 0;
  const targetPc = pc(chord.root.pc + thirdRel);
  let best = fromMidi;
  let bestDist = 99;
  for (let m = fromMidi - 7; m <= fromMidi + 7; m++) {
    if (pc(m) !== targetPc) continue;
    const d = Math.abs(m - fromMidi);
    if (d < bestDist || (d === bestDist && m < best)) {
      best = m;
      bestDist = d;
    }
  }
  // The new last note: one note, keeping the rhythm; vibrato stays, bends go.
  const keepVib = /\bv\b/.test(top.effects) ? 'v' : '';
  const prevPos = (() => {
    for (let i = lastIdx - 1; i >= 0; i--) {
      const n = beats[i].notes.find((x) => x.kind === 'fretted');
      if (n) return { string: n.string, fret: n.fret };
    }
    return { string: top.string, fret: top.fret };
  })();
  const pos = assignFingering([[openMidi(prevPos.string) + prevPos.fret], [best]], { near: [prevPos, null] })[1][0];
  last.notes = [{ string: pos.string, fret: pos.fret, kind: 'fretted', effects: keepVib }];
  // Ties after the last note would now point at the wrong string; drop trailing ties.
  for (let i = lastIdx + 1; i < beats.length; i++) if (beats[i].notes.some((n) => n.kind === 'tie')) beats[i] = { ...beats[i], notes: [], rest: true };
  const deg = semitoneToDegree(best - root.pc);
  const inScale = findScale(lick.scale)!.degrees.map((d) => pc(degreeSemitones(d))).includes(pc(best - root.pc));
  const name = pcName(best, prefersFlats(chord.root));
  const what = chord.third ? `the ${chord.third === '3' ? 'major' : 'minor'} 3rd of ${chordSymbol}` : `the root of ${chordSymbol}`;
  return finish(
    lick,
    beats,
    { suffix: `ends on ${name}`, idSuffix: `to-${chordSymbol.replace(/[#/]/g, 's')}`, chord: `${lick.chord} → ${chordSymbol}`, passing: inScale ? lick.passing : [...lick.passing, deg] },
    `The last note now lands on ${name}, ${what}, so the phrase leads into the chord change instead of just ending in the scale.${inScale ? '' : ` ${name} is outside ${lick.key} ${lick.scale}: that is the point, it spells the new chord.`}`,
    [],
  );
}

function reverse(lick: Lick): MutationResult {
  const ts = tsOf(lick);
  const parsed = parseAlphaTexBody(lick.body, ts);
  const warnings: string[] = [];
  let beats = cloneBeats(parsed.beats);
  // Ties cannot come before the note they hold, so turn them into re-picked notes first.
  const lastFret = new Map<number, number>();
  let hadTies = false;
  for (const b of beats) {
    for (const n of b.notes) {
      if (n.kind === 'tie') {
        n.kind = 'fretted';
        n.fret = lastFret.get(n.string) ?? 0;
        hadTies = true;
      }
      if (n.kind === 'fretted') lastFret.set(n.string, n.fret);
    }
  }
  if (hadTies) warnings.push('Held (tied) notes are re-picked in the reversed version.');
  let removed = false;
  for (const b of beats)
    for (const n of b.notes) {
      const before = n.effects;
      n.effects = stripEffects(n.effects, MOTION_FX);
      if (before !== n.effects) removed = true;
    }
  if (removed) warnings.push('Bends, slides and hammer-ons were removed because they only work in the original direction.');
  // Reverse bar by bar so triplet groups stay inside their beats.
  const triplets = hasTuplets(beats);
  if (triplets) {
    const groups: TexBeat[][] = [];
    let cur: TexBeat[] = [];
    let acc = 0;
    for (const b of beats) {
      cur.push(b);
      acc += b.ticks;
      if (acc % TICKS_PER_QUARTER === 0) {
        groups.push(cur);
        cur = [];
      }
    }
    if (cur.length) groups.push(cur);
    beats = groups.reverse().flatMap((g) => g.reverse());
  } else beats = beats.reverse();
  // Leading rests (from the original ending) move to the end so the phrase starts at once.
  const lead: TexBeat[] = [];
  while (beats.length && beats[0].rest) lead.push(beats.shift()!);
  const leadTicks = lead.reduce((a, b) => a + b.ticks, 0);
  if (triplets && leadTicks % TICKS_PER_QUARTER !== 0) beats = [...lead, ...beats];
  else beats = [...beats, ...lead];
  beats = rebar(beats, parsed.barTicks);
  return finish(lick, beats, { suffix: 'backwards', idSuffix: 'reversed' }, 'Played backwards: the same notes in the opposite order. A quick way to find new phrases hiding inside a lick you already know.', warnings);
}

export function mutateLick(lick: Lick, m: Mutation): MutationResult {
  switch (m.op) {
    case 'transpose':
      return transpose(lick, m.toKey);
    case 'displace':
      return displace(lick);
    case 'flip':
      return flip(lick);
    case 'retarget':
      return retarget(lick, m.chord);
    case 'reverse':
      return reverse(lick);
  }
}

export const MUTATIONS: { op: Mutation['op']; label: string; description: string }[] = [
  { op: 'transpose', label: 'New key', description: 'Same shape in another key' },
  { op: 'displace', label: 'Shift by an eighth', description: 'Start an eighth note later' },
  { op: 'flip', label: 'Flip contour', description: 'Mirror the melody: up becomes down' },
  { op: 'retarget', label: 'End on the 3rd', description: 'Land on the next chord’s 3rd' },
  { op: 'reverse', label: 'Backwards', description: 'Same notes, opposite order' },
];

export { NAMES as MUTATION_NAMES };
