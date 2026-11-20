'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlipVertical2, Music, Search, Shuffle, Target, Undo2, Wand2 } from 'lucide-react';
import { GROOVES } from '@guitarpulse/core/grooves';
import { findArtist } from '@guitarpulse/core/licks/artists';
import { getLick, LICKS, searchLicks } from '@guitarpulse/core/licks/index';
import { LICK_GENRES, type Lick, type LickGenre } from '@guitarpulse/core/licks/types';
import { mutateLick, type Mutation } from '@guitarpulse/core/mutator';
import { encodeJam } from '@guitarpulse/core/session';
import { parseAlphaTexBody, texEvents, TICKS_PER_QUARTER, type TexScore } from '@guitarpulse/core/tex/alphatex';
import { getTuning, parseNote } from '@guitarpulse/core/theory/notes';
import { findScale, scalePcs } from '@guitarpulse/core/theory/scales';
import { DegreeLegend, Fretboard, type FretMark } from '@/components/Fretboard';
import { useAudio } from '@/components/Providers';
import { PlayButton } from '@/components/session';
import { TabView } from '@/components/TabView';
import { Badge, Button, Card, cx, Field, Notice, PageHeader, Segmented, Select, Slider, Toggle } from '@/components/ui';
import { peekEngine, type LeadNote } from '@/lib/audio/engine';
import { degreeOf, degreeRole } from '@/lib/degrees';
import { useHeardBeat, useLatest } from '@/lib/hooks';
import { canonicalKey, KEYS } from '@/lib/settings';

const STANDARD = getTuning('standard');
const ASIA: LickGenre[] = ['city-pop', 'anime', 'k-pop', 'wuxia', 'vietnamese'];
const GENRE_LABEL: Partial<Record<LickGenre, string>> = { 'gypsy-jazz': 'Gypsy jazz', 'neo-soul': 'Neo-soul', 'city-pop': 'City pop', anime: 'Anime rock', 'k-pop': 'K-pop / K-R&B', wuxia: 'Wuxia', vietnamese: 'Vietnamese' };
const label = (g: LickGenre) => GENRE_LABEL[g] ?? g.charAt(0).toUpperCase() + g.slice(1);

/** A backing groove that suits a lick, for "practise over a track". */
function grooveFor(l: Lick): string {
  if (l.scale === 'hoi-oan' || l.scale === 'nam-ai' || l.scale === 'nam-xuan') return 'cai-luong';
  const byGenre: Record<LickGenre, string> = {
    blues: 'slow-blues', rock: 'classic-rock', metal: 'metal', shred: 'hard-rock', prog: 'hard-rock', jazz: 'jazz-ii-v-i', 'gypsy-jazz': 'jazz-ii-v-i', fusion: 'funk', funk: 'funk', soul: 'neo-soul', 'neo-soul': 'neo-soul', pop: 'pop-rock', latin: 'bossa-nova', country: 'country', fingerstyle: 'pop-rock',
    'city-pop': 'city-pop', anime: 'anime-rock', 'k-pop': 'k-ballad', wuxia: 'wuxia', vietnamese: 'vietnamese-folk',
  };
  return byGenre[l.genre];
}

interface Step {
  mutation: Mutation;
  label: string;
  lick: Lick;
  explanation: string;
  warnings: string[];
}

