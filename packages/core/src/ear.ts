/**
 * Pocket ear trainer: five-minute interval and chord-quality drills with spaced repetition.
 * Each item sits in a Leitner box (1-5). Right answers move it up and push its next review out
 * (same day, 1, 3, 7, 14 days); a wrong answer sends it back to box 1 and brings it back within
 * the session. New items unlock when the current set is solid.
 */

export type EarKind = 'interval' | 'chord';
export type EarMode = EarKind | 'mixed';

export interface EarItem {
  id: string;
  kind: EarKind;
  label: string;
  short: string;
  /** Semitones above the root (intervals: [0, n]; chords: all tones). */
  tones: number[];
}

export const INTERVALS: EarItem[] = [
  ['m2', 'Minor 2nd', 1],
  ['M2', 'Major 2nd', 2],
  ['m3', 'Minor 3rd', 3],
  ['M3', 'Major 3rd', 4],
  ['P4', 'Perfect 4th', 5],
  ['TT', 'Tritone', 6],
  ['P5', 'Perfect 5th', 7],
  ['m6', 'Minor 6th', 8],
  ['M6', 'Major 6th', 9],
  ['m7', 'Minor 7th', 10],
  ['M7', 'Major 7th', 11],
  ['P8', 'Octave', 12],
].map(([short, label, n]) => ({ id: `int-${short}`, kind: 'interval' as const, label: label as string, short: short as string, tones: [0, n as number] }));

export const CHORDS: EarItem[] = [
  ['maj', 'Major', [0, 4, 7]],
  ['min', 'Minor', [0, 3, 7]],
  ['dim', 'Diminished', [0, 3, 6]],
  ['aug', 'Augmented', [0, 4, 8]],
  ['sus4', 'Sus4', [0, 5, 7]],
  ['7', 'Dominant 7', [0, 4, 7, 10]],
  ['maj7', 'Major 7', [0, 4, 7, 11]],
  ['m7', 'Minor 7', [0, 3, 7, 10]],
  ['m7b5', 'Half-diminished', [0, 3, 6, 10]],
].map(([short, label, tones]) => ({ id: `chord-${short}`, kind: 'chord' as const, label: label as string, short: short as string, tones: tones as number[] }));

export const ALL_ITEMS = [...INTERVALS, ...CHORDS];
const byId = new Map(ALL_ITEMS.map((i) => [i.id, i]));

/** Unlock order: easy, contrasting sounds first. */
export const LEVELS: Record<EarKind, string[][]> = {
  interval: [['int-P5', 'int-M3', 'int-m3', 'int-P8'], ['int-P4', 'int-M2', 'int-m2'], ['int-M6', 'int-m6', 'int-m7', 'int-M7'], ['int-TT']],
  chord: [['chord-maj', 'chord-min'], ['chord-dim', 'chord-aug', 'chord-sus4'], ['chord-7', 'chord-maj7', 'chord-m7'], ['chord-m7b5']],
};

const DAY = 86_400_000;
/** Next review after a correct answer, by the box the item moves into. */
export const BOX_INTERVAL = [0, 0, DAY, 3 * DAY, 7 * DAY, 14 * DAY];

export interface ItemStat {
  box: number;
  due: number;
  correct: number;
  attempts: number;
}

export interface EarState {
  items: Record<string, ItemStat>;
  unlocked: Record<EarKind, number>;
  sessions: number;
}

export function initialEarState(): EarState {
  return { items: {}, unlocked: { interval: 1, chord: 1 }, sessions: 0 };
}

export function unlockedItems(state: EarState, kind: EarKind): EarItem[] {
  return LEVELS[kind].slice(0, state.unlocked[kind]).flat().map((id) => byId.get(id)!);
}

export interface Question {
  item: EarItem;
  /** Every option shown to the learner (unlocked items of the same kind). */
  choices: EarItem[];
  rootMidi: number;
  midis: number[];
  style: 'ascending' | 'descending' | 'harmonic' | 'block';
}

export function stat(state: EarState, id: string): ItemStat {
  return state.items[id] ?? { box: 1, due: 0, correct: 0, attempts: 0 };
}

