'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { getTuning, parseNote, prefersFlats, TUNINGS } from '@guitarpulse/core/theory/notes';
import { findScale, getScale } from '@guitarpulse/core/theory/scales';
import { getChordVoicings, VOICING_SYSTEMS, type Voicing, type VoicingSystem } from '@guitarpulse/core/theory/voicings';
import { encodeJam } from '@guitarpulse/core/session';
import { GROOVES } from '@guitarpulse/core/grooves';
import { DegreeLegend, Fretboard } from '@/components/Fretboard';
import { useAudio } from '@/components/Providers';
import { FAMILY_LABEL, ScaleOptions } from '@/components/session';
import { Badge, Button, Card, cx, Field, Notice, PageHeader, Segmented, Select, Toggle } from '@/components/ui';
import { scaleMarks } from '@/lib/marks';
import { KEYS } from '@/lib/settings';

const SYSTEM_LABEL: Record<VoicingSystem, string> = { caged: 'CAGED shapes', triad: 'Triads', shell: 'Shell voicings', drop2: 'Drop 2', drop3: 'Drop 3' };

export function Scales() {
  const [tab, setTab] = useState<'scales' | 'chords'>('scales');
  return (
    <>
      <PageHeader
        eyebrow="Scales and chords"
        title="Every scale, on the whole neck"
        description="Pick a root and any of the scales, in any tuning. Shapes and colours stay the same everywhere in GuitarPulse: squares are roots, circles 3rds, diamonds 5ths, triangles 7ths."
        actions={<Segmented label="Show" value={tab} onChange={setTab} options={[{ value: 'scales', label: 'Scales' }, { value: 'chords', label: 'Chord voicings' }]} />}
      />
      {tab === 'scales' ? <ScaleExplorer /> : <ChordExplorer />}
    </>
  );
}

