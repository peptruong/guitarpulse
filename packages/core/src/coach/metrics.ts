/**
 * Deterministic improvisation metrics. Everything here is computed in code so the numbers are
 * reproducible and free; an LLM only turns them into words.
 */

export interface NoteEvent {
  midi: number;
  cents?: number;
  onsetBeat: number;
  durationBeats: number;
  peakBendCents?: number;
}

export interface TimedChord {
  startBeat: number;
  endBeat: number;
  rootPc: number;
  /** Chord tones relative to the root (0-11). */
  tones: number[];
  /** The scale suggested for this chord, relative to the root (0-11). */
  scale: number[];
  symbol: string;
}

const pcOf = (m: number) => ((m % 12) + 12) % 12;
const r2 = (x: number) => Math.round(x * 100) / 100;
const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);

export function computeMetrics(rawNotes: NoteEvent[], chords: TimedChord[], bpm: number, totalBeats: number) {
  if (!chords.length) throw new Error('At least one chord is needed to measure an improvisation.');
  const notes = [...rawNotes].sort((a, b) => a.onsetBeat - b.onsetBeat);
  const sortedChords = [...chords].sort((a, b) => a.startBeat - b.startBeat);
  const chordAt = (b: number) => sortedChords.find((c) => b >= c.startBeat && b < c.endBeat) ?? (b < sortedChords[0].startBeat ? sortedChords[0] : sortedChords[sortedChords.length - 1]);
  const rel = (n: NoteEvent) => {
    const c = chordAt(n.onsetBeat);
    return { c, r: pcOf(n.midi - c.rootPc) };
  };
  const beatMs = 60000 / bpm;

  // Strong beats are beats 1 and 3 of each 4/4 bar (and the next bar's beat 1).
  const strong = notes.filter((n) => {
    const b = ((n.onsetBeat % 4) + 4) % 4;
    return [0, 2, 4].some((s) => Math.abs(b - s) * beatMs < 80);
  });
  const strongHits = strong.filter((n) => {
    const { c, r } = rel(n);
    return c.tones.includes(r);
  }).length;

  const inScale = notes.filter((n) => {
    const { c, r } = rel(n);
    return c.scale.includes(r) || c.tones.includes(r);
  });
  const outside = notes
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => {
      const { c, r } = rel(n);
      return !c.scale.includes(r) && !c.tones.includes(r);
    });
  const resolved = outside.filter(({ i }) => {
    const nx = notes[i + 1];
    if (!nx) return false;
    const { c, r } = rel(nx);
    return c.tones.includes(r) && Math.abs(nx.midi - notes[i].midi) <= 2 && nx.onsetBeat - notes[i].onsetBeat <= 1;
  }).length;

  // Phrases: a silence of more than 600 ms starts a new phrase.
  const phrases: NoteEvent[][] = [];
  let cur: NoteEvent[] = [];
  notes.forEach((n, i) => {
    const prev = notes[i - 1];
    if (prev && (n.onsetBeat - (prev.onsetBeat + prev.durationBeats)) * beatMs > 600) {
      phrases.push(cur);
      cur = [];
    }
    cur.push(n);
  });
  if (cur.length) phrases.push(cur);

  // Motifs: the same 3-step melodic shape (direction + size, capped) appearing more than once.
  const contour = (p: NoteEvent[]) => p.slice(1).map((n, i) => Math.sign(n.midi - p[i].midi) * Math.min(3, Math.abs(n.midi - p[i].midi)));
  const grams = new Map<string, number>();
  phrases.forEach((p) => {
    const c = contour(p);
    for (let i = 0; i + 3 <= c.length; i++) {
      const g = c.slice(i, i + 3).join(',');
      grams.set(g, (grams.get(g) ?? 0) + 1);
    }
  });

  // Rhythmic variety: entropy of the gaps between note starts, snapped to a 1/12-beat grid (covers 16ths and triplets).
  const iois = notes.slice(1).map((n, i) => Math.round((n.onsetBeat - notes[i].onsetBeat) * 12) / 12);
  const hist = new Map<number, number>();
  iois.forEach((x) => hist.set(x, (hist.get(x) ?? 0) + 1));
  const entropy = [...hist.values()].reduce((a, c) => {
    const p = c / Math.max(1, iois.length);
    return a - p * Math.log2(p);
  }, 0);

  // Timing: distance from the nearest 16th, in ms (positive = behind the beat).
  const dev = notes.map((n) => (n.onsetBeat * 4 - Math.round(n.onsetBeat * 4)) * (beatMs / 4));
  const mean = safeDiv(dev.reduce((a, b) => a + b, 0), dev.length);
  const sd = Math.sqrt(safeDiv(dev.reduce((a, b) => a + (b - mean) ** 2, 0), dev.length));

  const sounding = notes.reduce((a, n) => a + n.durationBeats, 0);
  const steps = notes.slice(1).filter((n, i) => Math.abs(n.midi - notes[i].midi) <= 2).length;
  const bends = notes.filter((n) => (n.peakBendCents ?? 0) > 50).map((n) => Math.abs((n.peakBendCents as number) - Math.round((n.peakBendCents as number) / 100) * 100));

  return {
    noteCount: notes.length,
    chordToneOnStrongBeats: r2(safeDiv(strongHits, strong.length)),
    scaleAdherence: r2(safeDiv(inScale.length, notes.length)),
    resolvedChromaticism: outside.length ? r2(resolved / outside.length) : 1,
    notesPerBar: r2(safeDiv(notes.length, totalBeats / 4)),
    restRatio: r2(Math.max(0, 1 - safeDiv(sounding, totalBeats))),
    rhythmicEntropyBits: r2(entropy),
    phraseCount: phrases.length,
    meanPhraseBars: r2(safeDiv(phrases.reduce((a, p) => a + (p[p.length - 1].onsetBeat + p[p.length - 1].durationBeats - p[0].onsetBeat) / 4, 0), phrases.length)),
    phraseEndsOnChordTone: r2(
      safeDiv(
        phrases.filter((p) => {
          const { c, r } = rel(p[p.length - 1]);
          return c.tones.includes(r);
        }).length,
        phrases.length,
      ),
    ),
    repeatedMotifs: [...grams.values()].filter((v) => v >= 2).length,
    rangeSemitones: notes.length ? Math.max(...notes.map((n) => n.midi)) - Math.min(...notes.map((n) => n.midi)) : 0,
    stepwiseRatio: r2(safeDiv(steps, notes.length - 1)),
    timingMeanMs: Math.round(mean),
    timingSdMs: Math.round(sd),
    bendCount: bends.length,
    bendAccuracyMeanCents: bends.length ? Math.round(bends.reduce((a, b) => a + b, 0) / bends.length) : null,
  };
}

