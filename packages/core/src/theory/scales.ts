import { degreeSemitones, getTuning, parseNote, pc, prefersFlats, spellDegree, stringNumber, type NoteName } from './notes.js';

export type ScaleFamily =
  | 'pentatonic'
  | 'blues'
  | 'major-modes'
  | 'harmonic-minor'
  | 'melodic-minor'
  | 'symmetric'
  | 'bebop'
  | 'exotic'
  | 'east-asian'
  | 'vietnamese';

export interface ScaleDef {
  id: string;
  name: string;
  aliases: string[];
  family: ScaleFamily;
  degrees: string[];
  /** The note that gives the scale its colour (what to land on to make it sound like itself). */
  characteristic: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  mood: string;
  /** Degrees that are pressed (bent) or vibrated in performance, for modes that are not equal-tempered. */
  inflections?: { degree: string; how: string }[];
  /** Background and honest caveats (e.g. "tempered approximation"). */
  about?: string;
}

const S = (
  id: string,
  name: string,
  family: ScaleFamily,
  degrees: string,
  characteristic: string,
  difficulty: ScaleDef['difficulty'],
  mood: string,
  aliases: string[] = [],
): ScaleDef => ({
  id,
  name,
  family,
  degrees: degrees.split(' '),
  characteristic: characteristic ? characteristic.split(' ') : [],
  difficulty,
  mood,
  aliases,
});

