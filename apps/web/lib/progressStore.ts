/**
 * The progress record lives in IndexedDB on this device. When storage is blocked (some private
 * windows), the app keeps working in memory and says so.
 */
import { createStore, get, set, type UseStore } from 'idb-keyval';
import * as z from 'zod';
import { emptyProgress, mergeProgress, type ProgressRecord } from '@guitarpulse/core/progress';

const KEY = 'progress-v1';
let store: UseStore | null = null;
const idb = () => (store ??= createStore('guitarpulse', 'kv'));

const ItemStat = z.object({ box: z.number().int().min(1).max(5), due: z.number(), correct: z.number().int().min(0), attempts: z.number().int().min(0) });
export const ProgressSchema = z.object({
  version: z.literal(1),
  sessions: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        kind: z.enum(['coach', 'trade', 'ear', 'song', 'studio']),
        startedAt: z.number(),
        durationSec: z.number().min(0),
        title: z.string().max(120),
        groove: z.string().max(40).optional(),
        key: z.string().max(12).optional(),
        metrics: z.record(z.string(), z.number().nullable()).optional(),
        focus: z.string().max(400).optional(),
        notesPlayed: z.number().int().min(0).optional(),
        ear: z.object({ correct: z.number().int().min(0), answered: z.number().int().min(0) }).optional(),
      }),
    )
    .max(2000),
  ear: z.object({
    items: z.record(z.string(), ItemStat),
    unlocked: z.object({ interval: z.number().int().min(1).max(4), chord: z.number().int().min(1).max(4) }),
    sessions: z.number().int().min(0),
  }),
  streak: z.object({ current: z.number().int().min(0), best: z.number().int().min(0), lastDay: z.string().max(10).nullable() }),
  totals: z.object({ minutes: z.number().min(0), sessions: z.number().int().min(0) }),
});

export async function loadProgress(): Promise<{ progress: ProgressRecord; persistent: boolean }> {
  try {
    const raw = await get(KEY, idb());
    if (raw === undefined) return { progress: emptyProgress(), persistent: true };
    const parsed = ProgressSchema.safeParse(raw);
    return { progress: parsed.success ? (parsed.data as ProgressRecord) : emptyProgress(), persistent: true };
  } catch {
    return { progress: emptyProgress(), persistent: false };
  }
}

export async function saveProgress(p: ProgressRecord): Promise<boolean> {
  try {
    await set(KEY, p, idb());
    return true;
  } catch {
    return false;
  }
}

/** Reads an exported file and merges it into the current record. */
export function importProgress(current: ProgressRecord, text: string): { ok: true; progress: ProgressRecord } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not a GuitarPulse progress export (it is not JSON).' };
  }
  const parsed = ProgressSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: 'That file is not a GuitarPulse progress export, or it is from a newer version.' };
  return { ok: true, progress: mergeProgress(current, parsed.data as ProgressRecord) };
}

export function newSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
