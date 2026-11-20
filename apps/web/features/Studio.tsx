'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileAudio, Mic, Repeat2, Upload } from 'lucide-react';
import { stretchQuality } from '@guitarpulse/core/audio/tempo';
import { getGroove, renderTrack } from '@guitarpulse/core/grooves';
import { decodeJam } from '@guitarpulse/core/session';
import { parseNote, prefersFlats } from '@guitarpulse/core/theory/notes';
import { findScale } from '@guitarpulse/core/theory/scales';
import { DegreeLegend, Fretboard } from '@/components/Fretboard';
import { useAnnounce, useAudio, useProgress } from '@/components/Providers';
import { ChordStrip, CopyButton, Mixer, PlayButton, SettingsPanel } from '@/components/session';
import { Badge, Button, Card, Field, Notice, PageHeader, Segmented, Slider, Toggle } from '@/components/ui';
import { StretchPlayer } from '@/lib/audio/stretch';
import { peekEngine } from '@/lib/audio/engine';
import { absoluteUrl } from '@/lib/basePath';
import { useHeardBeat } from '@/lib/hooks';
import { scaleMarks } from '@/lib/marks';
import { addSession } from '@guitarpulse/core/progress';
import { newSessionId } from '@/lib/progressStore';
import { chordAtBeat, defaultSettings, grooveChords, linkFor, loopLength, settingsFromSession, type JamSettings } from '@/lib/settings';
import { getTuning } from '@guitarpulse/core/theory/notes';

const STANDARD = getTuning('standard');

export function Studio() {
  const params = useSearchParams();
  const fromLink = useMemo(() => {
    const code = params.get('s');
    const r = code ? decodeJam(code) : null;
    return r && r.ok ? r.session : null;
  }, [params]);
  const [settings, setSettings] = useState<JamSettings>(() => (fromLink ? settingsFromSession(fromLink) : defaultSettings('slow-blues')));
  const [tab, setTab] = useState<'tracks' | 'yours'>('tracks');

  return (
    <>
      <PageHeader
        eyebrow="Backing tracks"
        title="Jam over any style, in any key"
        description="Pick a style, key and tempo. The neck shows your scale, and the chord being played lights up its 3rd and 7th, the notes that make your lines follow the changes."
        actions={<Segmented label="Track source" value={tab} onChange={setTab} options={[{ value: 'tracks', label: 'Generated tracks' }, { value: 'yours', label: 'Your recording' }]} />}
      />
      {fromLink?.focus && (
        <div className="mb-4">
          <Notice title="Focus for this jam">{fromLink.focus}</Notice>
        </div>
      )}
      {tab === 'tracks' ? <GeneratedTracks settings={settings} setSettings={setSettings} lickIds={fromLink?.licks ?? []} /> : <YourRecording />}
    </>
  );
}

