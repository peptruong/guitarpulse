'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, RotateCcw, Sparkles, Square } from 'lucide-react';
import { BeatClock } from '@guitarpulse/core/audio/micSession';
import type { TrackedNote } from '@guitarpulse/core/audio/noteTracker';
import { assessSession, type ChordSpan } from '@guitarpulse/core/coach/assess';
import { METRIC_TARGETS, type NoteEvent } from '@guitarpulse/core/coach/metrics';
import { boxReport, candidatesFor, heatmap, type BoxReport } from '@guitarpulse/core/fingering';
import { getGroove, renderTrack } from '@guitarpulse/core/grooves';
import { addSession } from '@guitarpulse/core/progress';
import { decodeJam } from '@guitarpulse/core/session';
import { getTuning, midiName } from '@guitarpulse/core/theory/notes';
import { findScale } from '@guitarpulse/core/theory/scales';
import { DegreeLegend, Fretboard, type FretMark } from '@/components/Fretboard';
import { useAnnounce, useAudio, useProgress } from '@/components/Providers';
import { ChordStrip, NoteMeter, PianoRoll, SettingsPanel } from '@/components/session';
import { Badge, Button, Card, Field, Notice, PageHeader, Select, Slider } from '@/components/ui';
import { peekEngine } from '@/lib/audio/engine';
import { createListener, MIC_MESSAGES, type Listener } from '@/lib/audio/mic';
import { askClaude } from '@/lib/askClaude';
import { browserStorage, cleanKey, forgetKey, loadKey, saveKey } from '@/lib/claudeKey';
import type { CoachAdvice, CoachRequest } from '@/lib/coachPrompt';
import { useElapsed, useHeardBeat } from '@/lib/hooks';
import { scaleMarks } from '@/lib/marks';
import { newSessionId } from '@/lib/progressStore';
import { fretWindow, replayFrame, sortedForReplay, type ReplayNote } from '@/lib/replay';
import { boxKey, defaultSettings, grooveChords, isMinorScale, linkFor, loopLength, settingsFromSession, unrollChords, type JamSettings } from '@/lib/settings';

const STANDARD = getTuning('standard');
type Phase = 'setup' | 'starting' | 'listening' | 'report';

interface Result {
  settings: JamSettings;
  notes: NoteEvent[];
  chords: ChordSpan[];
  totalBeats: number;
  startedAt: number;
  durationSec: number;
  assessment: ReturnType<typeof assessSession>;
  replay: ReplayNote[];
  boxes: BoxReport | null;
}

