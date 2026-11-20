import { parseChord, type ParsedChord, type Quality } from './chords.js';
import { parseNote, pc, spellDegree, type NoteName } from './notes.js';
import { findScale, SCALES, scalePcs, type ScaleDef } from './scales.js';

/** Scales to consider for each chord quality, most usual first. */
const PREFERENCE: Record<Quality, string[]> = {
  maj: ['ionian', 'lydian', 'major-pentatonic', 'bebop-major'],
  min: ['dorian', 'aeolian', 'minor-pentatonic', 'phrygian', 'minor-blues', 'melodic-minor', 'bebop-dorian'],
  dom: ['mixolydian', 'major-pentatonic', 'bebop-dominant', 'lydian-dominant', 'altered', 'half-whole-diminished', 'phrygian-dominant', 'mixolydian-b6', 'whole-tone', 'minor-pentatonic', 'minor-blues'],
  hdim: ['locrian', 'locrian-nat2'],
  dim: ['whole-half-diminished'],
  aug: ['whole-tone', 'lydian-augmented', 'ionian-sharp5'],
  sus: ['mixolydian', 'dorian', 'major-pentatonic', 'minor-pentatonic'],
  mMaj: ['melodic-minor', 'harmonic-minor'],
  power: ['minor-pentatonic', 'aeolian', 'major-pentatonic', 'mixolydian', 'phrygian', 'minor-blues'],
};

export interface KeyContext {
  root: NoteName;
  scale: ScaleDef;
  pcs: number[];
  label: string;
}

