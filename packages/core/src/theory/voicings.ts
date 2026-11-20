import { fourVoiceCore, parseChord, shellCore, triadCore, degreeIn, type ParsedChord } from './chords.js';
import { getTuning, pc, spellDegree, stringNumber, TUNINGS } from './notes.js';

export type VoicingSystem = 'caged' | 'triad' | 'shell' | 'drop2' | 'drop3';
export const VOICING_SYSTEMS: VoicingSystem[] = ['caged', 'triad', 'shell', 'drop2', 'drop3'];

export interface Voicing {
  system: VoicingSystem;
  label: string;
  /** Lowest string first, like a chord chart: null = muted, 0 = open. */
  frets: (number | null)[];
  /** Suggested fretting fingers, lowest string first: 0 = open, 1-4 = index..pinky, null = muted. */
  fingers: (number | null)[];
  /** Short chart text, e.g. "x32010" (frets above 9 shown in parentheses). */
  chart: string;
  baseFret: number;
  strings: number[]; // sounding strings, guitarist numbering (1 = highest)
  notes: string[]; // lowest to highest
  degrees: string[]; // lowest to highest
  bass: string;
  inversion: 'root position' | '1st inversion' | '2nd inversion' | '3rd inversion' | 'rootless';
  barre?: { fret: number; fromString: number; toString: number };
}

export interface VoicingQuery {
  chord: string;
  systems?: VoicingSystem[];
  tuning?: string;
  maxFret?: number;
  limitPerSystem?: number;
}

interface Raw {
  frets: (number | null)[];
  system: VoicingSystem;
  label: string;
}

/** Depth-first search for fret combinations on a fixed set of strings. */
function search(
  tuning: number[],
  stringIdx: number[],
  allowed: number[], // absolute pitch classes
  required: number[],
  opts: { maxSpan: number; maxFret: number; distinct: boolean },
): (number | null)[][] {
  const results: (number | null)[][] = [];
  const pick: number[] = [];
  const rec = (k: number) => {
    if (k === stringIdx.length) {
      const pcs = pick.map((f, i) => pc(tuning[stringIdx[i]] + f));
      if (!required.every((r) => pcs.includes(r))) return;
      if (opts.distinct && new Set(pcs).size !== pcs.length) return;
      const pitches = pick.map((f, i) => tuning[stringIdx[i]] + f);
      for (let i = 1; i < pitches.length; i++) if (pitches[i] <= pitches[i - 1]) return; // voices must ascend
      const frets: (number | null)[] = tuning.map(() => null);
      stringIdx.forEach((s, i) => (frets[s] = pick[i]));
      results.push(frets);
      return;
    }
    for (let f = 0; f <= opts.maxFret; f++) {
      if (!allowed.includes(pc(tuning[stringIdx[k]] + f))) continue;
      const fretted = [...pick, f].filter((x) => x > 0);
      if (fretted.length && Math.max(...fretted) - Math.min(...fretted) > opts.maxSpan) continue;
      pick.push(f);
      rec(k + 1);
      pick.pop();
    }
  };
  rec(0);
  return results;
}

const adjacentSets = (n: number, size: number) => Array.from({ length: n - size + 1 }, (_, i) => Array.from({ length: size }, (_, k) => i + k));

function stringSetLabel(set: number[], n: number) {
  return set.map((i) => stringNumber(i, n)).sort((a, b) => b - a).join('-');
}

/**
 * Classic CAGED templates (offsets from the root fret on the root string, lowest string first,
 * null = muted). Only valid for six-string standard tuning; every template is checked against
 * the chord before it is returned, so a template that does not fit a chord is simply skipped.
 */
