'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Download, Ear, Flame, GraduationCap, Grid3x3, Guitar, ListMusic, Mic, Music, Repeat2, Upload, type LucideIcon } from 'lucide-react';
import { METRIC_TARGETS } from '@guitarpulse/core/coach/metrics';
import { ALL_ITEMS, stat } from '@guitarpulse/core/ear';
import { currentStreak, emptyProgress, metricTrend } from '@guitarpulse/core/progress';
import { useProgress } from '@/components/Providers';
import { Sparkline } from '@/components/session';
import { Button, Card, cx, Notice, PageHeader, Stat } from '@/components/ui';
import { importProgress } from '@/lib/progressStore';

const FEATURES: { href: string; title: string; text: string; icon: LucideIcon; tag?: string }[] = [
  { href: '/studio', title: 'Backing tracks', text: '24 styles from slow blues to city pop, cải lương and metal, in any key and tempo. Slow down your own recordings without changing key.', icon: Music },
  { href: '/coach', title: 'Coach', text: 'Solo over a track while the app listens. Get chord-tone, phrasing, timing and bend numbers, plus a replay of where your hand went on the neck.', icon: Mic },
  { href: '/trade', title: 'Trade fours', text: 'You play four bars, GuitarPulse answers with your idea developed, you answer back.', icon: Repeat2, tag: 'new' },
  { href: '/song', title: 'Song to practice', text: 'Type a song’s chords: get a backing track, the scale for each chord and the 3rd/7th line.', icon: ListMusic, tag: 'new' },
  { href: '/licks', title: 'Licks and mutator', text: '126 style studies with tab. Move them to a new key, shift, flip, retarget or reverse them.', icon: Guitar },
  { href: '/ear', title: 'Ear trainer', text: 'Five-minute interval and chord-quality drills that remember what you miss.', icon: Ear, tag: 'new' },
  { href: '/scales', title: 'Scales and chords', text: '47 scales, including Chinese and Vietnamese modes, in any tuning, plus CAGED, drop-2 and shell voicings.', icon: Grid3x3 },
  { href: '/path', title: 'Learning path', text: 'A week-by-week plan from your level, with tracks, licks and targets.', icon: GraduationCap },
];
const TRENDS = ['chordToneOnStrongBeats', 'scaleAdherence', 'restRatio', 'timingSdMs'];

