'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Clock, Mic, Music } from 'lucide-react';
import { GROOVES } from '@guitarpulse/core/grooves';
import { generatePracticePlan, GOALS, type Goal } from '@guitarpulse/core/practice/plan';
import { Badge, Card, cx, Field, PageHeader, Select, Slider } from '@/components/ui';
import { canonicalKey, linkFor, type JamSettings } from '@/lib/settings';

const LEVELS = [
  'Minor pentatonic, box 1',
  'Bends and vibrato',
  'Call-and-response phrasing',
  'Connecting the five boxes',
  'Mixing major and minor pentatonic',
  'Chord tones and arpeggios',
  'Modes over vamps',
  'ii–V–I and enclosures',
  'Playing outside and back',
];
const STORE = 'guitarpulse-path';

export function Path() {
  const [level, setLevel] = useState(1);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [minutes, setMinutes] = useState(30);
  const [weeks, setWeeks] = useState(8);
  const [open, setOpen] = useState(1);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORE) ?? 'null') as { level?: number; goals?: Goal[]; minutes?: number; weeks?: number } | null;
      if (saved) {
        if (saved.level) setLevel(saved.level);
        if (saved.goals) setGoals(saved.goals.filter((g) => (GOALS as readonly string[]).includes(g)));
        if (saved.minutes) setMinutes(saved.minutes);
        if (saved.weeks) setWeeks(saved.weeks);
      }
    } catch {
      // Ignore unreadable saved choices.
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(STORE, JSON.stringify({ level, goals, minutes, weeks }));
    } catch {
      // Storage may be blocked; the plan still works for this visit.
    }
  }, [level, goals, minutes, weeks]);
  const plan = useMemo(() => generatePracticePlan({ level, goals, minutesPerDay: minutes, weeks }), [level, goals, minutes, weeks]);

  return (
    <>
      <PageHeader
        eyebrow="Learning path"
        title="The shortest road from scales to music"
        description="One skill a week, in the order players actually learn: one box, then bends, phrasing, the whole neck, chord tones, modes and jazz. Every week comes with a track, two new licks, review licks and a coach target that tells you when you are ready to move on."
      />
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Card title="Where you are" className="content-start lg:sticky lg:top-20">
          <div className="grid gap-4">
            <Field label="Your level">
              {(id) => (
                <Select id={id} value={level} onChange={(e) => setLevel(Number(e.target.value))}>
                  {LEVELS.map((l, i) => (
                    <option key={l} value={i + 1}>
                      {i + 1}. {l}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">Goals</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Goals">
                {GOALS.map((g) => {
                  const on = goals.includes(g);
                  return (
                    <button key={g} type="button" aria-pressed={on} onClick={() => setGoals((x) => (on ? x.filter((y) => y !== g) : [...x, g].slice(-6)))} className={cx('cursor-pointer rounded-full border px-2.5 py-1 text-xs', on ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line text-muted hover:text-ink')}>
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
            <Field label="Minutes a day">{(id) => <Slider id={id} label="Minutes per day" value={minutes} min={10} max={120} step={5} onChange={setMinutes} format={(v) => `${v} min`} />}</Field>
            <Field label="Weeks">{(id) => <Slider id={id} label="Number of weeks" value={weeks} min={1} max={16} onChange={setWeeks} format={(v) => `${v} wk`} />}</Field>
          </div>
        </Card>
        <div className="grid min-w-0 content-start gap-4">
          <Card title="Every practice day" subtitle={`${plan.summary.minutesPerDay} minutes, ${plan.summary.daysPerWeek} days a week. ${plan.summary.restDay}`}>
            <ol className="grid gap-2 sm:grid-cols-2">
              {plan.dailyRoutine.map((b) => (
                <li key={b.block} className="flex gap-3 rounded-xl border border-line px-3 py-2.5">
                  <span className="tabular flex h-9 w-12 shrink-0 items-center justify-center rounded-lg bg-accent/10 font-mono text-sm font-semibold text-accent">
                    <Clock className="mr-1 h-3.5 w-3.5" aria-hidden />
                    {b.minutes}
                  </span>
                  <span className="text-sm">
                    <span className="font-medium capitalize text-ink">{b.block}</span>
                    <span className="block text-muted">{b.what}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>
          <ol className="grid gap-3">
            {plan.weeks.map((w) => {
              const groove = GROOVES.find((g) => g.id === w.track.genre);
              const expanded = open === w.week;
              const settings: JamSettings | null = groove
                ? { grooveId: groove.id, progression: Math.min(w.track.progressionIndex, groove.progressions.length - 1), key: canonicalKey(w.track.key), bpm: Math.max(40, w.track.startBpm || groove.bpm.default), scale: groove.scales[0] }
                : null;
              return (
                <li key={w.week} className="glass overflow-hidden rounded-2xl">
                  <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? 0 : w.week)} className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left sm:px-5">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="tabular grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line font-mono text-sm text-muted">{w.week}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">{w.title}</span>
                        <span className="block truncate text-sm text-muted">{w.focus}</span>
                      </span>
                    </span>
                    {groove && <Badge>{groove.name}</Badge>}
                  </button>
                  {expanded && (
                    <div className="grid gap-3 border-t border-line px-4 py-4 text-sm sm:px-5">
                      <p className="leading-relaxed text-ink">{w.exercise}</p>
                      {settings && (
                        <p className="text-muted">
                          Track: {groove!.name} in {settings.key}, {w.track.progression}. Start at {w.track.startBpm} BPM and work up to {w.track.targetBpm}.
                        </p>
                      )}
                      <p className="text-muted">
                        Ready to move on when: {w.coachTarget.label} {w.coachTarget.target}.
                      </p>
                      {w.newLicks.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted">New licks:</span>
                          {w.newLicks.map((l) => (
                            <Link key={l.id} href={`/licks?id=${encodeURIComponent(l.id)}`} className="rounded-lg border border-line px-2 py-1 text-ink hover:border-accent/50">
                              {l.title} <span className="text-muted">({l.artist})</span>
                            </Link>
                          ))}
                        </div>
                      )}
                      {w.reviewLicks.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted">Review:</span>
                          {w.reviewLicks.map((id) => (
                            <Link key={id} href={`/licks?id=${encodeURIComponent(id)}`} className="rounded-lg border border-line px-2 py-1 font-mono text-xs text-ink hover:border-accent/50">
                              {id}
                            </Link>
                          ))}
                        </div>
                      )}
                      {settings && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Link href={linkFor('studio', settings, { focus: w.focus.slice(0, 200), licks: w.newLicks.map((l) => l.id).slice(0, 6) })} className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-ink hover:border-accent/50 hover:bg-accent/5">
                            <Music className="h-4 w-4 text-accent" aria-hidden /> Open the track
                          </Link>
                          <Link href={linkFor('coach', settings, { focus: w.focus.slice(0, 200) })} className="inline-flex h-9 items-center gap-2 rounded-xl bg-accent px-3 font-medium text-accent-ink">
                            <Mic className="h-4 w-4" aria-hidden /> Practise with the coach
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <Card title="How to use it">
            <ul className="grid gap-1.5 text-sm text-muted">
              {plan.howToUse.map((h) => (
                <li key={h}>• {h}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