const CAGED: Record<string, { shape: string; rootString: number; offsets: (number | null)[] }[]> = {
  maj: [
    { shape: 'C', rootString: 1, offsets: [null, 0, -1, -3, -2, -3] },
    { shape: 'A', rootString: 1, offsets: [null, 0, 2, 2, 2, 0] },
    { shape: 'G', rootString: 0, offsets: [0, -1, -3, -3, -3, 0] },
    { shape: 'E', rootString: 0, offsets: [0, 2, 2, 1, 0, 0] },
    { shape: 'D', rootString: 2, offsets: [null, null, 0, 2, 3, 2] },
  ],
  min: [
    { shape: 'C', rootString: 1, offsets: [null, 0, -2, -3, -2, null] },
    { shape: 'A', rootString: 1, offsets: [null, 0, 2, 2, 1, 0] },
    { shape: 'G', rootString: 0, offsets: [0, -2, -3, -3, 0, 0] },
    { shape: 'E', rootString: 0, offsets: [0, 2, 2, 0, 0, 0] },
    { shape: 'D', rootString: 2, offsets: [null, null, 0, 2, 3, 1] },
  ],
  dom: [
    { shape: 'C', rootString: 1, offsets: [null, 0, -1, 0, -2, null] },
    { shape: 'A', rootString: 1, offsets: [null, 0, 2, 0, 2, 0] },
    { shape: 'G', rootString: 0, offsets: [0, -1, -3, -3, -3, -2] },
    { shape: 'E', rootString: 0, offsets: [0, 2, 0, 1, 0, 0] },
    { shape: 'D', rootString: 2, offsets: [null, null, 0, 2, 1, 2] },
  ],
  min7: [
    { shape: 'A', rootString: 1, offsets: [null, 0, 2, 0, 1, 0] },
    { shape: 'E', rootString: 0, offsets: [0, 2, 0, 0, 0, 0] },
    { shape: 'D', rootString: 2, offsets: [null, null, 0, 2, 1, 1] },
  ],
  maj7: [
    { shape: 'C', rootString: 1, offsets: [null, 0, -1, -3, -3, -3] },
    { shape: 'A', rootString: 1, offsets: [null, 0, 2, 1, 2, 0] },
    { shape: 'E', rootString: 0, offsets: [0, null, 1, 1, 0, null] },
    { shape: 'D', rootString: 2, offsets: [null, null, 0, 2, 2, 2] },
  ],
};

function cagedFamily(chord: ParsedChord): keyof typeof CAGED | null {
  const sig = [...chord.relPcs].sort((a, b) => a - b).join(',');
  if (sig === '0,4,7') return 'maj';
  if (sig === '0,3,7') return 'min';
  if (sig === '0,4,7,10') return 'dom';
  if (sig === '0,3,7,10') return 'min7';
  if (sig === '0,4,7,11') return 'maj7';
  return null;
}

function cagedVoicings(chord: ParsedChord, tuning: number[], maxFret: number): Raw[] {
  const fam = cagedFamily(chord);
  if (!fam || tuning.join(',') !== TUNINGS.standard.midi.join(',')) return [];
  const out: Raw[] = [];
  for (const t of CAGED[fam]) {
    let r = pc(chord.root.pc - tuning[t.rootString]);
    const minOffset = Math.min(...t.offsets.filter((o): o is number => o !== null));
    if (r + minOffset < 0) r += 12;
    const frets = t.offsets.map((o) => (o === null ? null : r + o));
    if (frets.some((f) => f !== null && (f < 0 || f > maxFret))) continue;
    const sounding = frets.map((f, i) => (f === null ? null : pc(tuning[i] + f))).filter((p): p is number => p !== null);
    if (!sounding.every((p) => chord.pcs.includes(p))) continue;
    if (!chord.pcs.every((p) => sounding.includes(p))) continue;
    out.push({ frets, system: 'caged', label: `${t.shape}-shape` });
  }
  return out;
}

function isCloseAfterRaisingBass(pitches: number[], landsAt: number) {
  const raised = [pitches[0] + 12, ...pitches.slice(1)].sort((a, b) => a - b);
  return raised[raised.length - 1] - raised[0] < 12 && raised.indexOf(pitches[0] + 12) === landsAt;
}