export function Coach() {
  const params = useSearchParams();
  const fromLink = useMemo(() => {
    const code = params.get('s');
    const r = code ? decodeJam(code) : null;
    return r && r.ok ? r.session : null;
  }, [params]);
  const { engine, ensure } = useAudio();
  const { update } = useProgress();
  const announce = useAnnounce();
  const [settings, setSettings] = useState<JamSettings>(() => (fromLink ? settingsFromSession(fromLink) : defaultSettings('slow-blues')));
  const [choruses, setChoruses] = useState(2);
  const [phase, setPhase] = useState<Phase>('setup');
  const [error, setError] = useState<string | null>(null);
  const [meter, setMeter] = useState<{ midi: number; cents: number } | null>(null);
  const [noteCount, setNoteCount] = useState(0);
  const [liveMarks, setLiveMarks] = useState<FretMark[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const notesRef = useRef<NoteEvent[]>([]);
  const listenerRef = useRef<Listener | null>(null);
  const clockRef = useRef<BeatClock | null>(null);
  const stopTimer = useRef<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const chords = useMemo(() => grooveChords(settings), [settings]);
  const loopBeats = useMemo(() => loopLength(chords), [chords]);
  const listening = phase === 'listening';
  const beat = useHeardBeat(engine, listening);
  const elapsed = useElapsed(listening ? startedAt.current : null);
  const groove = getGroove(settings.grooveId);

  const onNote = useCallback((n: TrackedNote) => {
    const clock = clockRef.current;
    if (!clock) return;
    const onset = clock.toBeat(n.onsetTime);
    if (onset < -0.25) return; // during the count-in
    notesRef.current.push({ midi: n.midi, cents: n.cents, onsetBeat: Math.max(0, onset), durationBeats: (n.duration * clock.bpm) / 60, peakBendCents: n.peakBendCents });
    setNoteCount(notesRef.current.length);
  }, []);
  const onAttack = useCallback((n: TrackedNote) => setMeter({ midi: n.midi, cents: n.cents }), []);

  // While listening, the neck fills in where you play (refreshed once a second).
  useEffect(() => {
    if (!listening) return;
    const id = window.setInterval(() => {
      const playable = notesRef.current.filter((n) => candidatesFor(n.midi, STANDARD, 24).length > 0);
      const hm = heatmap(playable.slice(-400), 'standard');
      setLiveMarks(hm.cells.map((c) => ({ string: c.string, fret: c.fret, label: '', role: 'third', heat: c.weight })));
    }, 1000);
    return () => window.clearInterval(id);
  }, [listening]);

  const cleanup = useCallback(() => {
    if (stopTimer.current !== null) window.clearTimeout(stopTimer.current);
    stopTimer.current = null;
    listenerRef.current?.stop();
    listenerRef.current = null;
    peekEngine()?.reset();
  }, []);
  useEffect(() => cleanup, [cleanup]);

  const finish = useCallback(() => {
    const e = peekEngine();
    const clock = clockRef.current;
    if (!e || !clock || !listenerRef.current) return;
    const endBeat = clock.toBeat(e.ctx.currentTime);
    if (stopTimer.current !== null) window.clearTimeout(stopTimer.current);
    stopTimer.current = null;
    listenerRef.current.stop(); // reports the note that was still ringing
    listenerRef.current = null;
    e.stop();
    const began = startedAt.current ?? Date.now();
    const durationSec = Math.round((Date.now() - began) / 1000);
    const limit = choruses > 0 ? choruses * loopBeats : Number.POSITIVE_INFINITY;
    const totalBeats = Math.max(4, Math.min(limit, Math.ceil(Math.max(0, endBeat) / 4) * 4));
    const notes = notesRef.current.filter((n) => n.onsetBeat < totalBeats);
    if (notes.length < 3) {
      setError('I heard fewer than three notes. Check the input level: pluck a string and watch the note box, then start again.');
      setPhase('setup');
      return;
    }
    const spans = unrollChords(chords, loopBeats, 0, totalBeats);
    const keyName = `${settings.key}${isMinorScale(settings.scale) ? ' minor' : ''}`;
    const assessment = assessSession(notes, spans, settings.bpm, totalBeats, keyName, settings.scale);
    const playable = notes.filter((n) => candidatesFor(n.midi, STANDARD, 24).length > 0);
    const hm = heatmap(playable, 'standard');
    const replay = sortedForReplay(playable.map((n, i) => ({ midi: n.midi, onsetBeat: n.onsetBeat, durationBeats: n.durationBeats, string: hm.positions[i].string, fret: hm.positions[i].fret })));
    const bk = boxKey(settings.key, settings.scale);
    const boxes = hm.positions.length ? boxReport(hm.positions, bk.key, bk.minor) : null;
    const numeric = Object.fromEntries(Object.entries(assessment.metrics).filter(([, v]) => typeof v === 'number' || v === null)) as Record<string, number | null>;
    update((p) =>
      addSession(p, {
        id: newSessionId(),
        kind: 'coach',
        startedAt: began,
        durationSec,
        title: `${groove.name} in ${settings.key}`,
        groove: settings.grooveId,
        key: settings.key,
        metrics: numeric,
        focus: assessment.focus?.label,
        notesPlayed: notes.length,
      }),
    );
    setResult({ settings, notes, chords: spans, totalBeats, startedAt: began, durationSec, assessment, replay, boxes });
    setPhase('report');
    announce(`Session finished: ${notes.length} notes. ${assessment.focus ? `Work on: ${assessment.focus.label}.` : 'Every measure is in a healthy range.'}`);
  }, [announce, choruses, chords, groove.name, loopBeats, settings, update]);

  const start = async () => {
    setError(null);
    setPhase('starting');
    const e = await ensure();
    notesRef.current = [];
    setNoteCount(0);
    setMeter(null);
    setLiveMarks([]);
    const listener = createListener(e.ctx, onNote, onAttack);
    const err = await listener.start();
    if (err) {
      setError(MIC_MESSAGES[err]);
      setPhase('setup');
      return;
    }
    listenerRef.current = listener;
    const track = renderTrack(groove, chords);
    e.prepare({ bpm: settings.bpm, loopBeats: track.lengthBeats, countInBars: 1 });
    e.addBacking(track);
    const t0 = e.start();
    clockRef.current = new BeatClock(t0, settings.bpm, listener.latency);
    startedAt.current = Date.now();
    setPhase('listening');
    announce('Count-in, then play. The coach is listening.');
    if (choruses > 0) stopTimer.current = window.setTimeout(finish, (((4 + choruses * track.lengthBeats) * 60) / settings.bpm) * 1000 + 400);
  };

  const scaleName = findScale(settings.scale)?.name ?? settings.scale;
  const current = beat !== null && beat >= 0 ? chords.find((c) => (beat % loopBeats) >= c.startBeat && (beat % loopBeats) < c.endBeat) : null;
  const guide = useMemo(() => scaleMarks({ root: settings.key, scale: settings.scale, chord: current?.symbol ?? null }), [settings.key, settings.scale, current?.symbol]);

  if (phase === 'report' && result) {
    return (
      <CoachReport
        result={result}
        onAgain={(s) => {
          setSettings(s);
          setResult(null);
          setPhase('setup');
        }}
      />
    );
  }

  return (
    <>
      <PageHeader eyebrow="Coach" title="Improvise. I’ll listen." description="Plug in or play near your microphone. After a one-bar count-in, solo over the track; when it ends you get a report on chord tones, space, phrasing, timing and bends, plus a map of where on the neck you played." />
      {fromLink?.focus && (
        <div className="mb-4">
          <Notice title="Focus for this session">{fromLink.focus}</Notice>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 content-start gap-4">
          <Card
            title={listening ? 'Listening' : 'Ready when you are'}
            subtitle={listening ? `${groove.name} in ${settings.key} · ${settings.bpm} BPM · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}` : `${groove.name} in ${settings.key}, ${choruses ? `${choruses} time${choruses > 1 ? 's' : ''} through` : 'until you stop'}.`}
            actions={
              listening ? (
                <Button variant="warm" size="lg" onClick={finish}>
                  <Square className="h-4 w-4 fill-current" aria-hidden /> Stop and see report
                </Button>
              ) : (
                <Button variant="primary" size="lg" onClick={() => void start()} disabled={phase === 'starting'}>
                  <Mic className="h-4 w-4" aria-hidden /> {phase === 'starting' ? 'Starting…' : 'Start'}
                </Button>
              )
            }
          >
            <div className="grid gap-4">
              <NoteMeter midi={meter?.midi ?? null} cents={meter?.cents ?? 0} listening={listening} />
              <ChordStrip chords={chords} loopBeats={loopBeats} beat={beat} />
              {listening && beat !== null && beat < 0 && <p className="text-center font-mono text-3xl font-semibold text-accent">{Math.ceil(-beat)}</p>}
              <p className="text-sm text-muted">
                {listening ? `${noteCount} notes heard.` : 'Tip: use headphones for the backing track so the microphone only hears your guitar.'}
              </p>
            </div>
          </Card>
          <Card title={listening ? 'Where you are playing' : `${settings.key} ${scaleName}`} subtitle={listening ? 'Brighter means more time spent there.' : 'The notes to use. Ringed notes are the 3rd and 7th of the chord.'}>
            <Fretboard tuning={STANDARD} marks={listening ? liveMarks : guide} heat={listening} label={listening ? 'Where you are playing on the neck' : `${settings.key} ${scaleName}`} />
            {!listening && (
              <div className="mt-3">
                <DegreeLegend />
              </div>
            )}
          </Card>
        </div>
        <div className="grid content-start gap-4">
          <Card title="Session">
            <div className="grid gap-4">
              <SettingsPanel value={settings} onChange={setSettings} disabled={listening} lockTempo={listening} />
              <Field label="Length">
                {(id) => (
                  <Select id={id} value={choruses} disabled={listening} onChange={(e) => setChoruses(Number(e.target.value))}>
                    <option value={1}>Once through</option>
                    <option value={2}>Twice through</option>
                    <option value={4}>Four times through</option>
                    <option value={0}>Until I stop</option>
                  </Select>
                )}
              </Field>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function fmtMetric(metric: string, value: number | null) {
  if (value === null) return 'n/a';
  const unit = METRIC_TARGETS[metric]?.unit;
  if (!unit && value <= 1 && !['repeatedMotifs'].includes(metric)) return `${Math.round(value * 100)}%`;
  return `${value}${unit ? ` ${unit}` : ''}`;
}

function CoachReport({ result, onAgain }: { result: Result; onAgain: (s: JamSettings) => void }) {
  const { engine, ensure } = useAudio();
  const [replaying, setReplaying] = useState(false);
  const [scrub, setScrub] = useState(result.totalBeats);
  const replayTimer = useRef<number | null>(null);
  const heard = useHeardBeat(engine, replaying);
  const at = replaying && heard !== null ? Math.max(0, heard) : scrub;
  const cells = useMemo(() => replayFrame(result.replay, at), [result.replay, at]);
  const win = useMemo(() => fretWindow(result.replay), [result.replay]);
  const marks: FretMark[] = cells.map((c) => ({ string: c.string, fret: c.fret, label: String(c.count), role: 'third', heat: c.heat }));
  const active = cells.filter((c) => c.active).map((c) => ({ string: c.string, fret: c.fret, tone: 'you' as const }));
  const { assessment, settings, boxes } = result;
  const groove = getGroove(settings.grooveId);

  const stopReplay = useCallback(() => {
    if (replayTimer.current !== null) window.clearTimeout(replayTimer.current);
    replayTimer.current = null;
    peekEngine()?.stop();
    setReplaying(false);
  }, []);
  useEffect(
    () => () => {
      if (replayTimer.current !== null) window.clearTimeout(replayTimer.current);
      peekEngine()?.reset();
    },
    [],
  );
  const playReplay = async () => {
    const e = await ensure();
    const track = renderTrack(groove, result.chords, Math.ceil(result.totalBeats / 4));
    e.prepare({ bpm: settings.bpm, loopBeats: null });
    e.addBacking(track);
    e.start();
    setReplaying(true);
    replayTimer.current = window.setTimeout(() => {
      peekEngine()?.stop();
      setReplaying(false);
      setScrub(result.totalBeats);
    }, ((result.totalBeats * 60) / settings.bpm) * 1000 + 300);
  };

  return (
    <>
      <PageHeader
        eyebrow="Coach report"
        title={assessment.focus ? `Next: ${assessment.focus.label.toLowerCase()}` : 'Every measure is in a healthy range'}
        description={`${result.notes.length} notes over ${Math.round(result.totalBeats / 4)} bars of ${groove.name} in ${settings.key} at ${settings.bpm} BPM.`}
        actions={
          <>
            <Button onClick={() => onAgain(settings)}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Play again
            </Button>
            <Button onClick={() => onAgain({ ...settings, bpm: Math.max(40, settings.bpm - 8) })}>Again, 8 BPM slower</Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 content-start gap-4">
          {assessment.focus && (
            <Notice tone="warn" title={`Work on: ${assessment.focus.label}`}>
              {assessment.focus.exercise}
            </Notice>
          )}
          <Card title="Neck heatmap replay" subtitle="Press play to watch where your hand went, in time with the track. Numbers count how often you played each spot.">
            <Fretboard tuning={STANDARD} marks={marks} active={active} heat startFret={win.start} frets={win.end} label="Where you played on the neck" />
            <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
              {replaying ? (
                <Button onClick={stopReplay}>
                  <Square className="h-4 w-4 fill-current" aria-hidden /> Stop replay
                </Button>
              ) : (
                <Button variant="primary" onClick={() => void playReplay()}>
                  Replay with the track
                </Button>
              )}
              <Slider label="Replay position in beats" value={Math.round(at)} min={0} max={result.totalBeats} onChange={(v) => setScrub(v)} format={(v) => `bar ${Math.floor(v / 4) + 1}`} disabled={replaying} />
            </div>
            <div className="mt-4">
              <PianoRoll notes={result.notes.map((n) => ({ ...n, who: 'you' as const }))} fromBeat={0} beats={result.totalBeats} playhead={at} label="Your solo as a piano roll" />
            </div>
          </Card>
          {boxes && (
            <Card title="Box report" subtitle={`Pentatonic boxes of ${boxKey(settings.key, settings.scale).key} minor`}>
              <div className="grid grid-cols-5 gap-2" role="list">
                {boxes.boxes.map((b) => (
                  <div key={b.box} role="listitem" className="rounded-xl border border-line p-2.5 text-center">
                    <p className="text-xs text-muted">Box {b.box}</p>
                    <p className="tabular font-mono text-lg font-semibold text-ink">{Math.round(b.share * 100)}%</p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/5">
                      <div className="h-1.5 rounded-full bg-accent" style={{ width: `${b.share * 100}%` }} />
                    </div>
                    <p className="mt-1 text-[0.65rem] text-faint">
                      frets {b.fromFret}–{b.toFret}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink">{boxes.advice}</p>
            </Card>
          )}
          <ClaudeCoach result={result} />
        </div>
        <Card title="Measurements" className="content-start">
          <ul className="grid gap-2.5">
            {assessment.verdicts.map((v) => {
              const good = v.status === 'good';
              return (
                <li key={v.metric} className="flex items-start justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-ink">{v.label}</p>
                    {!good && v.value !== null && <p className="mt-0.5 text-xs text-faint">{v.status.replace('work on this ', '')}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="tabular font-mono text-sm font-semibold text-ink">{fmtMetric(v.metric, v.value)}</span>
                    <Badge tone={v.value === null ? 'neutral' : good ? 'good' : 'warm'}>{v.value === null ? 'not measured' : good ? 'good' : 'work on'}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-faint">
            Timing: on average {Math.abs(assessment.metrics.timingMeanMs)} ms {assessment.metrics.timingMeanMs >= 0 ? 'behind' : 'ahead of'} the beat.
          </p>
        </Card>
      </div>
    </>
  );
}

function ClaudeCoach({ result }: { result: Result }) {
  // The player's own Anthropic key, kept in this browser only (lib/claudeKey).
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [keyNote, setKeyNote] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [advice, setAdvice] = useState<CoachAdvice | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => setApiKey(loadKey(browserStorage())), []);
  const { settings, assessment, boxes } = result;
  const groove = getGroove(settings.grooveId);
  const keepDraftKey = () => {
    const key = cleanKey(draft);
    if (!key) {
      setKeyNote('That doesn’t look like an Anthropic API key. Keys start with sk-ant-.');
      return;
    }
    setKeyNote(saveKey(browserStorage(), key) ? '' : 'This browser blocked saving, so the key will be forgotten when you leave this page.');
    setApiKey(key);
    setDraft('');
    setState('idle');
  };
  const forget = () => {
    forgetKey(browserStorage());
    setApiKey(null);
    setKeyNote('');
  };
  const ask = async () => {
    if (!apiKey) return;
    setState('loading');
    const body: CoachRequest = {
      groove: settings.grooveId,
      grooveName: groove.name,
      key: settings.key,
      scale: settings.scale,
      bpm: settings.bpm,
      minutes: Math.round(result.durationSec / 6) / 10,
      noteCount: result.notes.length,
      verdicts: assessment.verdicts.map((v) => ({ label: v.label, value: v.value, status: v.status })),
      focus: assessment.focus ? { label: assessment.focus.label, exercise: assessment.focus.exercise } : null,
      boxes: boxes ? { box1Share: boxes.box1Share, boxesUsed: boxes.boxesUsed, lowestFret: boxes.lowestFret, highestFret: boxes.highestFret, advice: boxes.advice } : null,
      opening: result.notes.slice(0, 32).map((n) => ({ note: midiName(n.midi).replace(/-?\d+$/, ''), beat: Math.round(n.onsetBeat * 4) / 4, beats: Math.round(n.durationBeats * 4) / 4 })),
    };
    const answer = await askClaude(body, apiKey);
    if (answer.ok) {
      setAdvice(answer.advice);
      setState('done');
      return;
    }
    setMessage(answer.message);
    setState('error');
    // A refused key: show the key field again so a new one can be pasted.
    if (answer.badKey) setApiKey(null);
  };

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" aria-hidden /> Claude’s take
        </span>
      }
      subtitle="A written lesson from these numbers, with a drill and a next session."
      actions={
        apiKey && state !== 'done' ? (
          <Button variant="primary" size="sm" onClick={() => void ask()} disabled={state === 'loading'}>
            {state === 'loading' ? 'Thinking…' : 'Ask Claude'}
          </Button>
        ) : null
      }
    >
      {!apiKey && state !== 'done' && (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            keepDraftKey();
          }}
        >
          <p className="text-sm leading-relaxed text-muted">Paste your Anthropic API key to get a written lesson from these numbers. It is saved only in this browser and sent only to Anthropic.</p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Anthropic API key" className="min-w-0 flex-1">
              {(id) => <input id={id} type="password" value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off" spellCheck={false} placeholder="sk-ant-…" className="h-10 w-full rounded-xl border border-line bg-surface/80 px-3 font-mono text-sm text-ink" />}
            </Field>
            <Button type="submit" variant="primary" disabled={!draft.trim()}>
              Save key
            </Button>
          </div>
        </form>
      )}
      {keyNote && <Notice tone="warn">{keyNote}</Notice>}
      {apiKey && state !== 'done' && (
        <p className="text-xs text-faint">
          Using your Anthropic API key.{' '}
          <button type="button" onClick={forget} className="cursor-pointer underline underline-offset-2 hover:text-ink">
            Forget key
          </button>
        </p>
      )}
      {state === 'error' && <Notice tone="error">{message}</Notice>}
      {advice && (
        <div className="grid gap-4">
          <p className="text-base font-medium text-ink">{advice.headline}</p>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-300">What went well</p>
            <ul className="grid gap-1.5 text-sm text-ink">
              {advice.strengths.map((s) => (
                <li key={s} className="flex gap-2">
                  <span className="text-emerald-300" aria-hidden>
                    ✓
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300">Work on</p>
            <ul className="grid gap-2.5">
              {advice.fixes.map((f) => (
                <li key={f.issue} className="rounded-xl border border-line px-3 py-2.5 text-sm">
                  <p className="text-ink">{f.issue}</p>
                  <p className="mt-1 text-muted">Drill: {f.drill}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2.5">
            <p className="text-sm text-ink">
              Next session: {getGroove(advice.next_session.groove).name} at {advice.next_session.bpm} BPM. {advice.next_session.focus}
            </p>
            <Link href={linkFor('coach', { ...defaultSettings(advice.next_session.groove), key: settings.key, bpm: advice.next_session.bpm }, { focus: advice.next_session.focus.slice(0, 200) })} className="inline-flex h-8 items-center rounded-lg bg-accent px-3 text-sm font-medium text-accent-ink">
              Set it up
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}
