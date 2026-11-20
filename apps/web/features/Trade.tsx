'use client';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MicOff, Repeat2, Square } from 'lucide-react';
import { BeatClock } from '@guitarpulse/core/audio/micSession';
import type { TrackedNote } from '@guitarpulse/core/audio/noteTracker';
import type { NoteEvent } from '@guitarpulse/core/coach/metrics';
import { assignFingering, type Position } from '@guitarpulse/core/fingering';
import { getGroove, renderTrack } from '@guitarpulse/core/grooves';
import { addSession } from '@guitarpulse/core/progress';
import { decodeJam } from '@guitarpulse/core/session';
import { getTuning } from '@guitarpulse/core/theory/notes';
import { findScale } from '@guitarpulse/core/theory/scales';
import { compareReply, respondTo, TECHNIQUES, type ReplyFeedback, type TradeResponse } from '@guitarpulse/core/trading';
import { Fretboard } from '@/components/Fretboard';
import { useAnnounce, useAudio, useProgress } from '@/components/Providers';
import { ChordStrip, NoteMeter, PianoRoll, SettingsPanel } from '@/components/session';
import { Badge, Button, Card, cx, Notice, PageHeader, Segmented } from '@/components/ui';
import { peekEngine, type Engine } from '@/lib/audio/engine';
import { createListener, MIC_MESSAGES, type Listener } from '@/lib/audio/mic';
import { scaleMarks } from '@/lib/marks';
import { newSessionId } from '@/lib/progressStore';
import { defaultSettings, grooveChords, loopLength, settingsFromSession, unrollChords, type JamSettings } from '@/lib/settings';
import { barInWindow, decisionBeat, notesInWindow, turnFor, windowIndex, windowStart, WINDOW_BEATS } from '@/lib/trade';

const STANDARD = getTuning('standard');

interface Round {
  window: number;
  heard: NoteEvent[];
  answer: TradeResponse;
  positions: Position[];
  reply: NoteEvent[] | null;
  feedback: ReplyFeedback | null;
}