/** Picks the next question: overdue items first, then lower boxes more often; never the same item twice in a row. */
export function nextQuestion(state: EarState, mode: EarMode, rand: () => number, now: number, lastId?: string): Question {
  const kinds: EarKind[] = mode === 'mixed' ? ['interval', 'chord'] : [mode];
  const pool = kinds.flatMap((k) => unlockedItems(state, k));
  const candidates = pool.length > 1 ? pool.filter((i) => i.id !== lastId) : pool;
  const due = candidates.filter((i) => stat(state, i.id).due <= now && stat(state, i.id).attempts > 0 && stat(state, i.id).box <= 2);
  let item: EarItem;
  if (due.length && rand() < 0.6) item = due[Math.floor(rand() * due.length)];
  else {
    const weights = candidates.map((i) => 6 - stat(state, i.id).box);
    let r = rand() * weights.reduce((a, b) => a + b, 0);
    item = candidates[candidates.length - 1];
    for (let k = 0; k < candidates.length; k++) {
      r -= weights[k];
      if (r <= 0) {
        item = candidates[k];
        break;
      }
    }
  }
  const rootMidi = 48 + Math.floor(rand() * 12); // C3..B3
  const styles: Question['style'][] = item.kind === 'interval' ? ['ascending', 'descending', 'harmonic'] : ['block', 'ascending'];
  const style = styles[Math.floor(rand() * styles.length)];
  const midis = item.tones.map((t) => rootMidi + t);
  return { item, choices: unlockedItems(state, item.kind), rootMidi, midis: style === 'descending' ? [...midis].reverse() : midis, style };
}

export function answerQuestion(state: EarState, q: Question, choiceId: string, now: number): { state: EarState; correct: boolean; unlockedNew: boolean } {
  const correct = choiceId === q.item.id;
  const s = stat(state, q.item.id);
  const box = correct ? Math.min(5, s.box + (s.attempts === 0 ? 0 : 1)) : 1;
  const next: ItemStat = {
    box: correct && s.attempts === 0 ? 2 : box,
    due: correct ? now + BOX_INTERVAL[correct && s.attempts === 0 ? 2 : box] : now + 20_000,
    correct: s.correct + (correct ? 1 : 0),
    attempts: s.attempts + 1,
  };
  const items = { ...state.items, [q.item.id]: next };
  let unlocked = state.unlocked;
  let unlockedNew = false;
  const kind = q.item.kind;
  const levelIds = LEVELS[kind][state.unlocked[kind] - 1];
  const solid = levelIds.every((id) => {
    const st = items[id];
    return st && st.attempts >= 3 && st.correct / st.attempts >= 0.8 && st.box >= 2;
  });
  if (solid && state.unlocked[kind] < LEVELS[kind].length) {
    unlocked = { ...state.unlocked, [kind]: state.unlocked[kind] + 1 };
    unlockedNew = true;
  }
  return { state: { ...state, items, unlocked }, correct, unlockedNew };
}

export interface EarSummary {
  answered: number;
  correct: number;
  accuracy: number;
  hardest: { label: string; accuracy: number }[];
  unlocked: string[];
}

/** A timed session (five minutes by default). The clock is injected so it can be tested. */
export class EarSession {
  state: EarState;
  readonly startedAt: number;
  private rand: () => number;
  private last?: string;
  private answered = 0;
  private right = 0;
  private perItem = new Map<string, { c: number; a: number }>();
  private newlyUnlocked: string[] = [];
  current: Question | null = null;

  constructor(
    state: EarState,
    public mode: EarMode,
    private clock: () => number,
    rand: () => number,
    public durationMs = 5 * 60_000,
  ) {
    this.state = state;
    this.rand = rand;
    this.startedAt = clock();
  }

  get timeLeftMs() {
    return Math.max(0, this.durationMs - (this.clock() - this.startedAt));
  }
  get done() {
    return this.timeLeftMs === 0;
  }

  next(): Question | null {
    if (this.done) return (this.current = null);
    this.current = nextQuestion(this.state, this.mode, this.rand, this.clock(), this.last);
    this.last = this.current.item.id;
    return this.current;
  }

  answer(choiceId: string) {
    if (!this.current) throw new Error('No question to answer.');
    const q = this.current;
    const r = answerQuestion(this.state, q, choiceId, this.clock());
    this.state = r.state;
    this.answered++;
    if (r.correct) this.right++;
    const p = this.perItem.get(q.item.id) ?? { c: 0, a: 0 };
    this.perItem.set(q.item.id, { c: p.c + (r.correct ? 1 : 0), a: p.a + 1 });
    if (r.unlockedNew) {
      const lvl = LEVELS[q.item.kind][this.state.unlocked[q.item.kind] - 1];
      this.newlyUnlocked.push(...lvl.map((id) => byId.get(id)!.label));
    }
    return { correct: r.correct, answer: q.item, unlockedNew: r.unlockedNew };
  }

  summary(): EarSummary {
    const hardest = [...this.perItem.entries()]
      .map(([id, v]) => ({ label: byId.get(id)!.label, accuracy: v.c / v.a }))
      .filter((x) => x.accuracy < 1)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 3);
    return { answered: this.answered, correct: this.right, accuracy: this.answered ? Math.round((this.right / this.answered) * 100) / 100 : 0, hardest, unlocked: this.newlyUnlocked };
  }

  finish(): EarState {
    this.state = { ...this.state, sessions: this.state.sessions + 1 };
    return this.state;
  }
}
