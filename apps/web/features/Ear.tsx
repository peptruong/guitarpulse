'use client';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ear as EarIcon, Play, RotateCcw, Timer } from 'lucide-react';
import { ALL_ITEMS, EarSession, LEVELS, stat, unlockedItems, type EarItem, type EarMode, type EarSummary, type Question } from '@guitarpulse/core/ear';
import { addSession, withEar } from '@guitarpulse/core/progress';
import { decodeJam } from '@guitarpulse/core/session';
import { useAnnounce, useAudio, useProgress } from '@/components/Providers';
import { Badge, Button, Card, cx, Kbd, PageHeader, Segmented, Stat } from '@/components/ui';
import { newSessionId } from '@/lib/progressStore';

type Phase = 'setup' | 'question' | 'answered' | 'summary';

export function Ear() {
  const params = useSearchParams();
  const fromLink = useMemo(() => {
    const code = params.get('s');
    const r = code ? decodeJam(code) : null;
    return r && r.ok && r.session.ear ? r.session.ear : null;
  }, [params]);
  const { progress, update, ready } = useProgress();
  const { ensure } = useAudio();
  const announce = useAnnounce();
  const [mode, setMode] = useState<EarMode>(fromLink?.mode ?? 'interval');
  const [minutes, setMinutes] = useState(fromLink?.minutes ?? 5);
  const [phase, setPhase] = useState<Phase>('setup');
  const [question, setQuestion] = useState<Question | null>(null);
  const [last, setLast] = useState<{ correct: boolean; answer: EarItem; chosen: string; unlockedNew: boolean } | null>(null);
  const [summary, setSummary] = useState<EarSummary | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const session = useRef<EarSession | null>(null);
  const startedAt = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const play = useCallback(
    async (q: Question) => {
      const e = await ensure();
      if (q.style === 'harmonic' || q.style === 'block') e.playNow(q.midis, 'together');
      else e.playNow(q.midis, 'sequence', q.item.kind === 'chord' ? 0.32 : 0.6);
    },
    [ensure],
  );

  const finish = useCallback(() => {
    const s = session.current;
    if (!s) return;
    const sum = s.summary();
    const ear = s.finish();
    session.current = null;
    const durationSec = Math.round((Date.now() - startedAt.current) / 1000);
    update((p) => addSession(withEar(p, ear), { id: newSessionId(), kind: 'ear', startedAt: startedAt.current, durationSec, title: `Ear training: ${mode === 'mixed' ? 'intervals and chords' : `${mode}s`}`, ear: { correct: sum.correct, answered: sum.answered } }));
    setSummary(sum);
    setPhase('summary');
    announce(`Time is up. ${sum.correct} of ${sum.answered} correct.`);
  }, [announce, mode, update]);

  const next = useCallback(() => {
    const s = session.current;
    if (!s) return;
    const q = s.next();
    if (!q) {
      finish();
      return;
    }
    setQuestion(q);
    setLast(null);
    setPhase('question');
    void play(q);
  }, [finish, play]);

  const start = async () => {
    await ensure();
    session.current = new EarSession(progress.ear, mode, () => Date.now(), Math.random, minutes * 60_000);
    startedAt.current = Date.now();
    setSummary(null);
    next();
  };

  const answer = useCallback(
    (id: string) => {
      const s = session.current;
      if (!s || phase !== 'question') return;
      const r = s.answer(id);
      setLast({ correct: r.correct, answer: r.answer, chosen: id, unlockedNew: r.unlockedNew });
      setPhase('answered');
      announce(r.correct ? `Correct: ${r.answer.label}` : `It was ${r.answer.label}`);
      if (r.correct) window.setTimeout(() => session.current && phaseRef.current === 'answered' && next(), 900);
    },
    [announce, next, phase],
  );

  // Timer
  useEffect(() => {
    if (phase !== 'question' && phase !== 'answered') return;
    const id = window.setInterval(() => {
      const s = session.current;
      if (!s) return;
      setTimeLeft(s.timeLeftMs);
      if (s.done && phaseRef.current === 'answered') finish();
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, finish]);

  // Keyboard: number keys answer, R replays, Enter or Space goes on.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (!question) return;
      if (phase === 'question' && /^[1-9]$/.test(e.key)) {
        const choice = question.choices[Number(e.key) - 1];
        if (choice) answer(choice.id);
      } else if (e.key.toLowerCase() === 'r') void play(question);
      else if ((e.key === 'Enter' || e.key === ' ') && phase === 'answered') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, next, phase, play, question]);

  useEffect(() => () => void (session.current = null), []);

  const kinds = mode === 'mixed' ? (['interval', 'chord'] as const) : ([mode] as const);
  const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

  return (
    <>
      <PageHeader eyebrow="Pocket ear trainer" title="Five minutes a day to hear what you play" description="Name intervals and chord qualities by ear. Sounds you miss come back sooner; sounds you know come back less often. New ones unlock when the current set is solid, and your results go into the same progress record as your jams." />
      {phase === 'setup' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card title="Drill" actions={<Button variant="primary" size="lg" onClick={() => void start()} disabled={!ready}><Play className="h-4 w-4 fill-current" aria-hidden /> Start</Button>}>
            <div className="grid gap-4">
              <Segmented label="What to drill" value={mode} onChange={setMode} options={[{ value: 'interval', label: 'Intervals' }, { value: 'chord', label: 'Chord qualities' }, { value: 'mixed', label: 'Both' }]} />
              <Segmented label="Length" value={String(minutes) as '3' | '5' | '10'} onChange={(v) => setMinutes(Number(v))} options={[{ value: '3', label: '3 min' }, { value: '5', label: '5 min' }, { value: '10', label: '10 min' }]} />
              <p className="text-sm text-muted">
                Keys: <Kbd>1</Kbd>–<Kbd>9</Kbd> answer, <Kbd>R</Kbd> replays, <Kbd>Enter</Kbd> goes on.
              </p>
            </div>
          </Card>
          <ItemsCard kinds={[...kinds]} />
        </div>
      )}

      {(phase === 'question' || phase === 'answered') && question && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <EarIcon className="h-4 w-4 text-accent" aria-hidden /> {question.item.kind === 'interval' ? `Which interval? (${question.style})` : `Which chord? (${question.style === 'block' ? 'together' : 'one note at a time'})`}
            </span>
          }
          actions={
            <span className="tabular inline-flex items-center gap-1.5 font-mono text-sm text-muted">
              <Timer className="h-4 w-4" aria-hidden /> {mmss(timeLeft)}
            </span>
          }
        >
          <div className="grid gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => void play(question)}>
                <RotateCcw className="h-4 w-4" aria-hidden /> Play again
              </Button>
              {phase === 'answered' && (
                <Button variant="primary" size="lg" onClick={next}>
                  Next
                </Button>
              )}
              {phase === 'answered' && last && (
                <p role="status" className={cx('text-base font-semibold', last.correct ? 'text-emerald-300' : 'text-rose-300')}>
                  {last.correct ? `Yes: ${last.answer.label}` : `It was ${last.answer.label}`}
                  {last.unlockedNew && <span className="ml-2 font-normal text-accent">New sounds unlocked</span>}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="group" aria-label="Answers">
              {question.choices.map((c, i) => {
                const isAnswer = phase === 'answered' && c.id === question.item.id;
                const wrongPick = phase === 'answered' && last && !last.correct && c.id === last.chosen;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={phase !== 'question'}
                    onClick={() => answer(c.id)}
                    className={cx(
                      'flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-4 py-3.5 text-left transition-colors disabled:cursor-default',
                      isAnswer ? 'border-emerald-400/60 bg-emerald-400/10' : wrongPick ? 'border-rose-400/60 bg-rose-400/10' : 'border-line bg-surface/60 hover:border-accent/50 hover:bg-accent/5',
                    )}
                  >
                    <span>
                      <span className="block text-sm font-medium text-ink">{c.label}</span>
                      <span className="font-mono text-xs text-muted">{c.short}</span>
                    </span>
                    <Kbd>{i + 1}</Kbd>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={finish}>
                End now
              </Button>
            </div>
          </div>
        </Card>
      )}

      {phase === 'summary' && summary && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card title="Session done" actions={<Button variant="primary" onClick={() => setPhase('setup')}>Another round</Button>}>
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Answered" value={summary.answered} />
              <Stat label="Correct" value={summary.correct} />
              <Stat label="Accuracy" value={`${Math.round(summary.accuracy * 100)}%`} />
            </div>
            {summary.hardest.length > 0 && (
              <p className="mt-4 text-sm text-muted">
                Hardest today: {summary.hardest.map((h) => `${h.label} (${Math.round(h.accuracy * 100)}%)`).join(', ')}. They will come back first next time.
              </p>
            )}
            {summary.unlocked.length > 0 && <p className="mt-2 text-sm text-accent">Unlocked: {summary.unlocked.join(', ')}.</p>}
          </Card>
          <ItemsCard kinds={[...kinds]} />
        </div>
      )}
    </>
  );
}

function ItemsCard({ kinds }: { kinds: ('interval' | 'chord')[] }) {
  const { progress } = useProgress();
  return (
    <Card title="Your sounds" subtitle="Bars show each sound’s box: five means you know it cold.">
      {kinds.map((k) => {
        const open = unlockedItems(progress.ear, k);
        const locked = LEVELS[k].slice(progress.ear.unlocked[k]).flat().length;
        return (
          <div key={k} className="mb-3 last:mb-0">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">{k === 'interval' ? 'Intervals' : 'Chords'}</p>
            <ul className="grid gap-1.5">
              {open.map((item) => {
                const st = stat(progress.ear, item.id);
                return (
                  <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink">{item.label}</span>
                    <span className="flex items-center gap-2">
                      {st.attempts > 0 && <span className="tabular text-xs text-faint">{Math.round((st.correct / st.attempts) * 100)}%</span>}
                      <span className="flex gap-0.5" aria-label={`Box ${st.box} of 5`}>
                        {[1, 2, 3, 4, 5].map((b) => (
                          <span key={b} className={cx('h-2 w-3 rounded-sm', st.attempts > 0 && b <= st.box ? 'bg-accent' : 'bg-white/10')} />
                        ))}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            {locked > 0 && <Badge className="mt-2">{locked} more to unlock</Badge>}
          </div>
        );
      })}
      <p className="mt-2 text-xs text-faint">{ALL_ITEMS.length} sounds in all.</p>
    </Card>
  );
}