export const SCALES: ScaleDef[] = [
  S('minor-pentatonic', 'Minor pentatonic', 'pentatonic', '1 b3 4 5 b7', 'b3 b7', 1, 'Bluesy, rock, the first scale to learn', ['minor pent', 'pentatonic minor']),
  S('major-pentatonic', 'Major pentatonic', 'pentatonic', '1 2 3 5 6', '3 6', 1, 'Sweet, country, soul', ['major pent', 'pentatonic major']),
  S('minor-blues', 'Minor blues', 'blues', '1 b3 4 b5 5 b7', 'b5', 1, 'Gritty blues with the "blue note"', ['blues', 'blues scale']),
  S('major-blues', 'Major blues', 'blues', '1 2 b3 3 5 6', 'b3 3', 2, 'Happy blues, country, gospel'),
  S('ionian', 'Ionian (major)', 'major-modes', '1 2 3 4 5 6 7', '7', 1, 'Bright, resolved', ['major', 'major scale']),
  S('dorian', 'Dorian', 'major-modes', '1 2 b3 4 5 6 b7', '6', 2, 'Minor but hopeful: funk, Santana, jazz', []),
  S('phrygian', 'Phrygian', 'major-modes', '1 b2 b3 4 5 b6 b7', 'b2', 3, 'Dark, Spanish, metal'),
  S('lydian', 'Lydian', 'major-modes', '1 2 3 #4 5 6 7', '#4', 3, 'Dreamy, floating, film scores'),
  S('mixolydian', 'Mixolydian', 'major-modes', '1 2 3 4 5 6 b7', 'b7', 2, 'Bluesy major, rock, jam bands', ['dominant']),
  S('aeolian', 'Aeolian (natural minor)', 'major-modes', '1 2 b3 4 5 b6 b7', 'b6', 1, 'Sad, epic, rock ballads', ['minor', 'natural minor', 'minor scale']),
  S('locrian', 'Locrian', 'major-modes', '1 b2 b3 4 b5 b6 b7', 'b5', 4, 'Unstable, used over m7b5 chords'),
  S('harmonic-minor', 'Harmonic minor', 'harmonic-minor', '1 2 b3 4 5 b6 7', '7 b6', 3, 'Classical, neoclassical metal'),
  S('locrian-nat6', 'Locrian natural 6', 'harmonic-minor', '1 b2 b3 4 b5 6 b7', '6', 5, 'Tense half-diminished colour'),
  S('ionian-sharp5', 'Ionian #5', 'harmonic-minor', '1 2 3 4 #5 6 7', '#5', 5, 'Augmented major colour'),
  S('dorian-sharp4', 'Dorian #4', 'harmonic-minor', '1 2 b3 #4 5 6 b7', '#4', 5, 'Eastern European minor', ['ukrainian dorian']),
  S('phrygian-dominant', 'Phrygian dominant', 'harmonic-minor', '1 b2 3 4 5 b6 b7', 'b2 3', 3, 'Flamenco, Middle Eastern, metal', ['spanish phrygian', 'freygish']),
  S('lydian-sharp2', 'Lydian #2', 'harmonic-minor', '1 #2 3 #4 5 6 7', '#2 #4', 5, 'Exotic major'),
  S('superlocrian-bb7', 'Super-Locrian bb7', 'harmonic-minor', '1 b2 b3 b4 b5 b6 bb7', 'bb7', 5, 'Over diminished chords', ['ultralocrian']),
  S('melodic-minor', 'Melodic minor (jazz minor)', 'melodic-minor', '1 2 b3 4 5 6 7', '6 7', 3, 'Smooth minor, minor-major chords', ['jazz minor']),
  S('dorian-b2', 'Dorian b2', 'melodic-minor', '1 b2 b3 4 5 6 b7', 'b2 6', 5, 'Phrygian with a bright 6th', ['phrygian nat6']),
  S('lydian-augmented', 'Lydian augmented', 'melodic-minor', '1 2 3 #4 #5 6 7', '#5', 5, 'Over maj7#5 chords'),
  S('lydian-dominant', 'Lydian dominant', 'melodic-minor', '1 2 3 #4 5 6 b7', '#4 b7', 4, 'Over dominant chords that do not resolve', ['overtone', 'acoustic scale', 'lydian b7']),
  S('mixolydian-b6', 'Mixolydian b6', 'melodic-minor', '1 2 3 4 5 b6 b7', 'b6', 4, 'Bittersweet dominant', ['aeolian dominant', 'hindu']),
  S('locrian-nat2', 'Locrian natural 2', 'melodic-minor', '1 2 b3 4 b5 b6 b7', '2 b5', 4, 'Smoother sound over m7b5', ['half-diminished scale']),
  S('altered', 'Altered', 'melodic-minor', '1 b2 #2 3 #4 b6 b7', 'b2 #2 b6', 5, 'Maximum tension over V7 before resolving', ['super locrian', 'altered dominant']),
  S('half-whole-diminished', 'Half-whole diminished', 'symmetric', '1 b2 #2 3 #4 5 6 b7', 'b2 #2 6', 5, 'Over 7b9 chords', ['dominant diminished']),
  S('whole-half-diminished', 'Whole-half diminished', 'symmetric', '1 2 b3 4 b5 b6 6 7', '2 4 7', 5, 'Over dim7 chords', ['diminished']),
  S('whole-tone', 'Whole tone', 'symmetric', '1 2 3 #4 #5 b7', '#4 #5', 4, 'Dreamlike, floating, over 7#5'),
  S('chromatic', 'Chromatic', 'symmetric', '1 b2 2 b3 3 4 #4 5 b6 6 b7 7', '', 3, 'All twelve notes'),
  S('bebop-dominant', 'Dominant bebop', 'bebop', '1 2 3 4 5 6 b7 7', '7', 4, 'Mixolydian with a passing major 7th; keeps chord tones on the beat'),
  S('bebop-major', 'Major bebop', 'bebop', '1 2 3 4 5 #5 6 7', '#5', 4, 'Major with a passing #5'),
  S('bebop-dorian', 'Dorian bebop', 'bebop', '1 2 b3 3 4 5 6 b7', '3', 4, 'Dorian with a passing major 3rd'),
  S('hungarian-minor', 'Hungarian minor', 'exotic', '1 2 b3 #4 5 b6 7', '#4 7', 4, 'Dramatic, gypsy', ['gypsy minor', 'double harmonic minor']),
  S('double-harmonic', 'Double harmonic', 'exotic', '1 b2 3 4 5 b6 7', 'b2 7', 4, 'Byzantine, Arabic', ['byzantine', 'arabic']),
  S('hirajoshi', 'Hirajoshi', 'exotic', '1 2 b3 5 b6', 'b6', 3, 'Japanese koto colour'),
  S('in-sen', 'In Sen', 'exotic', '1 b2 4 5 b7', 'b2', 3, 'Japanese, sparse and dark', ['insen']),
  S('spanish-8-tone', 'Spanish 8-tone', 'exotic', '1 b2 #2 3 4 b5 b6 b7', 'b2 3', 4, 'Flamenco with both thirds'),
  S('ryukyu', 'Ryukyu (Okinawan)', 'east-asian', '1 3 4 5 7', '3 7', 2, 'Bright island sound heard in Japanese pop and anime', ['okinawan']),
  // Chinese pentatonic modes: the five rotations of one pentatonic set, named after its degrees.
  S('gong', 'Gong (宫) mode', 'east-asian', '1 2 3 5 6', '3', 1, 'Chinese major mode: open, heroic, the wuxia "hero" sound', ['gong mode', 'chinese major']),
  S('shang', 'Shang (商) mode', 'east-asian', '1 2 4 5 b7', '4 b7', 2, 'Suspended, floating, neither major nor minor', ['shang mode']),
  S('jue', 'Jue (角) mode', 'east-asian', '1 b3 4 b6 b7', 'b6', 3, 'Dark and plaintive; rare in Chinese folk music', ['jiao', 'jue mode']),
  S('zhi', 'Zhi (徵) mode', 'east-asian', '1 2 4 5 6', '4 6', 2, 'Bright folk sound; also the Japanese Yo scale', ['zhi mode', 'yo', 'yo scale']),
  S('yu', 'Yu (羽) mode', 'east-asian', '1 b3 4 5 b7', 'b3', 1, 'Chinese minor mode: melancholy, martial; same notes as minor pentatonic', ['yu mode', 'chinese minor']),
]
  .concat(vietnameseModes());

