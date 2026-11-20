/**
 * Where on the neck notes were probably played.
 *
 * A microphone hears pitches, not strings: E4 can be the open high E, B string fret 5, G string
 * fret 9 and so on. This picks the most playable path through all candidates (Viterbi), favouring
 * small hand shifts and nearby strings, the way a player would. The heatmap and the box report
 * are built on top of it.
 */
import { getScale } from './theory/scales.js';
import { getTuning, parseNote, stringNumber } from './theory/notes.js';

export interface Position {
  /** 1 = highest-pitched string. */
  string: number;
  fret: number;
}

export interface FingeringOptions {
  tuning?: number[]; // lowest string first
  maxFret?: number;
  /** Preferred position for each group (e.g. the original fingering of a lick); null = no preference. */
  near?: (Position | null)[];
  /** Weight for staying near `near` positions. */
  nearWeight?: number;
}

export function candidatesFor(midi: number, tuning: number[], maxFret = 22): Position[] {
  const out: Position[] = [];
  tuning.forEach((open, idx) => {
    const fret = midi - open;
    if (fret >= 0 && fret <= maxFret) out.push({ string: stringNumber(idx, tuning.length), fret });
  });
  return out;
}

function chordStates(midis: number[], tuning: number[], maxFret: number): Position[][] {
  const lists = midis.map((m) => candidatesFor(m, tuning, maxFret));
  const out: Position[][] = [];
  const pick: Position[] = [];
  const rec = (k: number) => {
    if (out.length > 400) return;
    if (k === lists.length) {
      const fretted = pick.filter((p) => p.fret > 0).map((p) => p.fret);
      if (fretted.length && Math.max(...fretted) - Math.min(...fretted) > 4) return;
      out.push([...pick]);
      return;
    }
    for (const c of lists[k]) {
      if (pick.some((p) => p.string === c.string)) continue;
      pick.push(c);
      rec(k + 1);
      pick.pop();
    }
  };
  rec(0);
  return out;
}

/**
 * A state is a fingering for one group plus where the index finger sits (hand position).
 * A hand covers four frets, so notes inside the same box cost nothing to reach.
 */
interface HandState {
  pos: Position[];
  hand: number | null; // null = only open strings (the hand can stay where it was)
}

function handStates(pos: Position[]): HandState[] {
  const fretted = pos.filter((p) => p.fret > 0).map((p) => p.fret);
  if (!fretted.length) return [{ pos, hand: null }];
  const hi = Math.max(...fretted);
  const lo = Math.min(...fretted);
  const out: HandState[] = [];
  for (let h = Math.max(1, hi - 3); h <= lo; h++) out.push({ pos, hand: h });
  if (!out.length) out.push({ pos, hand: lo }); // a five-fret stretch: possible, but costs more (see emission)
  return out;
}

/**
 * Assigns a string and fret to every group of simultaneous notes (a group of one is a single note).
 * Returns positions in the same order as the input notes of each group.
 */
export function assignFingering(groups: number[][], opts: FingeringOptions = {}): Position[][] {
  const tuning = opts.tuning ?? getTuning('standard');
  const maxFret = opts.maxFret ?? 22;
  const nearW = opts.nearWeight ?? 0.5;
  if (!groups.length) return [];
  const states: HandState[][] = groups.map((g) => {
    const fingerings = g.length === 1 ? candidatesFor(g[0], tuning, maxFret).map((p) => [p]) : chordStates(g, tuning, maxFret);
    if (!fingerings.length) throw new Error(`Cannot play ${g.join('+')} in this tuning within fret ${maxFret}.`);
    return fingerings.flatMap(handStates);
  });
  const emission = (gi: number, st: HandState) => {
    let c = 0;
    for (const p of st.pos) {
      if (p.fret === 0) c += 0.35; // open strings are possible but less common when soloing
      else if (p.fret <= 2) c += 0.15;
      if (p.fret > 12) c += 0.03 * (p.fret - 12);
    }
    if (st.hand !== null) for (const p of st.pos) if (p.fret > 0 && p.fret - st.hand >= 3) c += p.fret - st.hand === 3 ? 0.05 : 0.6; // pinky stretch
    const near = opts.near?.[gi];
    if (near) {
      const top = st.pos[0];
      c += nearW * (Math.abs(top.fret - near.fret) * 0.5 + Math.abs(top.string - near.string));
    }
    return c;
  };
  const move = (from: number | null, to: number | null) => {
    if (from === null || to === null) return 0;
    const shift = Math.abs(to - from);
    return shift === 0 ? 0 : shift <= 2 ? 0.4 * shift : 0.6 + 0.5 * shift;
  };
  const stringJump = (a: HandState, b: HandState) => Math.max(0, Math.abs(a.pos[0].string - b.pos[0].string) - 1) * 0.3;

  let cost = states[0].map((s) => emission(0, s));
  let hands: (number | null)[] = states[0].map((s) => s.hand);
  const back: number[][] = [states[0].map(() => -1)];
  for (let g = 1; g < states.length; g++) {
    const nextCost: number[] = [];
    const nextBack: number[] = [];
    const nextHands: (number | null)[] = [];
    states[g].forEach((st) => {
      let best = Infinity;
      let arg = 0;
      states[g - 1].forEach((prev, j) => {
        const c = cost[j] + move(hands[j], st.hand) + stringJump(prev, st);
        if (c < best) {
          best = c;
          arg = j;
        }
      });
      nextCost.push(best + emission(g, st));
      nextBack.push(arg);
      nextHands.push(st.hand ?? hands[arg]);
    });
    cost = nextCost;
    hands = nextHands;
    back.push(nextBack);
  }
  let idx = cost.indexOf(Math.min(...cost));
  const path: Position[][] = [];
  for (let g = states.length - 1; g >= 0; g--) {
    path.unshift(states[g][idx].pos);
    idx = back[g][idx];
  }
  return path;
}

