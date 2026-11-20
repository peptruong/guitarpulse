'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { emptyProgress, type ProgressRecord } from '@guitarpulse/core/progress';
import { getEngine, peekEngine, preloadAudio, type Engine } from '@/lib/audio/engine';
import { loadProgress, saveProgress } from '@/lib/progressStore';

/* ── Announcements for screen readers ─────────────────────────────────────── */
const AnnounceContext = createContext<(message: string) => void>(() => {});
export const useAnnounce = () => useContext(AnnounceContext);

/* ── Audio ────────────────────────────────────────────────────────────────── */
interface AudioApi {
  engine: Engine | null;
  status: string;
  /** Creates (if needed) and resumes the engine. Call from a click or key handler. */
  ensure(): Promise<Engine>;
}
const AudioContextApi = createContext<AudioApi | null>(null);
export function useAudio(): AudioApi {
  const v = useContext(AudioContextApi);
  if (!v) throw new Error('useAudio must be used inside <Providers>.');
  return v;
}

/* ── Progress ─────────────────────────────────────────────────────────────── */
interface ProgressApi {
  progress: ProgressRecord;
  ready: boolean;
  /** False when the browser blocks storage; progress then lasts until the tab closes. */
  persistent: boolean;
  update(fn: (p: ProgressRecord) => ProgressRecord): void;
  replace(p: ProgressRecord): void;
}
const ProgressContext = createContext<ProgressApi | null>(null);
export function useProgress(): ProgressApi {
  const v = useContext(ProgressContext);
  if (!v) throw new Error('useProgress must be used inside <Providers>.');
  return v;
}

export function Providers({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const announce = useCallback((m: string) => {
    // Clearing first makes screen readers repeat identical messages.
    setMessage('');
    window.setTimeout(() => setMessage(m), 30);
  }, []);

  const [engine, setEngine] = useState<Engine | null>(() => (typeof window === 'undefined' ? null : peekEngine()));
  const [status, setStatus] = useState<string>(engine ? engine.status : 'off');
  useEffect(() => {
    const idle = window.setTimeout(() => void preloadAudio(), 1200);
    return () => window.clearTimeout(idle);
  }, []);
  useEffect(() => {
    if (!engine) return;
    setStatus(engine.status);
    return engine.subscribe(() => setStatus(engine.status));
  }, [engine]);
  const ensure = useCallback(async () => {
    const e = await getEngine();
    setEngine(e);
    await e.resume();
    return e;
  }, []);
  const audio = useMemo<AudioApi>(() => ({ engine, status, ensure }), [engine, status, ensure]);

  const [progress, setProgress] = useState<ProgressRecord>(emptyProgress);
  const [ready, setReady] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const latest = useRef(progress);
  useEffect(() => {
    let alive = true;
    void loadProgress().then((r) => {
      if (!alive) return;
      latest.current = r.progress;
      setProgress(r.progress);
      setPersistent(r.persistent);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  const commit = useCallback((next: ProgressRecord) => {
    latest.current = next;
    setProgress(next);
    void saveProgress(next).then((ok) => {
      if (!ok) setPersistent(false);
    });
  }, []);
  const update = useCallback((fn: (p: ProgressRecord) => ProgressRecord) => commit(fn(latest.current)), [commit]);
  const progressApi = useMemo<ProgressApi>(() => ({ progress, ready, persistent, update, replace: commit }), [progress, ready, persistent, update, commit]);

  return (
    <AnnounceContext.Provider value={announce}>
      <AudioContextApi.Provider value={audio}>
        <ProgressContext.Provider value={progressApi}>
          {children}
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {message}
          </div>
        </ProgressContext.Provider>
      </AudioContextApi.Provider>
    </AnnounceContext.Provider>
  );
}