/** Absolute beat being heard (counted across loops), updated every frame. */
function useAbsoluteBeat(engine: Engine | null, clock: BeatClock | null, running: boolean) {
  const [beat, setBeat] = useState<number | null>(null);
  useEffect(() => {
    if (!engine || !clock || !running) {
      setBeat(null);
      return;
    }
    let raf = 0;
    const loop = () => {
      setBeat(Math.round(((engine.ctx.currentTime - engine.outputLatency - clock.transportStart) * clock.bpm) / 60 * 16) / 16);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, clock, running]);
  return beat;
}

export function Trade() {
  const params = useSearchParams();
  const fromLink = useMemo(() => {
    const code = params.get('s');
    const r = code ? decodeJam(code) : null;
    return r && r.ok ? r.session : null;
  }, [params]);
  const { engine, ensure } = useAudio();
  const { update } = useProgress();
  const announce = useAnnounce();
  const [settings, setSettings] = useState<JamSettings>(() => (fromLink ? settingsFromSession(fromLink) : defaultSettings('city-pop')));
  const [who, setWho] = useState<'you' | 'app'>('you');
  const [running, setRunning] = useState(false);
  const [micless, setMicless] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micBlocked, setMicBlocked] = useState(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [meter, setMeter] = useState<{ midi: number; cents: number } | null>(null);
  const [clock, setClock] = useState<BeatClock | null>(null);
  const notes = useRef<NoteEvent[]>([]);
  const listener = useRef<Listener | null>(null);
  const timer = useRef<number | null>(null);
  const handled = useRef(new Set<string>());
  const answers = useRef(new Map<number, Round>());
  const roundNo = useRef(0);
  const startedAt = useRef(0);
  const seed = useRef(1);
  const clockRef = useRef<BeatClock | null>(null);

  const groove = getGroove(settings.grooveId);
  const chords = useMemo(() => grooveChords(settings), [settings]);
  const loopBeats = useMemo(() => loopLength(chords), [chords]);
  const abs = useAbsoluteBeat(engine, clock, running);
  const youStart = who === 'you';
  const win = abs === null ? null : abs < 0 ? -1 : windowIndex(abs);
  const turn = win === null || win < 0 ? null : turnFor(win, youStart);
  const bar = abs === null ? 0 : barInWindow(abs);

  const onNote = useCallback((n: TrackedNote) => {
    const c = clockRef.current;
    if (!c) return;
    const onset = c.toBeat(n.onsetTime);
    if (onset < -0.25) return;
    notes.current.push({ midi: n.midi, onsetBeat: Math.max(0, onset), durationBeats: (n.duration * c.bpm) / 60, peakBendCents: n.peakBendCents });
  }, []);
  const onAttack = useCallback((n: TrackedNote) => setMeter({ midi: n.midi, cents: n.cents }), []);

  const stopAll = useCallback(() => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    listener.current?.stop();
    listener.current = null;
    peekEngine()?.reset();
  }, []);
  useEffect(() => stopAll, [stopAll]);

  const tick = useCallback(
    (e: Engine, s: JamSettings, startsWithYou: boolean, decisionClock: BeatClock, withoutMic: boolean) => {
      const now = ((e.ctx.currentTime - decisionClock.transportStart) * s.bpm) / 60;
      const ch = grooveChords(s);
      const len = loopLength(ch);
      // Answer: decide in the last three-quarters of a beat before GuitarPulse's window starts.
      // If that moment was missed (a throttled background tab), the window is skipped rather
      // than answered late.
      const target = windowIndex(Math.max(0, now + 0.75));
      if (now + 0.75 >= 0 && now >= decisionBeat(target - 1) && now < windowStart(target) && turnFor(target, startsWithYou) === 'app' && !handled.current.has(`a${target}`)) {
        handled.current.add(`a${target}`);
        const heard = target > 0 ? notesInWindow(notes.current, target - 1) : [];
        const ws = windowStart(target);
        const answer = respondTo(heard, { chords: unrollChords(ch, len, ws, ws + WINDOW_BEATS), windowStart: ws, key: s.key, scale: s.scale, round: roundNo.current, seed: seed.current });
        roundNo.current++;
        e.addLead(
          answer.notes.map((n) => ({ midi: n.midi, onsetBeat: n.onsetBeat - ws, durationBeats: n.durationBeats, velocity: 0.85 })),
          ws,
          false,
        );
        const positions = assignFingering(answer.notes.map((n) => [n.midi]), { tuning: STANDARD, maxFret: 22 }).map((p) => p[0]);
        const round: Round = { window: target, heard, answer, positions, reply: null, feedback: null };
        answers.current.set(target, round);
        setRounds((r) => [...r, round]);
      }
      // Feedback: your reply window has ended and it followed one of GuitarPulse's answers.
      const done = windowIndex(Math.max(0, now - 0.25)) - 1;
      if (done >= 1 && turnFor(done, startsWithYou) === 'you' && !handled.current.has(`f${done}`) && answers.current.has(done - 1)) {
        handled.current.add(`f${done}`);
        const prev = answers.current.get(done - 1)!;
        const reply = notesInWindow(notes.current, done);
        const ws = windowStart(done);
        const feedback = withoutMic ? null : compareReply(prev.answer.motif, reply, unrollChords(ch, len, ws, ws + WINDOW_BEATS), ws);
        const updated = { ...prev, reply, feedback };
        answers.current.set(done - 1, updated);
        setRounds((r) => r.map((x) => (x.window === done - 1 ? updated : x)));
        if (feedback) announce(feedback.comment);
      }
    },
    [announce],
  );

  const start = async (withoutMic: boolean) => {
    setError(null);
    setMicBlocked(false);
    const e = await ensure();
    notes.current = [];
    handled.current = new Set();
    answers.current = new Map();
    roundNo.current = 0;
    seed.current = Math.floor(Math.random() * 1e6);
    setRounds([]);
    setMeter(null);
    let latency = 0;
    if (!withoutMic) {
      const l = createListener(e.ctx, onNote, onAttack);
      const err = await l.start();
      if (err) {
        setError(MIC_MESSAGES[err]);
        setMicBlocked(err === 'mic-denied' || err === 'mic-unavailable');
        return;
      }
      listener.current = l;
      latency = l.latency;
    }
    setMicless(withoutMic);
    const track = renderTrack(groove, chords);
    e.prepare({ bpm: settings.bpm, loopBeats: track.lengthBeats, countInBars: 1 });
    e.addBacking(track);
    const t0 = e.start();
    const heardClock = new BeatClock(t0, settings.bpm, latency);
    clockRef.current = heardClock;
    setClock(heardClock);
    const decisionClock = new BeatClock(t0, settings.bpm, 0);
    const s = settings;
    const startsWithYou = youStart;
    timer.current = window.setInterval(() => tick(e, s, startsWithYou, decisionClock, withoutMic), 25);
    startedAt.current = Date.now();
    setRunning(true);
    announce(startsWithYou ? 'Count-in. You play the first four bars.' : 'Count-in. GuitarPulse plays first; answer in the next four bars.');
  };

  const stop = () => {
    stopAll();
    setRunning(false);
    const durationSec = Math.round((Date.now() - startedAt.current) / 1000);
    if (durationSec >= 20) {
      update((p) =>
        addSession(p, {
          id: newSessionId(),
          kind: 'trade',
          startedAt: startedAt.current,
          durationSec,
          title: `Trading fours: ${groove.name} in ${settings.key}`,
          groove: settings.grooveId,
          key: settings.key,
          notesPlayed: notes.current.length,
        }),
      );
    }
    announce('Stopped trading.');
  };

  // What GuitarPulse is playing right now, for the fretboard.
  const appNow = useMemo(() => {
    if (abs === null || turn !== 'app') return [];
    const r = answers.current.get(win!);
    if (!r) return [];
    const i = r.answer.notes.findIndex((n) => abs >= n.onsetBeat && abs < n.onsetBeat + n.durationBeats);
    return i >= 0 && r.positions[i] ? [{ string: r.positions[i].string, fret: r.positions[i].fret, tone: 'app' as const }] : [];
  }, [abs, turn, win]);
  const marks = useMemo(() => scaleMarks({ root: settings.key, scale: settings.scale }).map((m) => ({ ...m, emphasis: 'dim' as const })), [settings.key, settings.scale]);
  const scaleName = findScale(settings.scale)?.name ?? settings.scale;

  return (
    <>
      <PageHeader
        eyebrow="Trade fours"
        title="A jam partner that answers your ideas"
        description="You play four bars. GuitarPulse answers with four bars built from your first idea: moved, flipped, displaced, stretched or chopped up, always landing on the chord. Then you answer back. It is how jazz and blues players learn to listen while they play."
      />
      {error && (
        <div className="mb-4 grid gap-3">
          <Notice tone="error">{error}</Notice>
          {micBlocked && (
            <div>
              <Button onClick={() => void start(true)}>
                <MicOff className="h-4 w-4" aria-hidden /> Trade without the microphone
              </Button>
              <p className="mt-1.5 text-xs text-faint">GuitarPulse plays its four bars and you play yours; it just can’t hear you, so it invents its ideas.</p>
            </div>
          )}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 content-start gap-4">
          <Card
            title={running ? (turn === null ? 'Count-in' : turn === 'you' ? 'Your four bars' : 'GuitarPulse answers') : 'Ready to trade'}
            subtitle={running ? `${groove.name} in ${settings.key} · ${settings.bpm} BPM${micless ? ' · without microphone' : ''}` : `${who === 'you' ? 'You start' : 'GuitarPulse starts'}; turns change every four bars.`}
            actions={
              running ? (
                <Button variant="warm" size="lg" onClick={stop}>
                  <Square className="h-4 w-4 fill-current" aria-hidden /> Stop
                </Button>
              ) : (
                <Button variant="primary" size="lg" onClick={() => void start(false)}>
                  <Repeat2 className="h-4 w-4" aria-hidden /> Start trading
                </Button>
              )
            }
          >
            <div className="grid gap-4">
              <div className={cx('flex items-center justify-between gap-4 rounded-2xl border px-4 py-4 transition-colors', !running || turn === null ? 'border-line' : turn === 'you' ? 'border-accent/60 bg-accent/10' : 'border-warm/60 bg-warm/10')}>
                <div>
                  <p className={cx('text-2xl font-semibold tracking-tight', turn === 'app' ? 'text-amber-300' : 'text-accent')}>{!running ? 'Press Start' : turn === null ? (abs !== null ? `${Math.max(1, Math.ceil(-abs))}…` : '…') : turn === 'you' ? 'Your turn' : 'Listen'}</p>
                  <p className="mt-0.5 text-sm text-muted">{!running ? 'One bar of clicks first.' : turn === 'you' ? 'Play a short idea, then develop it.' : turn === 'app' ? 'Hear what changes; you answer next.' : 'Get ready.'}</p>
                </div>
                <ol className="flex gap-2" aria-label="Bar in this turn">
                  {[1, 2, 3, 4].map((b) => (
                    <li key={b} aria-current={bar === b ? 'step' : undefined} className={cx('h-3.5 w-3.5 rounded-full border', bar >= b && running && turn !== null ? (turn === 'you' ? 'border-accent bg-accent' : 'border-warm bg-warm') : 'border-line')} />
                  ))}
                </ol>
              </div>
              {!micless && <NoteMeter midi={meter?.midi ?? null} cents={meter?.cents ?? 0} listening={running && turn === 'you'} />}
              <ChordStrip chords={chords} loopBeats={loopBeats} beat={abs === null ? null : abs} />
            </div>
          </Card>
          <Card title={`${settings.key} ${scaleName}`} subtitle="Amber shows where GuitarPulse’s answer sits on the neck as it plays.">
            <Fretboard tuning={STANDARD} marks={marks} active={appNow} label={`${settings.key} ${scaleName} with GuitarPulse’s current note`} />
          </Card>
          {rounds.length > 0 && (
            <Card title="Transcript" subtitle="Cyan is you, amber is GuitarPulse.">
              <ol className="grid gap-4">
                {[...rounds].reverse().map((r, i) => (
                  <li key={r.window} className="grid gap-2 rounded-xl border border-line p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">Round {rounds.length - i}</span>
                      <Badge tone="warm">{r.answer.technique}</Badge>
                      {r.feedback && <Badge tone={r.feedback.landedOnChordTone ? 'good' : 'neutral'}>{r.feedback.landedOnChordTone ? 'landed on a chord tone' : 'ended off the chord'}</Badge>}
                    </div>
                    <PianoRoll
                      notes={[...r.heard.map((n) => ({ ...n, who: 'you' as const })), ...r.answer.notes.map((n) => ({ ...n, who: 'app' as const })), ...(r.reply ?? []).map((n) => ({ ...n, who: 'you' as const }))]}
                      fromBeat={windowStart(r.window - 1)}
                      beats={WINDOW_BEATS * 3}
                      playhead={abs}
                      height={84}
                      label={`Round ${rounds.length - i}: your phrase, the answer and your reply`}
                    />
                    <p className="text-sm text-muted">{r.answer.description}</p>
                    {r.feedback && (
                      <div className="grid gap-1 text-sm">
                        <p className="text-ink">{r.feedback.comment}</p>
                        <p className="text-xs text-faint">
                          Rhythm reused {Math.round(r.feedback.rhythm * 100)}% · shape reused {Math.round(r.feedback.contour * 100)}% · space {Math.round(r.feedback.space * 100)}%
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
        <div className="grid content-start gap-4">
          <Card title="Who starts">
            <Segmented label="Who plays first" value={who} onChange={(v) => !running && setWho(v)} options={[{ value: 'you', label: 'I start' }, { value: 'app', label: 'GuitarPulse starts' }]} />
            <p className="mt-2 text-xs text-faint">Answers cycle through {TECHNIQUES.join(', ')}.</p>
          </Card>
          <Card title="Track">
            <SettingsPanel value={settings} onChange={setSettings} disabled={running} lockTempo={running} />
          </Card>
        </div>
      </div>
    </>
  );
}
