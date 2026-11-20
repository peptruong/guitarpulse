'use client';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getGroove, renderTrack } from '@guitarpulse/core/grooves';
import { addSession } from '@guitarpulse/core/progress';
import { decodeJam, encodeJam } from '@guitarpulse/core/session';
import { songToPractice, type SongPractice } from '@guitarpulse/core/song';
import { parseChord } from '@guitarpulse/core/theory/chords';
import { getTuning, parseNote, prefersFlats } from '@guitarpulse/core/theory/notes';
import { DegreeLegend, Fretboard } from '@/components/Fretboard';
import { useAnnounce, useAudio, useProgress } from '@/components/Providers';
import { ChordStrip, CopyButton, GrooveOptions, PlayButton } from '@/components/session';
import { Badge, Card, Field, Notice, PageHeader, Select, Slider } from '@/components/ui';
import { peekEngine } from '@/lib/audio/engine';
import { useHeardBeat } from '@/lib/hooks';
import { scaleMarks } from '@/lib/marks';
import { newSessionId } from '@/lib/progressStore';
import { canonicalKey, keyRoot, KEYS } from '@/lib/settings';

const STANDARD = getTuning('standard');
const EXAMPLES = [
  { name: 'Just the Two of Us', chart: '| Fmaj7 | E7 | Am7 | Gm7 C7 |' },
  { name: 'Autumn Leaves (A section)', chart: '| Cm7 | F7 | Bbmaj7 | Ebmaj7 |\n| Am7b5 | D7 | Gm | Gm |' },
  { name: 'Royal road (J-pop)', chart: '| Fmaj7 | G7 | Em7 | Am |' },
  { name: 'Andalusian cadence', chart: '| Am | G | F | E7 |' },
  { name: '12-bar blues in A', chart: '| A7 | D7 | A7 | A7 |\n| D7 | D7 | A7 | A7 |\n| E7 | D7 | A7 | E7 |' },
  { name: 'Pop: I–V–vi–IV', chart: '| C | G | Am | F |' },
];