function ScaleExplorer() {
  const { ensure } = useAudio();
  const [root, setRoot] = useState('A');
  const [scaleId, setScaleId] = useState('minor-pentatonic');
  const [tuning, setTuning] = useState('standard');
  const [view, setView] = useState<'full' | 'box' | '3nps'>('full');
  const [position, setPosition] = useState(1);
  const [labels, setLabels] = useState<'degrees' | 'notes'>('degrees');
  const [leftHanded, setLeftHanded] = useState(false);
  const [frets, setFrets] = useState(15);
  const def = findScale(scaleId)!;
  const sizeOk = view === 'box' ? def.degrees.length === 5 : view === '3nps' ? def.degrees.length === 7 : true;
  const pattern = sizeOk ? view : 'full';
  const info = useMemo(() => getScale({ root, scale: scaleId, tuning, pattern, position, maxFret: frets }), [root, scaleId, tuning, pattern, position, frets]);
  const marks = useMemo(() => scaleMarks({ root, scale: scaleId, tuning, pattern, position, maxFret: frets, labels }), [root, scaleId, tuning, pattern, position, frets, labels]);
  const flats = useMemo(() => {
    const n = parseNote(root);
    return n ? prefersFlats(n) : false;
  }, [root]);
  const playScale = async () => {
    const e = await ensure();
    const base = 48 + (parseNote(root)?.pc ?? 9);
    const notes = [...info.semitones.map((s) => base + s), base + 12];
    e.playNow(notes, 'sequence', 0.32, 0.5);
  };
  const groove = GROOVES.find((g) => g.scales.includes(scaleId));
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="grid min-w-0 content-start gap-4">
        <Card
          title={info.name}
          subtitle={`${info.notes.join(' · ')}   (${info.formula})`}
          actions={
            <Button size="sm" onClick={() => void playScale()}>
              <Play className="h-4 w-4 fill-current" aria-hidden /> Hear it
            </Button>
          }
        >
          <Fretboard tuning={getTuning(tuning)} marks={marks} frets={frets} leftHanded={leftHanded} preferFlats={flats} label={`${info.name} on the fretboard`} onPlay={(_s, _f, midi) => void ensure().then((e) => e.playNow([midi], 'sequence'))} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <DegreeLegend />
            <Toggle checked={leftHanded} onChange={setLeftHanded} label="Left-handed" />
          </div>
          {!sizeOk && (
            <div className="mt-3">
              <Notice>{view === 'box' ? 'Boxes are for five-note scales; showing the whole neck.' : 'Three-notes-per-string patterns are for seven-note scales; showing the whole neck.'}</Notice>
            </div>
          )}
        </Card>
        <Card title="About this sound">
          <p className="text-sm leading-relaxed text-ink">{def.mood}</p>
          {def.characteristic.length > 0 && <p className="mt-2 text-sm text-muted">Colour notes to land on: {def.characteristic.join(', ')}.</p>}
          {def.inflections && def.inflections.length > 0 && (
            <ul className="mt-3 grid gap-1.5 text-sm">
              {def.inflections.map((x) => (
                <li key={x.degree} className="flex gap-2">
                  <Badge tone="warm">{x.degree}</Badge>
                  <span className="text-ink">{x.how}</span>
                </li>
              ))}
            </ul>
          )}
          {def.about && <p className="mt-3 text-sm leading-relaxed text-muted">{def.about}</p>}
          {groove && (
            <Link href={`/studio?s=${encodeJam({ v: 1, mode: 'studio', groove: groove.id, key: root, scale: scaleId })}`} className="mt-4 inline-flex h-9 items-center rounded-xl border border-line px-3 text-sm text-ink hover:border-accent/50 hover:bg-accent/5">
              Jam with it over {groove.name.toLowerCase()}
            </Link>
          )}
        </Card>
      </div>
      <Card title="Scale" className="content-start">
        <div className="grid gap-3">
          <Field label="Root">
            {(id) => (
              <Select id={id} value={root} onChange={(e) => setRoot(e.target.value)}>
                {KEYS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={`Scale (${FAMILY_LABEL[def.family]})`}>
            {(id) => (
              <Select id={id} value={scaleId} onChange={(e) => setScaleId(e.target.value)}>
                <ScaleOptions />
              </Select>
            )}
          </Field>
          <Field label="Tuning">
            {(id) => (
              <Select id={id} value={tuning} onChange={(e) => setTuning(e.target.value)}>
                {Object.entries(TUNINGS).map(([tid, t]) => (
                  <option key={tid} value={tid}>
                    {t.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Segmented label="View" value={view} onChange={setView} options={[{ value: 'full', label: 'Whole neck' }, { value: 'box', label: 'Boxes' }, { value: '3nps', label: '3 per string' }]} />
          {pattern !== 'full' && <Segmented size="sm" label="Position" value={String(position)} onChange={(v) => setPosition(Number(v))} options={Array.from({ length: view === 'box' ? 5 : 7 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />}
          <Segmented size="sm" label="Labels" value={labels} onChange={setLabels} options={[{ value: 'degrees', label: 'Degrees' }, { value: 'notes', label: 'Note names' }]} />
          <Segmented size="sm" label="Frets shown" value={String(frets)} onChange={(v) => setFrets(Number(v))} options={['12', '15', '22', '24'].map((f) => ({ value: f, label: `${f} frets` }))} />
        </div>
      </Card>
    </div>
  );
}

function ChordBox({ v, onPlay }: { v: Voicing; onPlay: () => void }) {
  const strings = v.frets.length;
  const played = v.frets.filter((f): f is number => f !== null && f > 0);
  const lo = played.length ? Math.min(...played) : 1;
  const base = lo <= 2 ? 1 : lo;
  const rows = 5;
  const w = 20 + (strings - 1) * 16 + 20;
  const h = 28 + rows * 18 + 10;
  const x = (i: number) => 20 + i * 16;
  const y = (fret: number) => 28 + (fret - base + 0.5) * 18;
  return (
    <figure className="flex flex-col items-center gap-1.5 rounded-xl border border-line p-2.5">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-auto" role="img" aria-label={`${v.label}: ${v.chart}, ${v.notes.join(' ')}`}>
        {base === 1 ? <rect x={x(0)} y={26} width={x(strings - 1) - x(0)} height={3} fill="#e2e8f0" /> : <text x={4} y={y(base) + 4} fontSize={9} className="fill-slate-400 font-mono">{base}</text>}
        {Array.from({ length: rows + 1 }, (_, r) => (
          <line key={`f${r}`} x1={x(0)} x2={x(strings - 1)} y1={28 + r * 18} y2={28 + r * 18} stroke="rgb(148 163 184 / 0.45)" />
        ))}
        {Array.from({ length: strings }, (_, i) => (
          <line key={`s${i}`} x1={x(i)} x2={x(i)} y1={28} y2={28 + rows * 18} stroke="rgb(203 213 225 / 0.6)" />
        ))}
        {v.barre && (() => {
          const from = strings - v.barre.fromString;
          const to = strings - v.barre.toString;
          return <rect x={x(Math.min(from, to)) - 6} y={y(v.barre.fret) - 6} width={Math.abs(x(to) - x(from)) + 12} height={12} rx={6} fill="#22d3ee" fillOpacity={0.35} />;
        })()}
        {v.frets.map((f, i) =>
          f === null ? (
            <text key={i} x={x(i)} y={20} textAnchor="middle" fontSize={10} className="fill-slate-500 font-mono">
              ×
            </text>
          ) : f === 0 ? (
            <circle key={i} cx={x(i)} cy={16} r={4} fill="none" stroke="#94a3b8" strokeWidth={1.4} />
          ) : (
            <g key={i}>
              <circle cx={x(i)} cy={y(f)} r={6.5} fill={v.degrees[v.frets.slice(0, i).filter((q) => q !== null).length] === '1' ? '#E69F00' : '#22d3ee'} />
              {v.fingers[i] ? (
                <text x={x(i)} y={y(f) + 3.5} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#0b0f19" className="font-mono">
                  {v.fingers[i]}
                </text>
              ) : null}
            </g>
          ),
        )}
      </svg>
      <figcaption className="text-center">
        <p className="font-mono text-xs text-ink">{v.chart}</p>
        <p className="text-[0.7rem] text-muted">
          {v.label} · {v.inversion}
        </p>
      </figcaption>
      <Button size="sm" variant="ghost" onClick={onPlay} aria-label={`Play ${v.label}`}>
        <Play className="h-3.5 w-3.5 fill-current" aria-hidden /> Strum
      </Button>
    </figure>
  );
}

function ChordExplorer() {
  const { ensure } = useAudio();
  const [chord, setChord] = useState('Cmaj7');
  const [systems, setSystems] = useState<VoicingSystem[]>(['caged', 'drop2', 'shell']);
  const result = useMemo(() => {
    try {
      return { ok: true as const, r: getChordVoicings({ chord: chord.trim() || 'C', systems, limitPerSystem: 6 }) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'That chord could not be read.' };
    }
  }, [chord, systems]);
  const standard = getTuning('standard');
  const strum = async (v: Voicing) => {
    const e = await ensure();
    const midis = v.frets.flatMap((f, i) => (f === null ? [] : [standard[i] + f]));
    e.playNow(midis, 'sequence', 0.035, 1.6);
  };
  return (
    <div className="grid gap-4">
      <Card>
        <div className="grid gap-4 sm:grid-cols-[16rem_1fr] sm:items-end">
          <Field label="Chord" hint="C, Am7, G7, Cmaj9, F#m7b5, Bb7#9, E7alt, Bdim7, C6/9, Dsus4, Am7/G">
            {(id) => <input id={id} value={chord} onChange={(e) => setChord(e.target.value.slice(0, 20))} className="h-10 w-full rounded-xl border border-line bg-surface/80 px-3 font-mono text-sm text-ink" />}
          </Field>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Voicing systems">
            {VOICING_SYSTEMS.map((s) => {
              const on = systems.includes(s);
              return (
                <button key={s} type="button" aria-pressed={on} onClick={() => setSystems((x) => (on ? x.filter((y) => y !== s) : [...x, s]))} className={cx('h-9 cursor-pointer rounded-xl border px-3 text-sm', on ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line text-muted hover:text-ink')}>
                  {SYSTEM_LABEL[s]}
                </button>
              );
            })}
          </div>
        </div>
      </Card>
      {!result.ok ? (
        <Notice tone="error">{result.error}</Notice>
      ) : (
        <>
          <p className="text-sm text-muted">
            {result.r.chord} ({result.r.name}): {result.r.notes.join(' ')} · degrees {result.r.degrees.join(' ')}
          </p>
          {VOICING_SYSTEMS.filter((s) => systems.includes(s)).map((s) => {
            const list = result.r.voicings.filter((v) => v.system === s);
            const skipped = result.r.skipped.find((k) => k.system === s);
            return (
              <Card key={s} title={SYSTEM_LABEL[s]}>
                {list.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {list.map((v) => (
                      <ChordBox key={`${v.chart}-${v.label}`} v={v} onPlay={() => void strum(v)} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">{skipped?.reason ?? 'No voicing in this system for this chord.'}</p>
                )}
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