export type ImprovMetrics = ReturnType<typeof computeMetrics>;

/** Targets used by the coach and the practice planner, keyed by metric name. */
export const METRIC_TARGETS: Record<string, { label: string; better: 'higher' | 'lower'; unit?: string }> = {
  scaleAdherence: { label: 'Notes inside the scale or chord', better: 'higher' },
  chordToneOnStrongBeats: { label: 'Chord tones on beats 1 and 3', better: 'higher' },
  resolvedChromaticism: { label: 'Outside notes that resolve within a beat', better: 'higher' },
  restRatio: { label: 'Share of time resting (space)', better: 'higher' },
  meanPhraseBars: { label: 'Average phrase length', better: 'higher', unit: 'bars' },
  phraseEndsOnChordTone: { label: 'Phrases ending on a chord tone', better: 'higher' },
  repeatedMotifs: { label: 'Repeated motifs', better: 'higher' },
  rangeSemitones: { label: 'Range used', better: 'higher', unit: 'semitones' },
  rhythmicEntropyBits: { label: 'Rhythmic variety', better: 'higher', unit: 'bits' },
  timingSdMs: { label: 'Timing spread', better: 'lower', unit: 'ms' },
  bendAccuracyMeanCents: { label: 'Bend pitch error', better: 'lower', unit: 'cents' },
};