/**
 * Vietnamese modes (điệu / hơi), written as equal-tempered approximations with Hò as the root.
 * The pitch sets follow Huế and southern sources; in performance several degrees are pressed
 * (nhấn) or vibrated (rung) and land between Western pitches, which these numbers cannot show.
 */
function vietnameseModes(): ScaleDef[] {
  const VN = 'Equal-tempered approximation. Real performance presses (nhấn) and vibrates (rung) some degrees so they sit between Western pitches, and sources and regions differ.';
  return [
    { ...S('dieu-bac', 'Điệu Bắc (Bắc mode)', 'vietnamese', '1 2 4 5 6', '2 6', 2, 'Bright, joyful or solemn; Hò Xự Xang Xê Cống', ['hoi bac', 'dieu bac', 'bac']), inflections: [{ degree: '2', how: 'rung (vibrato)' }, { degree: '6', how: 'rung (vibrato)' }], about: `${VN} On paper it matches the Chinese Zhi mode; the vibrato on Xự and Cống is what makes it Vietnamese.` },
    { ...S('nam-xuan', 'Nam Xuân', 'vietnamese', '1 2 4 5 b7', '2 b7', 3, 'Calm and gentle, from the Nam (southern) family', ['hoi xuan', 'xuan']), inflections: [{ degree: 'b7', how: 'rung (vibrato)' }], about: VN },
    { ...S('nam-ai', 'Nam Ai', 'vietnamese', '1 b3 4 5 b7', 'b3 b7', 3, 'Sad and tender', ['hoi ai', 'ai']), inflections: [{ degree: 'b3', how: 'nhấn: often pressed slightly sharp (già)' }, { degree: 'b7', how: 'rung (vibrato)' }], about: `${VN} On paper it shares notes with minor pentatonic; the pressed 3rd is the colour.` },
    { ...S('hoi-oan', 'Hơi Oán (vọng cổ mode)', 'vietnamese', '1 b3 4 5 b6 b7', 'b3 b6', 4, 'Mournful; the mode of vọng cổ in cải lương', ['hoi oan', 'oan', 'vong co']), inflections: [{ degree: 'b3', how: 'Xự: nhấn upward, landing between b3 and 3' }, { degree: 'b6', how: 'Cống: nhấn upward, landing between b6 and 6' }, { degree: 'b7', how: 'Oan: rung (vibrato)' }], about: `${VN} Mapping as taught for the scalloped-fret (phím lõm) guitar: Hò, Xự, Xang, Xê, Cống, Oan.` },
  ];
}

const BY_ID = new Map(SCALES.map((s) => [s.id, s]));
const BY_ALIAS = new Map<string, ScaleDef>();
for (const s of SCALES) {
  for (const key of [s.id, s.name.toLowerCase(), ...s.aliases]) BY_ALIAS.set(normalise(key), s);
}

function normalise(s: string) {
  return s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9#]+/g, ' ').trim();
}

export function findScale(nameOrId: string): ScaleDef | undefined {
  return BY_ID.get(nameOrId) ?? BY_ALIAS.get(normalise(nameOrId));
}

export const scaleSemitones = (s: ScaleDef) => s.degrees.map(degreeSemitones);
export const scalePcs = (s: ScaleDef, rootPc: number) => s.degrees.map((d) => pc(rootPc + degreeSemitones(d)));

export interface FretNote {
  string: number; // 1 = highest-pitched string
  fret: number;
  midi: number;
  note: string;
  degree: string;
}

export interface ScaleResult {
  id: string;
  name: string;
  root: string;
  family: ScaleFamily;
  formula: string;
  semitones: number[];
  pitchClasses: number[];
  notes: string[];
  characteristic: string[];
  mood: string;
  pattern: string;
  fretboard: FretNote[];
}

export interface ScaleQuery {
  root: string;
  scale: string;
  tuning?: string;
  /** 'full' = whole neck; 'box' = 2 notes per string (pentatonic boxes 1-5); '3nps' = 3 notes per string (7 patterns). */
  pattern?: 'full' | 'box' | '3nps';
  position?: number;
  maxFret?: number;
}