export function parseKey(input: string): KeyContext {
  const m = /^\s*([A-Ga-g][#b♯♭]?)\s*(m(?![a-z])|min(?:or)?|maj(?:or)?)?\s*(.*)$/.exec(input);
  if (!m) throw new Error(`Could not read key "${input}". Try "G", "Em", "E minor", or "A dorian".`);
  const root = parseNote(m[1]);
  if (!root) throw new Error(`Could not read key "${input}".`);
  const tail = (m[3] || '').trim();
  const isMinor = !!m[2] && m[2].startsWith('m') && !m[2].startsWith('maj');
  const scale = tail
    ? findScale(`${m[2] ?? ''} ${tail}`.trim()) ?? findScale(tail)
    : findScale(isMinor ? 'aeolian' : 'ionian');
  if (!scale) throw new Error(`Unknown key mode "${tail}".`);
  return { root, scale, pcs: scalePcs(scale, root.pc), label: `${root.name} ${scale.name}` };
}

export interface ScaleSuggestion {
  scale: string;
  id: string;
  notes: string[];
  characteristic: string[];
  why: string;
  score: number;
}

export interface ChordAdvice {
  chord: string;
  name: string;
  chordTones: string[];
  guideTones: string[];
  scales: ScaleSuggestion[];
  avoidNotes: string[];
  function?: string;
}

export interface ProgressionAdvice {
  key?: string;
  chords: ChordAdvice[];
  wholeProgression: { scale: string; notes: string[]; why: string }[];
  guideToneLine: string[];
}

function fits(chord: ParsedChord, s: ScaleDef) {
  const sp = scalePcs(s, chord.root.pc);
  return chord.pcs.every((p) => sp.includes(p));
}

/** A small scale (pentatonic/hexatonic) is "safe" when it sits inside a full scale that fits the chord. */
function safeSubset(chord: ParsedChord, s: ScaleDef) {
  if (s.degrees.length > 6) return false;
  const sp = scalePcs(s, chord.root.pc);
  if (chord.third && !sp.includes(pc(chord.root.pc + (chord.third === '3' ? 4 : 3)))) return false;
  return SCALES.some((full) => full.degrees.length === 7 && fits(chord, full) && sp.every((p) => scalePcs(full, chord.root.pc).includes(p)));
}

function spellChordPc(chord: ParsedChord, absPc: number) {
  const rel = pc(absPc - chord.root.pc);
  const i = chord.semitones.findIndex((s) => pc(s) === rel);
  return i >= 0 ? `${chord.notes[i]} (${chord.degrees[i]})` : String(absPc);
}

export function suggestScales(progression: string[], key?: string, loops = true): ProgressionAdvice {
  if (!progression.length) throw new Error('Give at least one chord.');
  const chords = progression.map(parseChord);
  const keyCtx = key ? parseKey(key) : undefined;
  const isBlues =
    chords.filter((c) => c.quality === 'dom').length >= 2 &&
    chords.every((c) => c.quality === 'dom' && [0, 5, 7].includes(pc(c.root.pc - chords[0].root.pc)));

  const advice: ChordAdvice[] = chords.map((chord, i) => {
    const next = chords[i + 1] ?? (loops ? chords[0] : undefined);
    // In a blues every chord is a dominant, so I7 → IV7 is colour, not a V → I resolution.
    const resolvesDownFifth = !isBlues && !!next && next !== chord && pc(next.root.pc - chord.root.pc) === 5;
    const nextIsMinor = !!next && (next.quality === 'min' || next.quality === 'hdim' || next.quality === 'mMaj');
    // A plain major triad that falls a fifth into a minor chord is acting as V (as in Am - G - F - E).
    const actsAsDominant = chord.quality === 'dom' || (chord.quality === 'maj' && !chord.seventh && resolvesDownFifth && nextIsMinor);
    let fn: string | undefined;
    if (actsAsDominant && resolvesDownFifth) fn = `V${chord.quality === 'dom' ? '7' : ''} resolving to ${next!.symbol}`;
    else if (chord.quality === 'dom' && isBlues) fn = 'blues dominant (does not need to resolve)';
    else if (chord.quality === 'dom') fn = 'non-resolving dominant';

    const prefs = actsAsDominant && chord.quality === 'maj' ? [...PREFERENCE.maj, 'phrygian-dominant', 'mixolydian', 'harmonic-minor'] : PREFERENCE[chord.quality];
    const out: ScaleSuggestion[] = [];
    for (const id of prefs) {
      const s = findScale(id)!;
      const full = fits(chord, s);
      const bluesColour = (id === 'minor-blues' || id === 'minor-pentatonic') && (chord.quality === 'min' || (chord.quality === 'dom' && isBlues));
      const subset = !full && safeSubset(chord, s);
      if (!full && !subset && !bluesColour) continue;
      let score = 20 - prefs.indexOf(id);
      const reasons: string[] = [];
      if (full) reasons.push('contains every chord tone');
      else if (subset) reasons.push('a safe subset (no clashing notes)');
      else reasons.push('blues colour: the b3/b5 rub against the chord on purpose');
      if (keyCtx) {
        const inKey = scalePcs(s, chord.root.pc).every((p) => keyCtx.pcs.includes(p));
        if (inKey) {
          score += 10;
          reasons.push(`stays inside ${keyCtx.label}`);
        }
      }
      if (actsAsDominant) {
        if (resolvesDownFifth && next) {
          const toMinor = nextIsMinor;
          const bonus: Record<string, number> = toMinor
            ? { 'phrygian-dominant': 9, altered: 7, 'half-whole-diminished': 5, 'mixolydian-b6': 6 }
            : { altered: 6, 'half-whole-diminished': 5, mixolydian: 3, 'bebop-dominant': 3 };
          if (bonus[id]) {
            score += bonus[id];
            reasons.push(toMinor ? 'its b9 and b13 pull into the minor chord' : 'adds tension that resolves into the next chord');
          }
        } else if (isBlues) {
          const bluesBonus: Record<string, number> = { 'minor-pentatonic': 14, 'minor-blues': 13, mixolydian: 6, 'major-pentatonic': 6 };
          if (bluesBonus[id]) score += bluesBonus[id];
        } else if (id === 'lydian-dominant') {
          score += 5;
          reasons.push('the #11 suits a dominant that does not resolve');
        }
      }
      out.push({
        scale: `${chord.root.name} ${s.name}`,
        id: s.id,
        notes: s.degrees.map((d) => spellDegree(chord.root, d)),
        characteristic: s.characteristic.map((d) => `${spellDegree(chord.root, d)} (${d})`),
        why: reasons.join('; '),
        score,
      });
    }
    out.sort((a, b) => b.score - a.score);
    const top = out[0] ? findScale(out[0].id)! : undefined;
    const avoid: string[] = [];
    if (top && !(actsAsDominant && ['altered', 'half-whole-diminished', 'phrygian-dominant'].includes(top.id))) {
      top.degrees.forEach((d) => {
        const p = pc(chord.root.pc + scalePcs(top, 0)[top.degrees.indexOf(d)]);
        if (!chord.pcs.includes(p) && chord.pcs.includes(pc(p - 1))) avoid.push(`${spellDegree(chord.root, d)} (${d}): a half step above a chord tone; use it as a passing note`);
      });
    }
    const guide = [chord.third, chord.seventh].filter((d): d is string => !!d);
    return {
      chord: chord.symbol,
      name: chord.name,
      chordTones: chord.degrees.map((d, k) => `${chord.notes[k]} (${d})`),
      guideTones: guide.map((d) => `${spellDegree(chord.root, d)} (${d})`),
      scales: out.slice(0, 5),
      avoidNotes: avoid,
      ...(fn ? { function: fn } : {}),
    };
  });

  const whole: ProgressionAdvice['wholeProgression'] = [];
  if (isBlues) {
    const r = chords[0].root;
    whole.push({ scale: `${r.name} minor pentatonic / blues`, notes: findScale('minor-blues')!.degrees.map((d) => spellDegree(r, d)), why: 'Works over the whole blues; bend the b3 slightly sharp for the classic sound.' });
    whole.push({ scale: `Mix in ${r.name} major pentatonic`, notes: findScale('major-pentatonic')!.degrees.map((d) => spellDegree(r, d)), why: 'Over the I7 chord, the major 3rd and 6th sound sweet; switch back to minor over the IV7.' });
  }
  if (keyCtx) {
    const all = [...new Set(chords.flatMap((c) => c.pcs))];
    const inKey = all.filter((p) => keyCtx.pcs.includes(p)).length / all.length;
    whole.push({ scale: keyCtx.label, notes: keyCtx.scale.degrees.map((d) => spellDegree(keyCtx.root, d)), why: `${Math.round(inKey * 100)}% of the chord tones are in this key${inKey < 1 ? '; switch scales on the chords that leave it' : ''}.` });
    const pent = keyCtx.scale.degrees.includes('b3') ? 'minor-pentatonic' : 'major-pentatonic';
    whole.push({ scale: `${keyCtx.root.name} ${findScale(pent)!.name}`, notes: findScale(pent)!.degrees.map((d) => spellDegree(keyCtx.root, d)), why: 'The easy, safe option: five notes with no avoid notes.' });
  }

  // Guide-tone line: move each chord's 3rd/7th to the nearest 3rd/7th of the next chord.
  const line: string[] = [];
  for (let i = 0; i < chords.length - (loops ? 0 : 1); i++) {
    const a = chords[i];
    const b = chords[(i + 1) % chords.length];
    if (a === b) break;
    const ga = [a.third, a.seventh].filter(Boolean).map((d) => pc(a.root.pc + semis(a, d!)));
    const gb = [b.third, b.seventh].filter(Boolean).map((d) => pc(b.root.pc + semis(b, d!)));
    for (const p of ga) {
      let best = gb[0];
      let bestMove = 99;
      for (const q of gb) {
        let mv = pc(q - p);
        if (mv > 6) mv -= 12;
        if (Math.abs(mv) < Math.abs(bestMove)) { bestMove = mv; best = q; }
      }
      if (best === undefined) continue;
      const how = bestMove === 0 ? 'stays (common tone)' : `${bestMove > 0 ? 'up' : 'down'} ${Math.abs(bestMove) === 1 ? 'a half step' : Math.abs(bestMove) === 2 ? 'a whole step' : `${Math.abs(bestMove)} half steps`}`;
      line.push(`${a.symbol} → ${b.symbol}: ${spellChordPc(a, p)} ${how} to ${spellChordPc(b, best)}`);
    }
  }

  return { ...(keyCtx ? { key: keyCtx.label } : {}), chords: advice, wholeProgression: whole, guideToneLine: line };
}

function semis(c: ParsedChord, degree: string) {
  const i = c.degrees.indexOf(degree);
  return i >= 0 ? c.semitones[i] : 0;
}
