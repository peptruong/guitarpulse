/**
 * Jam sessions as links: Claude (through the MCP server) or the app builds a session, encodes it
 * into a URL, and the app's /jam page opens it ready to play.
 */
import * as z from 'zod';
import { GROOVES } from './grooves.js';
import { getLick } from './licks/index.js';
import { parseChordChart } from './song.js';
import { parseNote } from './theory/notes.js';
import { findScale } from './theory/scales.js';

export const JAM_MODES = ['studio', 'coach', 'trade', 'song', 'ear'] as const;
export type JamMode = (typeof JAM_MODES)[number];

export const JamSessionSchema = z.object({
  v: z.literal(1),
  mode: z.enum(JAM_MODES),
  title: z.string().max(80).optional(),
  groove: z.string().max(40).optional(),
  key: z.string().max(12).optional(),
  progression: z.number().int().min(0).max(9).optional(),
  chart: z.string().max(600).optional(),
  bpm: z.number().int().min(40).max(240).optional(),
  scale: z.string().max(40).optional(),
  licks: z.array(z.string().max(60)).max(6).optional(),
  focus: z.string().max(200).optional(),
  ear: z.object({ mode: z.enum(['interval', 'chord', 'mixed']), minutes: z.number().int().min(1).max(30) }).optional(),
  note: z.string().max(300).optional(),
});
export type JamSession = z.infer<typeof JamSessionSchema>;

function toBase64Url(text: string) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Checks a session against what the app knows (grooves, keys, scales, licks, chord charts). */
export function jamProblems(s: JamSession): string[] {
  const problems: string[] = [];
  if (s.groove && !GROOVES.some((g) => g.id === s.groove)) problems.push(`Unknown groove "${s.groove}". Options: ${GROOVES.map((g) => g.id).join(', ')}.`);
  if (s.key && !parseNote(s.key.replace(/\s*(major|minor|m)$/i, ''))) problems.push(`Unknown key "${s.key}".`);
  if (s.scale && !findScale(s.scale)) problems.push(`Unknown scale "${s.scale}".`);
  for (const id of s.licks ?? []) if (!getLick(id)) problems.push(`Unknown lick id "${id}".`);
  if (s.chart) {
    const parsed = parseChordChart(s.chart);
    problems.push(...parsed.errors.map((e) => e.message));
    if (!parsed.chords.length) problems.push('The chord chart has no chords.');
  }
  if ((s.mode === 'song' || s.mode === 'trade' || s.mode === 'coach' || s.mode === 'studio') && !s.groove && !s.chart) problems.push('Give a groove or a chord chart.');
  if (s.mode === 'ear' && !s.ear) problems.push('Ear sessions need ear: { mode, minutes }.');
  if (s.groove && s.progression !== undefined) {
    const g = GROOVES.find((x) => x.id === s.groove);
    if (g && s.progression >= g.progressions.length) problems.push(`Groove "${s.groove}" has ${g.progressions.length} progression(s); use progression 0-${g.progressions.length - 1}.`);
  }
  return problems;
}

export function encodeJam(s: JamSession): string {
  const parsed = JamSessionSchema.parse(s);
  return toBase64Url(JSON.stringify(parsed));
}

export function decodeJam(code: string): { ok: true; session: JamSession } | { ok: false; error: string } {
  try {
    const json = JSON.parse(fromBase64Url(code));
    const r = JamSessionSchema.safeParse(json);
    if (!r.success) return { ok: false, error: `This jam link is not valid: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}` };
    const problems = jamProblems(r.data);
    if (problems.length) return { ok: false, error: problems.join(' ') };
    return { ok: true, session: r.data };
  } catch {
    return { ok: false, error: 'This jam link is damaged or incomplete. Ask Claude for a new one.' };
  }
}

/** Links to /jam/ with the slash: static hosts serve that page as a folder (jam/index.html). */
export function jamLink(baseUrl: string, s: JamSession): string {
  return `${baseUrl.replace(/\/+$/, '')}/jam/?s=${encodeJam(s)}`;
}

export function describeJam(s: JamSession): string {
  const parts: string[] = [];
  const g = s.groove ? GROOVES.find((x) => x.id === s.groove) : undefined;
  const what = { studio: 'Backing track', coach: 'Coached jam', trade: 'Trading fours', song: 'Song practice', ear: 'Ear training' }[s.mode];
  parts.push(what);
  if (g) parts.push(`${g.name}${s.key ? ` in ${s.key}` : ''}${s.bpm ? ` at ${s.bpm} BPM` : ''}`);
  else if (s.chart) parts.push(`over "${s.chart.slice(0, 60)}${s.chart.length > 60 ? '…' : ''}"`);
  if (s.scale) parts.push(`using ${findScale(s.scale)?.name ?? s.scale}`);
  if (s.licks?.length) parts.push(`with ${s.licks.length} lick${s.licks.length > 1 ? 's' : ''} to work in`);
  if (s.ear) parts.push(`${s.ear.minutes} minutes of ${s.ear.mode === 'mixed' ? 'intervals and chords' : `${s.ear.mode}s`}`);
  return parts.join(', ');
}