export function Dashboard() {
  const { progress, ready, persistent, replace } = useProgress();
  const [importMsg, setImportMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // The date is shown only in the browser, so the prerendered page never disagrees with it.
  const [today, setToday] = useState('');
  useEffect(() => setToday(new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })), []);
  const streak = currentStreak(progress);
  const last = progress.sessions[progress.sessions.length - 1];
  const lastCoach = [...progress.sessions].reverse().find((s) => s.kind === 'coach');
  const earSeen = ALL_ITEMS.filter((i) => stat(progress.ear, i.id).attempts > 0);
  const earAcc = earSeen.length ? Math.round((earSeen.reduce((a, i) => a + stat(progress.ear, i.id).correct, 0) / earSeen.reduce((a, i) => a + stat(progress.ear, i.id).attempts, 0)) * 100) : null;

  const exportFile = () => {
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guitarpulse-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importFile = async (f: File) => {
    const r = importProgress(progress, await f.text());
    if (r.ok) {
      replace(r.progress);
      setImportMsg({ tone: 'success', text: `Merged: you now have ${r.progress.sessions.length} sessions on this device.` });
    } else setImportMsg({ tone: 'error', text: r.error });
  };

  return (
    <>
      <PageHeader
        eyebrow={today || 'GuitarPulse'}
        title={ready && progress.sessions.length ? 'Welcome back. Ready to play?' : 'Learn to improvise by playing'}
        description={ready && last ? `Last time: ${last.title}${last.focus ? `. You were working on ${last.focus.toLowerCase()}.` : '.'}` : 'Start with a backing track, follow the learning path, or let the coach listen to you play. Everything works offline and stays on this device.'}
        actions={
          <Link href={lastCoach ? `/coach` : '/path'} className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink shadow-[0_8px_24px_-8px_rgb(34_211_238/0.6)]">
            {lastCoach ? 'Practise with the coach' : 'Find your starting point'} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card as="div">
          <Stat
            label="Streak"
            value={
              <span className="inline-flex items-center gap-1.5">
                <Flame className={cx('h-5 w-5', streak ? 'text-amber-400' : 'text-faint')} aria-hidden />
                {streak} day{streak === 1 ? '' : 's'}
              </span>
            }
            sub={`Best ${progress.streak.best}`}
          />
        </Card>
        <Card as="div">
          <Stat label="Time played" value={`${Math.round(progress.totals.minutes)} min`} sub={`${progress.totals.sessions} sessions`} />
        </Card>
        <Card as="div">
          <Stat label="Ear accuracy" value={earAcc === null ? '–' : `${earAcc}%`} sub={`${earSeen.length} of ${ALL_ITEMS.length} sounds practised`} />
        </Card>
        <Card as="div">
          <Stat label="Coach sessions" value={progress.sessions.filter((s) => s.kind === 'coach').length} sub={lastCoach?.focus ? `Focus: ${lastCoach.focus}` : 'No report yet'} />
        </Card>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <li key={f.href} className="animate-rise" style={{ animationDelay: `${i * 35}ms` }}>
              <Link href={f.href} className="glass group flex h-full flex-col gap-2 rounded-2xl p-4 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-accent/40">
                <span className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  {f.tag && <span className="rounded-full bg-warm/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-amber-300">{f.tag}</span>}
                </span>
                <span className="font-semibold text-ink">{f.title}</span>
                <span className="text-sm leading-relaxed text-muted">{f.text}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Coach trends" subtitle="Your last coached sessions, oldest to newest.">
          <ul className="grid gap-3">
            {TRENDS.map((m) => {
              const values = metricTrend(progress, m).map((t) => t.value);
              const t = METRIC_TARGETS[m];
              return (
                <li key={m} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 text-sm text-ink">
                    {t.label}
                    {values.length > 0 && <span className="block text-xs text-faint">latest {values[values.length - 1]}{t.unit ? ` ${t.unit}` : ''}</span>}
                  </span>
                  <Sparkline values={values} label={t.label} better={t.better} />
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title="Recent sessions">
          {progress.sessions.length === 0 ? (
            <p className="text-sm text-muted">Sessions you play show up here: tracks, coach reports, trades, songs and ear drills.</p>
          ) : (
            <ul className="grid gap-2">
              {[...progress.sessions]
                .reverse()
                .slice(0, 7)
                .map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate text-ink">{s.title}</span>
                      <span className="text-xs text-faint">
                        {new Date(s.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {Math.max(1, Math.round(s.durationSec / 60))} min{s.ear ? ` · ${s.ear.correct}/${s.ear.answered} right` : ''}
                        {s.notesPlayed ? ` · ${s.notesPlayed} notes` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs capitalize text-muted">{s.kind}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Your data" className="mt-4" subtitle="Progress lives in this browser. Export it to keep a copy or to move it to another device, where importing merges the two.">
        {!persistent && (
          <div className="mb-3">
            <Notice tone="warn">This browser is blocking storage (often a private window), so progress lasts until you close the tab. Export before leaving.</Notice>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportFile}>
            <Download className="h-4 w-4" aria-hidden /> Export progress
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden /> Import and merge
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Progress file to import" onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])} />
          {confirmReset ? (
            <Button
              variant="danger"
              onClick={() => {
                replace(emptyProgress());
                setConfirmReset(false);
                setImportMsg({ tone: 'success', text: 'Progress erased.' });
              }}
            >
              Tap again to erase everything
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmReset(true)}>
              Reset progress
            </Button>
          )}
        </div>
        {importMsg && (
          <div className="mt-3">
            <Notice tone={importMsg.tone}>{importMsg.text}</Notice>
          </div>
        )}
      </Card>
    </>
  );
}