export function Licks() {
  const params = useSearchParams();
  const router = useRouter();
  const [text, setText] = useState('');
  const [genre, setGenre] = useState<LickGenre | ''>('');
  const [maxDiff, setMaxDiff] = useState<'all' | '2' | '3' | '4'>('all');
  const [artist, setArtist] = useState('');
  const selectedId = params.get('id') ?? LICKS[0].id;
  const selected = getLick(selectedId) ?? LICKS[0];
  const detailRef = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => searchLicks({ text: text || undefined, genre: genre || undefined, artist: artist || undefined, maxDifficulty: maxDiff === 'all' ? undefined : (Number(maxDiff) as 2 | 3 | 4), limit: 200 }).licks,
    [text, genre, artist, maxDiff],
  );
  const artists = useMemo(() => [...new Set(LICKS.filter((l) => !genre || l.genre === genre).map((l) => l.artist))].sort(), [genre]);
  const choose = (id: string) => {
    router.replace(`/licks?id=${encodeURIComponent(id)}`, { scroll: false });
    if (window.matchMedia('(max-width: 1023px)').matches) window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  return (
    <>
      <PageHeader eyebrow="Licks vault" title={`${LICKS.length} licks in the style of ${new Set(LICKS.map((l) => l.artist)).size} players`} description="Original phrases written in each player’s style (not transcriptions), with tab, playback at any speed and a mutator that turns one lick into many." />
      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Card className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-hidden" as="div">
          <div className="grid gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
              <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Search licks" className="h-10 w-full rounded-xl border border-line bg-surface/80 pr-3 pl-9 text-sm text-ink" type="search" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select aria-label="Style" value={genre} onChange={(e) => { setGenre(e.target.value as LickGenre | ''); setArtist(''); }}>
                <option value="">All styles</option>
                <optgroup label="Styles">
                  {LICK_GENRES.filter((g) => !ASIA.includes(g)).map((g) => (
                    <option key={g} value={g}>
                      {label(g)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Asia sound pack">
                  {ASIA.map((g) => (
                    <option key={g} value={g}>
                      {label(g)}
                    </option>
                  ))}
                </optgroup>
              </Select>
              <Select aria-label="Player" value={artist} onChange={(e) => setArtist(e.target.value)}>
                <option value="">All players</option>
                {artists.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </div>
            <Segmented size="sm" label="Difficulty" value={maxDiff} onChange={setMaxDiff} options={[{ value: 'all', label: 'Any level' }, { value: '2', label: 'Easy' }, { value: '3', label: '≤ 3' }, { value: '4', label: '≤ 4' }]} />
            <p className="text-xs text-muted" aria-live="polite">
              {results.length} lick{results.length === 1 ? '' : 's'}
            </p>
          </div>
          <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-1.5 overflow-y-auto pr-1 lg:max-h-[calc(100dvh-20rem)]">
            {results.map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => choose(l.id)} aria-current={l.id === selected.id ? 'true' : undefined} className={cx('w-full cursor-pointer rounded-xl border px-3 py-2.5 text-left transition-colors', l.id === selected.id ? 'border-accent/60 bg-accent/10' : 'border-transparent hover:border-line hover:bg-white/5')}>
                  <span className="flex min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium text-ink">{l.title}</span>
                    <span className="flex shrink-0 gap-0.5" aria-label={`Difficulty ${l.difficulty} of 5`}>
                      {[1, 2, 3, 4, 5].map((d) => (
                        <span key={d} className={cx('h-1.5 w-1.5 rounded-full', d <= l.difficulty ? 'bg-accent' : 'bg-white/10')} />
                      ))}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {l.artist} · {l.key} {findScale(l.scale)?.name ?? l.scale}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <div ref={detailRef} className="min-w-0 scroll-mt-20">
          <LickDetail key={selected.id} base={selected} />
        </div>
      </div>
    </>
  );
}

function leadNotes(score: TexScore): LeadNote[] {
  return texEvents(score, STANDARD).map((e) => {
    const bends = /\bb\s*\(([^)]*)\)/.exec(e.effects)?.[1].trim().split(/\s+/).map(Number) ?? [];
    return {
      midi: e.midi,
      onsetBeat: e.onsetBeat,
      durationBeats: Math.max(0.12, e.durationBeats),
      bendSemitones: e.bendSemitones || undefined,
      bendRelease: bends.length > 1 && bends[bends.length - 1] < Math.max(...bends),
      vibrato: /(^|\s)v(\s|$)/.test(e.effects),
      velocity: /(^|\s)ac(\s|$)/.test(e.effects) ? 1 : 0.8,
    };
  });
}

function LickDetail({ base }: { base: Lick }) {
  const { engine, ensure } = useAudio();
  const [steps, setSteps] = useState<Step[]>([]);
  const [speed, setSpeed] = useState(80);
  const [loop, setLoop] = useState(true);
  const [click, setClick] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [toKey, setToKey] = useState(() => canonicalKey(base.key === 'C' ? 'G' : 'C'));
  const [target, setTarget] = useState(base.chord.split(/\s+/)[0] || 'C7');
  const [error, setError] = useState<string | null>(null);
  const lick = steps.length ? steps[steps.length - 1].lick : base;
  const score = useMemo(() => parseAlphaTexBody(lick.body, lick.timeSignature.split('/').map(Number) as [number, number]), [lick.body, lick.timeSignature]);
  const notes = useMemo(() => leadNotes(score), [score]);
  const lengthBeats = Math.ceil(score.totalTicks / score.barTicks) * (score.barTicks / TICKS_PER_QUARTER);
  const keyPc = parseNote(lick.key)?.pc ?? 0;
  const scaleDef = findScale(lick.scale);
  const pcs = useMemo(() => (scaleDef ? scalePcs(scaleDef, keyPc) : []), [scaleDef, keyPc]);
  const bpm = Math.round((lick.bpm * speed) / 100);
  const heard = useHeardBeat(engine, playing);
  const pos = heard === null || heard < 0 ? null : heard % lengthBeats;
  const activeBeat = pos === null ? null : score.beats.findIndex((b) => pos * TICKS_PER_QUARTER >= b.start && pos * TICKS_PER_QUARTER < b.start + b.ticks);
  const events = useMemo(() => texEvents(score, STANDARD), [score]);
  const marks: FretMark[] = useMemo(() => {
    const seen = new Map<string, FretMark>();
    for (const e of events) {
      const deg = degreeOf(e.midi, keyPc);
      seen.set(`${e.string}:${e.fret}`, { string: e.string, fret: e.fret, label: deg, role: pcs.includes(((e.midi % 12) + 12) % 12) ? degreeRole(deg) : 'other' });
    }
    return [...seen.values()];
  }, [events, keyPc, pcs]);
  const active = pos === null ? [] : events.filter((e) => pos >= e.onsetBeat && pos < e.onsetBeat + e.durationBeats).map((e) => ({ string: e.string, fret: e.fret, tone: 'play' as const }));
  const maxFret = Math.max(12, ...events.map((e) => e.fret + 2));
  const minFret = Math.max(0, Math.min(...events.map((e) => e.fret)) - 2);

  const start = useCallback(async () => {
    const e = await ensure();
    e.prepare({ bpm, loopBeats: loop ? lengthBeats : null, countInBars: 1 });
    if (click) e.addMetronome(lengthBeats);
    e.addLead(notes, 0, true);
    e.start();
    setPlaying(true);
  }, [ensure, bpm, loop, lengthBeats, click, notes]);
  const stop = useCallback(() => {
    peekEngine()?.stop();
    setPlaying(false);
  }, []);
  // A one-shot play ends by itself.
  useEffect(() => {
    if (!playing || loop) return;
    const id = window.setTimeout(stop, (((lengthBeats + 4) * 60) / bpm) * 1000 + 600);
    return () => window.clearTimeout(id);
  }, [playing, loop, lengthBeats, bpm, stop]);
  useEffect(() => {
    if (playing) peekEngine()?.setBpm(bpm);
  }, [bpm, playing]);
  // Restart playback when the notes (a mutation) or the loop/click options change.
  const startRef = useLatest(start);
  const playingRef = useLatest(playing);
  useEffect(() => {
    if (playingRef.current) void startRef.current();
  }, [notes, loop, click, playingRef, startRef]);
  useEffect(() => () => peekEngine()?.reset(), []);

  const apply = (m: Mutation, name: string) => {
    setError(null);
    try {
      const r = mutateLick(lick, m);
      setSteps((s) => [...s, { mutation: m, label: name, lick: r.lick, explanation: r.explanation, warnings: r.warnings }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That change does not fit this lick.');
    }
  };

  const artist = findArtist(base.artist);
  const grooveId = grooveFor(lick);
  const groove = GROOVES.find((g) => g.id === grooveId)!;
  const backingHref = `/studio?s=${encodeJam({ v: 1, mode: 'studio', groove: grooveId, key: canonicalKey(lick.key), licks: [base.id], scale: groove.scales.includes(lick.scale) ? lick.scale : undefined })}`;

  return (
    <div className="grid gap-4">
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            {lick.title}
            <Badge tone="accent">{label(lick.genre)}</Badge>
            <Badge>level {lick.difficulty}</Badge>
          </span>
        }
        subtitle={`In the style of ${lick.artist} · ${lick.key} ${scaleDef?.name ?? lick.scale} over ${lick.chord} · ${lick.bpm} BPM · ${lick.timeSignature}`}
        actions={<PlayButton playing={playing} onPlay={() => void start()} onStop={stop} size="md" />}
      >
        <TabView score={score} tuning={STANDARD} keyPc={keyPc} scalePcs={pcs} activeBeat={activeBeat === -1 ? null : activeBeat} label={`Tab for ${lick.title}`} />
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Speed" hint={`${bpm} BPM. Tempo changes never change pitch.`}>
            {(id) => <Slider id={id} label="Playback speed in percent" value={speed} min={25} max={150} step={5} onChange={setSpeed} format={(v) => `${v}%`} />}
          </Field>
          <div className="flex flex-wrap gap-4 pb-1">
            <Toggle checked={loop} onChange={setLoop} label="Loop" />
            <Toggle checked={click} onChange={setClick} label="Click" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {lick.techniques.map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink">{lick.theory}</p>
        {artist && (
          <p className="mt-2 text-sm text-muted">
            {artist.name}: {artist.traits}. Tone: {artist.tone}.
          </p>
        )}
      </Card>

      <Card title="On the neck" subtitle="Each position the lick uses, coloured by its degree in the key. White rings follow the playback.">
        <Fretboard tuning={STANDARD} marks={marks} active={active} startFret={minFret} frets={Math.min(24, maxFret)} label={`Positions used by ${lick.title}`} onPlay={(_s, _f, midi) => engine?.playNow([midi], 'sequence')} />
        <div className="mt-3">
          <DegreeLegend roles={['root', 'third', 'fifth', 'seventh', 'ext', 'other']} />
        </div>
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-accent" aria-hidden /> Lick mutator
          </span>
        }
        subtitle="Change one thing at a time. Each step keeps the tab playable and explains what it did."
        actions={
          steps.length > 0 && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setSteps((s) => s.slice(0, -1))}>
                <Undo2 className="h-4 w-4" aria-hidden /> Undo
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSteps([])}>
                Back to the original
              </Button>
            </>
          )
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-end gap-2">
            <Field label="New key" className="flex-1">
              {(id) => (
                <Select id={id} value={toKey} onChange={(e) => setToKey(e.target.value)}>
                  {KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Button onClick={() => apply({ op: 'transpose', toKey }, `In ${toKey}`)}>
              <Music className="h-4 w-4" aria-hidden /> Move
            </Button>
          </div>
          <div className="flex items-end gap-2">
            <Field label="End on the 3rd of" className="flex-1">
              {(id) => <input id={id} value={target} onChange={(e) => setTarget(e.target.value.slice(0, 12))} className="h-10 w-full rounded-xl border border-line bg-surface/80 px-3 font-mono text-sm text-ink" />}
            </Field>
            <Button onClick={() => apply({ op: 'retarget', chord: target.trim() }, `Lands on ${target.trim()}`)} disabled={!target.trim()}>
              <Target className="h-4 w-4" aria-hidden /> Retarget
            </Button>
          </div>
          <Button onClick={() => apply({ op: 'displace' }, 'Shifted an eighth')}>
            <Shuffle className="h-4 w-4" aria-hidden /> Shift by an eighth
          </Button>
          <Button onClick={() => apply({ op: 'flip' }, 'Flipped')}>
            <FlipVertical2 className="h-4 w-4" aria-hidden /> Flip contour
          </Button>
          <Button onClick={() => apply({ op: 'reverse' }, 'Backwards')} className="sm:col-span-2">
            Backwards
          </Button>
        </div>
        {error && (
          <div className="mt-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        {steps.length > 0 && (
          <ol className="mt-4 grid gap-2">
            {steps.map((s, i) => (
              <li key={`${s.lick.id}-${i}`} className="rounded-xl border border-line px-3 py-2.5 text-sm">
                <p className="font-medium text-ink">
                  {i + 1}. {s.label}
                </p>
                <p className="mt-0.5 text-muted">{s.explanation}</p>
                {s.warnings.map((w) => (
                  <p key={w} className="mt-1 text-xs text-amber-300">
                    {w}
                  </p>
                ))}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card title="Use it">
        <div className="flex flex-wrap gap-2">
          <Link href={backingHref} className="inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink">
            Practise over a {groove.name.toLowerCase()} track
          </Link>
        </div>
      </Card>
    </div>
  );
}