function GeneratedTracks({ settings, setSettings, lickIds }: { settings: JamSettings; setSettings: (s: JamSettings) => void; lickIds: string[] }) {
  const { engine, ensure } = useAudio();
  const { update } = useProgress();
  const announce = useAnnounce();
  const [playing, setPlaying] = useState(false);
  const [colorBy, setColorBy] = useState<'chord' | 'key'>('chord');
  const [labels, setLabels] = useState<'degrees' | 'notes'>('degrees');
  const [leftHanded, setLeftHanded] = useState(false);
  const startedAt = useRef<number | null>(null);
  const groove = getGroove(settings.grooveId);
  const chords = useMemo(() => grooveChords(settings), [settings]);
  const loopBeats = useMemo(() => loopLength(chords), [chords]);
  const beat = useHeardBeat(engine, playing);
  const current = beat === null || beat < 0 ? null : chordAtBeat(chords, loopBeats, beat);
  const shownChord = colorBy === 'chord' ? (current?.chord.symbol ?? chords[0].symbol) : null;
  const marks = useMemo(() => scaleMarks({ root: settings.key, scale: settings.scale, chord: shownChord, labels }), [settings.key, settings.scale, shownChord, labels]);
  const flats = useMemo(() => {
    const n = parseNote(settings.key);
    return n ? prefersFlats(n) : false;
  }, [settings.key]);

  const startTrack = useCallback(
    async (s: JamSettings) => {
      const e = await ensure();
      const ch = grooveChords(s);
      const track = renderTrack(getGroove(s.grooveId), ch);
      e.prepare({ bpm: s.bpm, loopBeats: track.lengthBeats });
      e.addBacking(track);
      e.start();
      setPlaying(true);
    },
    [ensure],
  );

  const logSession = useCallback(() => {
    if (startedAt.current === null) return;
    const durationSec = Math.round((Date.now() - startedAt.current) / 1000);
    const started = startedAt.current;
    startedAt.current = null;
    if (durationSec < 20) return;
    update((p) => addSession(p, { id: newSessionId(), kind: 'studio', startedAt: started, durationSec, title: `${groove.name} in ${settings.key}`, groove: settings.grooveId, key: settings.key }));
  }, [update, groove.name, settings.key, settings.grooveId]);

  const play = async () => {
    await startTrack(settings);
    startedAt.current = Date.now();
    announce(`Playing ${groove.name} in ${settings.key} at ${settings.bpm} BPM`);
  };
  const stop = () => {
    engine?.stop();
    setPlaying(false);
    logSession();
    announce('Stopped');
  };

  // Settings changes while playing: tempo glides, everything else re-renders the track.
  const prev = useRef(settings);
  useEffect(() => {
    const before = prev.current;
    prev.current = settings;
    if (!playing || !engine) return;
    const onlyTempo = before.bpm !== settings.bpm && before.grooveId === settings.grooveId && before.key === settings.key && before.progression === settings.progression;
    if (onlyTempo) engine.setBpm(settings.bpm);
    else if (before.grooveId !== settings.grooveId || before.key !== settings.key || before.progression !== settings.progression) void startTrack(settings);
  }, [settings, playing, engine, startTrack]);

  useEffect(
    () => () => {
      peekEngine()?.reset();
    },
    [],
  );
  useEffect(() => () => logSession(), [logSession]);

  const scaleName = findScale(settings.scale)?.name ?? settings.scale;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="grid min-w-0 content-start gap-4">
        <Card
          title={
            <span className="flex flex-wrap items-center gap-2">
              {groove.name} <Badge tone={groove.category === 'asia' ? 'warm' : 'accent'}>{groove.category === 'asia' ? 'Asia pack' : groove.family}</Badge>
            </span>
          }
          subtitle={`${groove.description}. ${groove.instruments}.`}
          actions={<PlayButton playing={playing} onPlay={() => void play()} onStop={stop} />}
        >
          <ChordStrip chords={chords} loopBeats={loopBeats} beat={beat} />
          {groove.about && <p className="mt-3 text-sm leading-relaxed text-muted">{groove.about}</p>}
        </Card>

        <Card
          title={`${settings.key} ${scaleName}`}
          subtitle={colorBy === 'chord' ? `Coloured against ${shownChord}: ringed notes are its 3rd and 7th, faded notes are passing tones.` : 'Coloured by scale degree in the key.'}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Segmented size="sm" label="Colour notes by" value={colorBy} onChange={setColorBy} options={[{ value: 'chord', label: 'Chord' }, { value: 'key', label: 'Key' }]} />
              <Segmented size="sm" label="Labels" value={labels} onChange={setLabels} options={[{ value: 'degrees', label: '1 3 5' }, { value: 'notes', label: 'C E G' }]} />
            </div>
          }
        >
          <Fretboard tuning={STANDARD} marks={marks} label={`${settings.key} ${scaleName} on the fretboard`} leftHanded={leftHanded} preferFlats={flats} onPlay={(_s, _f, midi) => engine?.playNow([midi], 'sequence')} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <DegreeLegend />
            <Toggle checked={leftHanded} onChange={setLeftHanded} label="Left-handed" />
          </div>
        </Card>
      </div>

      <div className="grid content-start gap-4">
        <Card title="Track">
          <SettingsPanel value={settings} onChange={setSettings} />
        </Card>
        <Card title="Mix">
          <Mixer engine={engine} parts={['drums', 'bass', 'keys', 'pad']} />
        </Card>
        <Card title="Take it further">
          <div className="grid gap-2">
            <Link href={linkFor('coach', settings)} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm text-ink transition-colors hover:border-accent/50 hover:bg-accent/5">
              <Mic className="h-4 w-4 text-accent" aria-hidden /> Solo over this with the coach listening
            </Link>
            <Link href={linkFor('trade', settings)} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm text-ink transition-colors hover:border-accent/50 hover:bg-accent/5">
              <Repeat2 className="h-4 w-4 text-accent" aria-hidden /> Trade fours over this track
            </Link>
            {lickIds.map((id) => (
              <Link key={id} href={`/licks?id=${encodeURIComponent(id)}`} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm text-ink transition-colors hover:border-accent/50 hover:bg-accent/5">
                <FileAudio className="h-4 w-4 text-accent" aria-hidden /> Lick to work in: {id}
              </Link>
            ))}
            <ShareLink settings={settings} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function ShareLink({ settings }: { settings: JamSettings }) {
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  if (!origin) return null;
  const href = absoluteUrl(origin, linkFor('studio', settings).replace('/studio?', '/jam/?'));
  return (
    <div className="flex items-center justify-between gap-2 pt-1">
      <span className="text-xs text-muted">Share this exact track</span>
      <CopyButton text={href} />
    </div>
  );
}

