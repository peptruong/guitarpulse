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

/** The beat being heard, updated every animation frame while the engine plays (null when stopped). */
export function useHeardBeat(engine: Engine | null, active: boolean): number | null {
  const [beat, setBeat] = useState<number | null>(null);
  useEffect(() => {
    if (!engine || !active) {
      setBeat(null);
      return;
    }
    let raf = 0;
    let last = -1;
    const loop = () => {
      const b = engine.heardBeat();
      // About 30 updates per second is plenty for the display and keeps React work low.
      const q = b === null ? null : Math.round(b * 32) / 32;
      if (q !== last) {
        last = q ?? -1;
        setBeat(q);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, active]);
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