export interface HeatCell {
  string: number;
  fret: number;
  count: number;
  beats: number;
  /** 0-1, relative to the busiest cell. */
  weight: number;
}

export interface PlayedNote {
  midi: number;
  durationBeats?: number;
}

export function heatmap(notes: PlayedNote[], tuningId = 'standard'): { positions: Position[]; cells: HeatCell[] } {
  if (!notes.length) return { positions: [], cells: [] };
  const tuning = getTuning(tuningId);
  const playable = notes.filter((n) => candidatesFor(n.midi, tuning, 24).length > 0);
  const positions = assignFingering(playable.map((n) => [n.midi]), { tuning, maxFret: 24 }).map((s) => s[0]);
  const map = new Map<string, HeatCell>();
  positions.forEach((p, i) => {
    const key = `${p.string}:${p.fret}`;
    const cell = map.get(key) ?? { string: p.string, fret: p.fret, count: 0, beats: 0, weight: 0 };
    cell.count++;
    cell.beats += playable[i].durationBeats ?? 0.5;
    map.set(key, cell);
  });
  const cells = [...map.values()];
  const max = Math.max(...cells.map((c) => c.beats));
  for (const c of cells) c.weight = max ? Math.round((c.beats / max) * 100) / 100 : 0;
  return { positions, cells };
}

export interface BoxReport {
  boxes: { box: number; fromFret: number; toFret: number; share: number }[];
  boxesUsed: number;
  box1Share: number;
  lowestFret: number;
  highestFret: number;
  stringsUsed: number[];
  advice: string;
}

/** How the playing spread across the five pentatonic boxes of the key. */
export function boxReport(positions: Position[], key: string, minor = true): BoxReport {
  const root = parseNote(key);
  if (!root) throw new Error(`Unknown key "${key}".`);
  const scale = minor ? 'minor-pentatonic' : 'major-pentatonic';
  const boxes = [1, 2, 3, 4, 5].map((box) => {
    const shape = getScale({ root: root.name, scale, pattern: 'box', position: box });
    const cells = new Set<string>();
    for (const n of shape.fretboard) for (const shift of [-12, 0, 12]) if (n.fret + shift >= 0 && n.fret + shift <= 24) cells.add(`${n.string}:${n.fret + shift}`);
    const frets = shape.fretboard.map((n) => n.fret);
    return { box, cells, fromFret: Math.min(...frets), toFret: Math.max(...frets) };
  });
  // Give each note to one box, following the order the notes were played: choose the sequence
  // of boxes with the fewest box changes (Viterbi). Neighbouring boxes share frets, so looking at
  // single notes alone cannot tell box 2 from "box 1 plus box 3"; the sequence can.
  const keys = positions.map((p) => `${p.string}:${p.fret}`);
  const assigned = boxes.map(() => 0);
  if (keys.length) {
    const fits = (i: number, b: number) => (boxes[b].cells.has(keys[i]) ? 0 : boxes.some((x) => x.cells.has(keys[i])) ? Infinity : 0.5);
    let cost = boxes.map((_, b) => fits(0, b));
    const back: number[][] = [];
    for (let i = 1; i < keys.length; i++) {
      const next: number[] = [];
      const from: number[] = [];
      boxes.forEach((_, b) => {
        let best = Infinity;
        let arg = 0;
        cost.forEach((c, a) => {
          const v = c + (a === b ? 0 : 1);
          if (v < best) {
            best = v;
            arg = a;
          }
        });
        next.push(best + fits(i, b));
        from.push(arg);
      });
      back.push(from);
      cost = next;
    }
    let b = cost.indexOf(Math.min(...cost));
    for (let i = keys.length - 1; i >= 0; i--) {
      assigned[b]++;
      if (i > 0) b = back[i - 1][b];
    }
  }
  const total = positions.length || 1;
  const shares = assigned.map((c) => Math.round((c / total) * 100) / 100);
  const used = shares.filter((s) => s >= 0.1).length;
  const frets = positions.map((p) => p.fret);
  const strings = [...new Set(positions.map((p) => p.string))].sort((a, b) => a - b);
  let advice: string;
  if (!positions.length) advice = 'No notes yet.';
  else if (shares[0] >= 0.7) advice = `Most notes (${Math.round(shares[0] * 100)}%) were in box 1. Next time, slide up into box 2 for one phrase in every four.`;
  else if (used <= 2) advice = 'You used two boxes or fewer. Connect them: play the same lick in the next box up, then link the two with a slide.';
  else if (strings.length <= 3) advice = `You only used strings ${strings.join(', ')}. Add a phrase on the lower strings for contrast.`;
  else advice = 'Good spread across the neck. Keep linking positions with slides so the moves sound musical.';
  return {
    boxes: boxes.map((b, i) => ({ box: b.box, fromFret: b.fromFret, toFret: b.toFret, share: shares[i] })),
    boxesUsed: used,
    box1Share: shares[0],
    lowestFret: frets.length ? Math.min(...frets) : 0,
    highestFret: frets.length ? Math.max(...frets) : 0,
    stringsUsed: strings,
    advice,
  };
}