function YourRecording() {
  const { ensure } = useAudio();
  const [player, setPlayer] = useState<StretchPlayer | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(100);
  const [semitones, setSemitones] = useState(0);
  const [loop, setLoop] = useState<[number, number]>([0, 0]);
  const [sourceBpm, setSourceBpm] = useState('');
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const e = await ensure();
      const p = await StretchPlayer.shared(e);
      const data = await file.arrayBuffer();
      const buffer = await e.ctx.decodeAudioData(data);
      await p.load(buffer);
      setPlayer(p);
      setDuration(p.duration);
      setLoop([0, Math.round(p.duration * 10) / 10]);
      setFileName(file.name);
      setPlaying(false);
      setPosition(0);
    } catch {
      setError('That file could not be opened. Try an MP3, WAV, M4A or OGG file.');
    } finally {
      setLoading(false);
    }
  };

  const settingsNow = useCallback(() => ({ rate: speed / 100, semitones, loopStart: loop[0], loopEnd: loop[1] > loop[0] + 0.2 ? loop[1] : duration }), [speed, semitones, loop, duration]);
  useEffect(() => {
    if (player && playing) player.update(settingsNow());
  }, [player, playing, settingsNow]);
  useEffect(() => {
    if (!playing || !player) return;
    let raf = 0;
    const tick = () => {
      setPosition(player.position);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, player]);
  useEffect(
    () => () => {
      player?.pause();
    },
    [player],
  );

  const rate = speed / 100;
  const quality = stretchQuality(rate);
  const bpmIn = Number(sourceBpm);
  const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card title="Your recording" subtitle="Slow down a song or your own backing track without changing its key, or change key without changing speed. The file never leaves this device.">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) void load(f);
          }}
          className={`grid place-items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${dragging ? 'border-accent bg-accent/5' : 'border-line'}`}
        >
          <Upload className="mb-3 h-8 w-8 text-accent" aria-hidden />
          <p className="text-sm text-ink">{fileName ? `Loaded: ${fileName}` : 'Drop an audio file here'}</p>
          <p className="mt-1 text-xs text-muted">MP3, WAV, M4A or OGG</p>
          <input ref={inputRef} type="file" accept="audio/*" className="sr-only" aria-label="Choose an audio file" onChange={(e) => e.target.files?.[0] && void load(e.target.files[0])} />
          <Button className="mt-4" onClick={() => inputRef.current?.click()} disabled={loading}>
            {loading ? 'Opening…' : fileName ? 'Choose another file' : 'Choose a file'}
          </Button>
        </div>
        {error && (
          <div className="mt-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        {player && duration > 0 && (
          <div className="mt-5 grid gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <PlayButton
                playing={playing}
                onPlay={() => {
                  const s = settingsNow();
                  player.play({ ...s, from: position >= s.loopStart && position < s.loopEnd ? position : s.loopStart });
                  setPlaying(true);
                }}
                onStop={() => {
                  player.pause();
                  setPlaying(false);
                }}
                stopLabel="Pause"
              />
              <span className="tabular font-mono text-sm text-muted">
                {fmtTime(position)} / {fmtTime(duration)}
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-white/5" aria-hidden>
              <span className="absolute inset-y-0 rounded-full bg-accent/25" style={{ left: `${(loop[0] / duration) * 100}%`, width: `${((loop[1] - loop[0]) / duration) * 100}%` }} />
              <span className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded bg-white" style={{ left: `${(Math.min(position, duration) / duration) * 100}%` }} />
            </div>
          </div>
        )}
      </Card>
      <div className="grid content-start gap-4">
        <Card title="Speed and key">
          <div className="grid gap-4">
            <Field label="Speed" hint={quality === 'clean' ? 'Sounds natural at this speed.' : 'Very slow or fast settings can sound smeared; 75–150% stays clean.'}>
              {(id) => <Slider id={id} label="Speed in percent" value={speed} min={30} max={200} step={5} onChange={setSpeed} format={(v) => `${v}%`} />}
            </Field>
            <Field label="Key" hint="Semitones up or down; tempo stays the same.">
              {(id) => <Slider id={id} label="Transpose in semitones" value={semitones} min={-7} max={7} onChange={setSemitones} format={(v) => (v > 0 ? `+${v}` : `${v}`)} />}
            </Field>
            <Field label="Original tempo (optional)" hint={bpmIn > 0 ? `Now playing at ${Math.round(bpmIn * rate)} BPM.` : 'Type the song’s BPM to see the new tempo.'}>
              {(id) => <input id={id} inputMode="numeric" value={sourceBpm} onChange={(e) => setSourceBpm(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} className="h-10 rounded-xl border border-line bg-surface/80 px-3 text-sm text-ink" />}
            </Field>
          </div>
        </Card>
        {player && duration > 0 && (
          <Card title="Loop a section" subtitle="Practise one solo or phrase over and over.">
            <div className="grid gap-3">
              <Field label="Loop start">{(id) => <Slider id={id} label="Loop start in seconds" value={loop[0]} min={0} max={Math.max(0.1, duration - 0.5)} step={0.1} onChange={(v) => setLoop(([, b]) => [Math.min(v, b - 0.5), b])} format={fmtTime} />}</Field>
              <Field label="Loop end">{(id) => <Slider id={id} label="Loop end in seconds" value={loop[1]} min={0.5} max={duration} step={0.1} onChange={(v) => setLoop(([a]) => [a, Math.max(v, a + 0.5)])} format={fmtTime} />}</Field>
              <Button size="sm" variant="ghost" onClick={() => setLoop([0, duration])}>
                Loop the whole file
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