export function getScale(q: ScaleQuery): ScaleResult {
  const root = parseNote(q.root);
  if (!root) throw new Error(`Unknown root note "${q.root}". Use a letter A-G with optional # or b.`);
  const def = findScale(q.scale);
  if (!def) throw new Error(`Unknown scale "${q.scale}". Try one of: ${SCALES.map((s) => s.id).join(', ')}`);
  const tuning = getTuning(q.tuning);
  const maxFret = q.maxFret ?? 24;
  const pattern = q.pattern ?? 'full';
  const semis = scaleSemitones(def);
  const notes = def.degrees.map((d) => spellDegree(root, d));
  const spellByPc = new Map<number, { note: string; degree: string }>();
  def.degrees.forEach((d, i) => spellByPc.set(pc(root.pc + semis[i]), { note: notes[i], degree: d }));

  let fretboard: FretNote[];
  let patternLabel = 'full neck';
  if (pattern === 'full') {
    fretboard = [];
    tuning.forEach((open, idx) => {
      for (let f = 0; f <= maxFret; f++) {
        const hit = spellByPc.get(pc(open + f));
        if (hit) fretboard.push({ string: stringNumber(idx, tuning.length), fret: f, midi: open + f, note: hit.note, degree: hit.degree });
      }
    });
  } else {
    const perString = pattern === 'box' ? 2 : 3;
    const needed = pattern === 'box' ? 5 : 7;
    if (def.degrees.length !== needed) {
      throw new Error(`Pattern "${pattern}" needs a ${needed}-note scale; ${def.name} has ${def.degrees.length} notes. Use pattern "full".`);
    }
    const position = Math.min(Math.max(q.position ?? 1, 1), needed);
    fretboard = notesPerStringPattern(root, def, semis, tuning, position - 1, perString).map((n) => ({
      ...n,
      note: spellByPc.get(pc(n.midi))!.note,
      degree: spellByPc.get(pc(n.midi))!.degree,
    }));
    patternLabel = pattern === 'box' ? `box ${position} (2 notes per string)` : `3NPS pattern ${position}`;
  }

  return {
    id: def.id,
    name: `${root.name} ${def.name}`,
    root: root.name,
    family: def.family,
    formula: def.degrees.join(' '),
    semitones: semis,
    pitchClasses: semis.map((s) => pc(root.pc + s)),
    notes,
    characteristic: def.characteristic.map((d) => `${d} (${spellDegree(root, d)})`),
    mood: def.mood,
    pattern: patternLabel,
    fretboard,
  };
}

/**
 * Builds an N-notes-per-string shape by walking up the scale from the chosen
 * degree on the lowest string. With 2 per string on a pentatonic scale this gives
 * the classic five boxes; with 3 per string on a 7-note scale it gives the 3NPS patterns.
 */
function notesPerStringPattern(
  root: NoteName,
  _def: ScaleDef,
  semis: number[],
  tuning: number[],
  startDegree: number,
  perString: number,
): Omit<FretNote, 'note' | 'degree'>[] {
  const startPc = pc(root.pc + semis[startDegree]);
  let startFret = pc(startPc - tuning[0]);
  if (startFret === 0 && perString === 3) startFret = 12; // avoid open-string patterns for 3NPS
  // Walk the scale upward from the starting pitch.
  const ascending: number[] = [];
  let midi = tuning[0] + startFret;
  let deg = startDegree;
  let octave = 0;
  const base = tuning[0] + startFret - semis[startDegree];
  while (ascending.length < perString * tuning.length) {
    midi = base + semis[deg] + 12 * octave;
    ascending.push(midi);
    deg += 1;
    if (deg === semis.length) {
      deg = 0;
      octave += 1;
    }
  }
  const out: Omit<FretNote, 'note' | 'degree'>[] = [];
  tuning.forEach((open, idx) => {
    for (let k = 0; k < perString; k++) {
      const m = ascending[idx * perString + k];
      out.push({ string: stringNumber(idx, tuning.length), fret: m - open, midi: m });
    }
  });
  // If the shape dipped below the nut (can happen in non-standard tunings), move it up an octave.
  if (out.some((n) => n.fret < 0)) for (const n of out) { n.fret += 12; n.midi += 12; }
  return out;
}

export function scaleSpelling(rootName: string, scaleId: string): string[] {
  const root = parseNote(rootName);
  const def = findScale(scaleId);
  if (!root || !def) return [];
  return def.degrees.map((d) => spellDegree(root, d));
}

export { prefersFlats };