function generate(chord: ParsedChord, system: VoicingSystem, tuning: number[], maxFret: number): Raw[] {
  const n = tuning.length;
  const abs = (rels: number[]) => rels.map((r) => pc(chord.root.pc + r));
  switch (system) {
    case 'caged':
      return cagedVoicings(chord, tuning, maxFret);
    case 'triad': {
      const core = abs(triadCore(chord));
      if (core.length < 3) return [];
      return adjacentSets(n, 3).flatMap((set) =>
        search(tuning, set, core, core, { maxSpan: 4, maxFret, distinct: true }).map((frets) => ({
          frets,
          system,
          label: `triad on strings ${stringSetLabel(set, n)}`,
        })),
      );
    }
    case 'shell': {
      const rel = shellCore(chord);
      if (!rel) return [];
      const core = abs(rel);
      const sets = [[0, 2, 3], [1, 2, 3]].filter((s) => s[2] < n);
      return sets.flatMap((set) =>
        search(tuning, set, core, core, { maxSpan: 4, maxFret, distinct: true })
          .filter((frets) => pc(tuning[set[0]] + (frets[set[0]] as number)) === chord.root.pc)
          .map((frets) => ({ frets, system, label: `shell, root on string ${stringNumber(set[0], n)}` })),
      );
    }
    case 'drop2':
    case 'drop3': {
      const four = fourVoiceCore(chord);
      if (!four) return [];
      const core = abs(four.rel);
      const sets = system === 'drop2' ? adjacentSets(n, 4) : Array.from({ length: n - 4 }, (_, i) => [i, i + 2, i + 3, i + 4]);
      return sets.flatMap((set) =>
        search(tuning, set, core, core, { maxSpan: 5, maxFret, distinct: true })
          .filter((frets) => {
            const pitches = set.map((s) => tuning[s] + (frets[s] as number));
            return isCloseAfterRaisingBass(pitches, system === 'drop2' ? 2 : 1);
          })
          .map((frets) => ({
            frets,
            system,
            label: `${system === 'drop2' ? 'drop-2' : 'drop-3'} on strings ${stringSetLabel(set, n)}${four.rootless ? ' (rootless)' : ''}`,
          })),
      );
    }
  }
}

/** Simple, readable fingering: lowest fretted note = finger 1, then one finger per fret; 3+ notes on the lowest fret = barre. */
function fingering(frets: (number | null)[], tuning: number[]): { fingers: (number | null)[]; barre?: Voicing['barre'] } {
  const fretted = frets.filter((f): f is number => f !== null && f > 0);
  if (!fretted.length) return { fingers: frets.map((f) => (f === null ? null : 0)) };
  const min = Math.min(...fretted);
  const atMin = frets.map((f, i) => (f === min ? i : -1)).filter((i) => i >= 0);
  const barre = atMin.length >= 3 ? { fret: min, fromString: stringNumber(atMin[0], tuning.length), toString: stringNumber(atMin[atMin.length - 1], tuning.length) } : undefined;
  const fingers = frets.map((f) => (f === null ? null : f === 0 ? 0 : Math.min(4, f - min + 1)));
  return { fingers, barre };
}

function chartText(frets: (number | null)[]) {
  return frets.map((f) => (f === null ? 'x' : f > 9 ? `(${f})` : String(f))).join('');
}

const INVERSIONS: Voicing['inversion'][] = ['root position', '1st inversion', '2nd inversion', '3rd inversion'];

function describe(raw: Raw, chord: ParsedChord, tuning: number[]): Voicing {
  const n = tuning.length;
  const sounding = raw.frets.map((f, i) => (f === null ? null : { i, midi: tuning[i] + f })).filter((x): x is { i: number; midi: number } => x !== null);
  const degrees = sounding.map((s) => degreeIn(chord, pc(s.midi)));
  const notes = degrees.map((d) => spellDegree(chord.root, d));
  const bassDeg = degrees[0];
  const bassRel = pc(sounding[0].midi - chord.root.pc);
  let inversion: Voicing['inversion'];
  if (!degrees.includes('1')) inversion = 'rootless';
  else if (bassRel === 0) inversion = INVERSIONS[0];
  else if ([2, 3, 4, 5].includes(bassRel)) inversion = INVERSIONS[1]; // 3rd (or sus note) in the bass
  else if ([6, 7, 8].includes(bassRel)) inversion = INVERSIONS[2]; // 5th in the bass
  else inversion = INVERSIONS[3]; // 7th (or 6th) in the bass
  const { fingers, barre } = fingering(raw.frets, tuning);
  const fretted = raw.frets.filter((f): f is number => f !== null && f > 0);
  return {
    system: raw.system,
    label: raw.label,
    frets: raw.frets,
    fingers,
    chart: chartText(raw.frets),
    baseFret: fretted.length ? Math.min(...fretted) : 0,
    strings: sounding.map((s) => stringNumber(s.i, n)),
    notes,
    degrees,
    bass: `${notes[0]} (${bassDeg})`,
    inversion,
    ...(barre ? { barre } : {}),
  };
}