export function Song() {
  const params = useSearchParams();
  const fromLink = useMemo(() => {
    const code = params.get('s');
    const r = code ? decodeJam(code) : null;
    return r && r.ok ? r.session : null;
  }, [params]);
  const { engine, ensure } = useAudio();
  const { update } = useProgress();
  const announce = useAnnounce();
  const [chart, setChart] = useState(fromLink?.chart ?? EXAMPLES[0].chart);
  const [keyChoice, setKeyChoice] = useState<string>(() => {
    const k = fromLink?.key;
    const r = keyRoot(k);
    if (!k || !r) return 'detect';
    const minor = /minor|m$/i.test(k.trim()) && !/major/i.test(k);
    return `${canonicalKey(r)} ${minor ? 'minor' : 'major'}`;
  });
  const [grooveId, setGrooveId] = useState(fromLink?.groove ?? 'neo-soul');
  const [bpm, setBpm] = useState(fromLink?.bpm ?? getGroove(fromLink?.groove ?? 'neo-soul').bpm.default);
  const [playing, setPlaying] = useState(false);
  const startedAt = useRef<number | null>(null);

  const analysis = useMemo((): { ok: true; song: SongPractice } | { ok: false; error: string } => {
    try {
      return { ok: true, song: songToPractice(chart, { key: keyChoice === 'detect' ? undefined : keyChoice }) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Those chords could not be read.' };
    }
  }, [chart, keyChoice]);
  const song = analysis.ok ? analysis.song : null;
  const chords = useMemo(() => (song ? song.chart.chords.map((c) => ({ symbol: c.symbol, startBeat: c.startBeat, endBeat: c.endBeat })) : []), [song]);
  const loopBeats = song ? song.lengthBeats : 16;
  const beat = useHeardBeat(engine, playing);
  const pos = beat === null || beat < 0 ? 0 : beat % loopBeats;
  const currentIndex = Math.max(0, chords.findIndex((c) => pos >= c.startBeat && pos < c.endBeat));
  const current = song?.timeline[currentIndex];
  const advice = song?.advice.chords.find((c) => c.chord === current?.symbol);
  const scaleId = advice?.scales[0]?.id ?? 'ionian';
  const root = current ? parseChord(current.symbol).root.name : 'C';
  const marks = useMemo(() => (current ? scaleMarks({ root, scale: scaleId, chord: current.symbol }) : []), [current, root, scaleId]);
  const flats = useMemo(() => {
    const n = song ? parseNote(song.key.tonic) : null;
    return n ? prefersFlats(n) : false;
  }, [song]);

  const startTrack = useCallback(async () => {
    if (!song || !chords.length) return;
    const e = await ensure();
    const track = renderTrack(getGroove(grooveId), chords, song.chart.bars);
    e.prepare({ bpm, loopBeats: track.lengthBeats });
    e.addBacking(track);
    e.start();
    setPlaying(true);
  }, [song, chords, ensure, grooveId, bpm]);

  const logSession = useCallback(() => {
    if (startedAt.current === null) return;
    const durationSec = Math.round((Date.now() - startedAt.current) / 1000);
    const began = startedAt.current;
    startedAt.current = null;
    if (durationSec >= 20 && song) update((p) => addSession(p, { id: newSessionId(), kind: 'song', startedAt: began, durationSec, title: song.named?.name ?? `Song in ${song.key.key}`, groove: grooveId, key: song.key.tonic }));
  }, [song, grooveId, update]);

  // Restart with the new chords or feel; glide to a new tempo.
  const sig = `${chart}|${keyChoice}|${grooveId}`;
  const lastSig = useRef(sig);
  useEffect(() => {
    if (!playing) {
      lastSig.current = sig;
      return;
    }
    if (lastSig.current !== sig) {
      lastSig.current = sig;
      if (song) void startTrack();
      else {
        peekEngine()?.stop();
        setPlaying(false);
      }
    }
  }, [sig, playing, song, startTrack]);
  useEffect(() => {
    if (playing) peekEngine()?.setBpm(bpm);
  }, [bpm, playing]);
  useEffect(() => () => peekEngine()?.reset(), []);
  useEffect(() => () => logSession(), [logSession]);

  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const share = song && chart.length <= 600 && origin ? `${origin}/jam?s=${encodeJam({ v: 1, mode: 'song', chart, groove: grooveId, bpm, ...(keyChoice !== 'detect' ? { key: keyChoice } : {}) })}` : null;

  return (
    <>
      <PageHeader
        eyebrow="Song to practice"
        title="Type the chords. Get the backing track and what to play."
        description="Use bars like | Am7 | D7 |, several chords in a bar (C G), “/” for an extra beat and “%” to repeat a bar. GuitarPulse finds the key, names famous progressions, picks a scale for every chord and shows the 3rd and 7th to aim for."
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 content-start gap-4">
          <Card
            title="Chords"
            actions={
              <Select aria-label="Load an example" value="" onChange={(e) => e.target.value && setChart(e.target.value)} className="w-56">
                <option value="">Load an example…</option>
                {EXAMPLES.map((x) => (
                  <option key={x.name} value={x.chart}>
                    {x.name}
                  </option>
                ))}
              </Select>
            }
          >
            <label htmlFor="chart" className="sr-only">
              Chord chart
            </label>
            <textarea id="chart" value={chart} onChange={(e) => setChart(e.target.value)} rows={4} spellCheck={false} className="w-full resize-y rounded-xl border border-line bg-surface/80 p-3 font-mono text-[0.95rem] leading-relaxed text-ink" />
            {!analysis.ok && (
              <div className="mt-3">
                <Notice tone="error">{analysis.error}</Notice>
              </div>
            )}
            {song && song.chart.errors.length > 0 && (
              <div className="mt-3">
                <Notice tone="warn" title="Skipped">
                  {song.chart.errors.map((e) => e.message).join(' ')}
                </Notice>
              </div>
            )}
          </Card>

          {song && (
            <>
              <Card
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {song.key.key}
                    {song.key.confidence < 1 && <Badge>{Math.round(song.key.confidence * 100)}% sure</Badge>}
                    {song.named && <Badge tone="accent">{song.named.name}</Badge>}
                  </span>
                }
                subtitle={song.named?.about ?? (song.key.alternatives.length ? `Could also be heard in ${song.key.alternatives.slice(0, 2).join(' or ')}.` : undefined)}
                actions={<PlayButton playing={playing} onPlay={() => void startTrack().then(() => { startedAt.current = Date.now(); announce('Playing your song'); })} onStop={() => { peekEngine()?.stop(); setPlaying(false); logSession(); }} />}
              >
                <ChordStrip chords={chords} loopBeats={loopBeats} beat={beat} />
                <p className="mt-3 text-sm leading-relaxed text-ink">{song.focus}</p>
              </Card>
              {current && (
                <Card title={`${current.symbol}: ${current.scale}`} subtitle={`Aim for ${current.guideTones.join(' and ')} as the chord arrives. Ringed notes are its 3rd and 7th.`}>
                  <Fretboard tuning={STANDARD} marks={marks} label={`${current.scale} over ${current.symbol}`} preferFlats={flats} onPlay={(_s, _f, midi) => engine?.playNow([midi], 'sequence')} />
                  <div className="mt-3">
                    <DegreeLegend />
                  </div>
                </Card>
              )}
              <Card title="Chord by chord">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                        <th className="py-2 pr-3 font-medium">Bar</th>
                        <th className="py-2 pr-3 font-medium">Chord</th>
                        <th className="py-2 pr-3 font-medium">Scale</th>
                        <th className="py-2 pr-3 font-medium">Notes</th>
                        <th className="py-2 font-medium">3rd and 7th</th>
                      </tr>
                    </thead>
                    <tbody>
                      {song.timeline.map((t, i) => (
                        <tr key={`${t.symbol}-${t.startBeat}`} className={i === currentIndex && playing ? 'bg-accent/10' : ''}>
                          <td className="py-2 pr-3 font-mono text-muted">{t.bar}</td>
                          <td className="py-2 pr-3 font-mono font-semibold text-ink">{t.symbol}</td>
                          <td className="py-2 pr-3 text-ink">{t.scale}</td>
                          <td className="py-2 pr-3 font-mono text-muted">{t.scaleNotes.join(' ')}</td>
                          <td className="py-2 font-mono text-ink">{t.guideTones.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              {song.advice.guideToneLine.length > 0 && (
                <Card title="Guide-tone line" subtitle="The smoothest path through the 3rds and 7ths. Play it slowly as a melody, then decorate it.">
                  <ol className="grid gap-1.5 text-sm text-ink">
                    {song.advice.guideToneLine.map((g) => (
                      <li key={g} className="font-mono">
                        {g}
                      </li>
                    ))}
                  </ol>
                </Card>
              )}
            </>
          )}
        </div>
        <div className="grid content-start gap-4">
          <Card title="Backing">
            <div className="grid gap-3">
              <Field label="Feel">
                {(id) => (
                  <Select
                    id={id}
                    value={grooveId}
                    onChange={(e) => {
                      setGrooveId(e.target.value);
                      setBpm(getGroove(e.target.value).bpm.default);
                    }}
                  >
                    <GrooveOptions />
                  </Select>
                )}
              </Field>
              <Field label="Key">
                {(id) => (
                  <Select id={id} value={keyChoice} onChange={(e) => setKeyChoice(e.target.value)}>
                    <option value="detect">Detect from the chords</option>
                    {KEYS.flatMap((k) => [`${k} major`, `${k} minor`]).map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Tempo">{(id) => <Slider id={id} label="Tempo in beats per minute" value={bpm} min={40} max={240} onChange={setBpm} format={(v) => `${v} bpm`} />}</Field>
            </div>
          </Card>
          {share && (
            <Card title="Share" subtitle="A link that opens this song, feel and tempo.">
              <CopyButton text={share} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
