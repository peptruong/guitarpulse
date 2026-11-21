'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Engine } from './audio/engine';

export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/**
 * The beat being heard while the engine plays (null when stopped), read every animation frame.
 * Without `step` it updates every 1/32 beat. With `step` it updates only when step(beat) changes:
 * pages whose display changes at known points pass one, because redrawing on every frame keeps a
 * phone's main thread so busy that the audio scheduler falls behind (late notes click and distort).
 */
export function useHeardBeat(engine: Engine | null, active: boolean, step?: (beat: number) => number): number | null {
  const [beat, setBeat] = useState<number | null>(null);
  const stepRef = useLatest(step);
  useEffect(() => {
    if (!engine || !active) {
      setBeat(null);
      return;
    }
    let raf = 0;
    let last: number | null | undefined;
    const loop = () => {
      const b = engine.heardBeat();
      const toStep = stepRef.current;
      const key = b === null ? null : toStep ? toStep(b) : Math.round(b * 32) / 32;
      if (key !== last) {
        last = key;
        setBeat(b === null || toStep ? b : key);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, active, stepRef]);
  return beat;
}

/** Re-renders when the engine changes state (playing, stopped, audio suspended). */
export function useEngineVersion(engine: Engine | null): number {
  const [v, setV] = useState(0);
  useEffect(() => (engine ? engine.subscribe(() => setV((x) => x + 1)) : undefined), [engine]);
  return v;
}

export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/** Seconds since start, ticking once a second while running. */
export function useElapsed(startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  return startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
}
