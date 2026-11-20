export const LICK_GENRES = [
  'blues',
  'rock',
  'metal',
  'shred',
  'prog',
  'jazz',
  'gypsy-jazz',
  'fusion',
  'funk',
  'soul',
  'neo-soul',
  'pop',
  'latin',
  'country',
  'fingerstyle',
  'city-pop',
  'anime',
  'k-pop',
  'wuxia',
  'vietnamese',
] as const;
export type LickGenre = (typeof LICK_GENRES)[number];

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface LickInput {
  key: string;
  scale: string;
  chord: string;
  bpm: number;
  diff: Difficulty;
  tech: string[];
  targets: string[];
  theory: string;
  /** alphaTex note body (no header). Strings: 1 = high E. */
  tex: string;
  /** Degrees outside the scale that the lick uses on purpose (passing or blue notes). */
  passing?: string[];
  ts?: [number, number];
}

export interface Lick {
  id: string;
  artist: string;
  genre: LickGenre;
  title: string;
  key: string;
  scale: string;
  chord: string;
  bpm: number;
  difficulty: Difficulty;
  techniques: string[];
  targetTones: string[];
  theory: string;
  passing: string[];
  timeSignature: string;
  body: string;
  alphaTex: string;
  original: true;
}

const escape = (s: string) => s.replace(/"/g, "'");

export function makeLick(id: string, artist: string, genre: LickGenre, title: string, o: LickInput): Lick {
  const ts = o.ts ?? [4, 4];
  const header = `\\title "${escape(title)}" \\subtitle "Original style study, in the style of ${escape(artist)}" \\tempo ${o.bpm} .`;
  const meter = ts[0] === 4 && ts[1] === 4 ? '' : ` \\ts ${ts[0]} ${ts[1]}`;
  return {
    id,
    artist,
    genre,
    title,
    key: o.key,
    scale: o.scale,
    chord: o.chord,
    bpm: o.bpm,
    difficulty: o.diff,
    techniques: o.tech,
    targetTones: o.targets,
    theory: o.theory,
    passing: o.passing ?? [],
    timeSignature: `${ts[0]}/${ts[1]}`,
    body: o.tex,
    alphaTex: `${header}${meter} ${o.tex}`,
    original: true,
  };
}

export interface ArtistProfile {
  name: string;
  genre: LickGenre;
  traits: string;
  tone: string;
}