export interface VoicingResult {
  chord: string;
  name: string;
  notes: string[];
  degrees: string[];
  tuning: string;
  voicings: Voicing[];
  skipped: { system: VoicingSystem; reason: string }[];
}

export function getChordVoicings(q: VoicingQuery): VoicingResult {
  const chord = parseChord(q.chord);
  const tuningId = q.tuning ?? 'standard';
  const tuning = getTuning(tuningId);
  const maxFret = Math.min(q.maxFret ?? 15, 24);
  const limit = q.limitPerSystem ?? 6;
  const systems = q.systems?.length ? q.systems : VOICING_SYSTEMS;
  const voicings: Voicing[] = [];
  const skipped: VoicingResult['skipped'] = [];
  for (const system of systems) {
    const raws = generate(chord, system, tuning, maxFret);
    if (!raws.length) {
      skipped.push({ system, reason: skipReason(system, chord, tuningId) });
      continue;
    }
    // Slash chords: keep only voicings with the requested bass note (when that note is in the chord).
    const wantBass = chord.bass && chord.pcs.includes(chord.bass.pc) ? chord.bass.pc : null;
    // Prefer lower positions and smaller stretches; keep a spread of positions and string sets.
    const scored = raws
      .filter((r) => wantBass === null || bassPc(r.frets, tuning) === wantBass)
      .map((r) => ({ r, d: describe(r, chord, tuning) }))
      .sort((a, b) => a.d.baseFret - b.d.baseFret || span(a.r.frets) - span(b.r.frets));
    const seen = new Set<string>();
    let taken = 0;
    for (const { d } of scored) {
      const key = `${d.label}|${d.inversion}`;
      if (system !== 'caged' && seen.has(key)) continue;
      seen.add(key);
      voicings.push(d);
      if (++taken >= limit) break;
    }
    if (!taken) skipped.push({ system, reason: `No ${system} voicing has ${chord.bass?.name} in the bass within fret ${maxFret}.` });
  }
  if (chord.bass && !chord.pcs.includes(chord.bass.pc)) {
    skipped.push({ system: systems[0], reason: `${chord.bass.name} is not in the chord, so play it separately in the bass (or let the bass player cover it).` });
  }
  return {
    chord: q.chord,
    name: chord.name,
    notes: chord.notes,
    degrees: chord.degrees,
    tuning: TUNINGS[tuningId].label,
    voicings,
    skipped,
  };
}

function bassPc(frets: (number | null)[], tuning: number[]) {
  const i = frets.findIndex((f) => f !== null);
  return pc(tuning[i] + (frets[i] as number));
}

const span = (frets: (number | null)[]) => {
  const f = frets.filter((x): x is number => x !== null && x > 0);
  return f.length ? Math.max(...f) - Math.min(...f) : 0;
};

function skipReason(system: VoicingSystem, chord: ParsedChord, tuningId: string) {
  if (system === 'caged') {
    if (tuningId !== 'standard') return 'CAGED shapes are defined for six-string standard tuning only.';
    return 'CAGED shapes here cover major, minor, 7, m7 and maj7 chords.';
  }
  if (system === 'shell') return 'Shell voicings need a 3rd (or sus note) and a 7th or 6th.';
  if (system === 'drop2' || system === 'drop3') return `${chord.symbol} has fewer than four different notes, so it has no four-voice ${system} form.`;
  return `No ${system} voicing found.`;
}
