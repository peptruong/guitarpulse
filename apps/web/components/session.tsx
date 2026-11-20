'use client';
import { useEffect, useState } from 'react';
import { Check, Copy, Pause, Play, Square } from 'lucide-react';
import type { ChordSpan } from '@guitarpulse/core/coach/assess';
import { GROOVES, getGroove } from '@guitarpulse/core/grooves';
import { midiName } from '@guitarpulse/core/theory/notes';
import { findScale, SCALES, type ScaleFamily } from '@guitarpulse/core/theory/scales';
import { MIX_PARTS, type Engine, type MixPart } from '@/lib/audio/engine';
import { KEYS, type JamSettings } from '@/lib/settings';
import { Button, cx, Field, Select, Slider } from './ui';

export const FAMILY_LABEL: Record<ScaleFamily, string> = {
  pentatonic: 'Pentatonic',
  blues: 'Blues',
  'major-modes': 'Modes of the major scale',
  'harmonic-minor': 'Harmonic minor modes',
  'melodic-minor': 'Melodic minor modes',
  symmetric: 'Symmetric',
  bebop: 'Bebop',
  exotic: 'World and exotic',
  'east-asian': 'East Asian (Chinese and Okinawan)',
  vietnamese: 'Vietnamese (ngũ cung and cải lương)',
};

export function ScaleOptions() {
  const families = [...new Set(SCALES.map((s) => s.family))];
  return (
    <>
      {families.map((f) => (
        <optgroup key={f} label={FAMILY_LABEL[f]}>
          {SCALES.filter((s) => s.family === f).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

export function GrooveOptions() {
  return (
    <>
      <optgroup label="Styles">
        {GROOVES.filter((g) => g.category === 'core').map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="Asia sound pack">
        {GROOVES.filter((g) => g.category === 'asia').map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </optgroup>
    </>
  );
}

/** Groove, progression, key, tempo and scale. Changing groove resets the rest to that groove's defaults. */
export function SettingsPanel({ value, onChange, disabled, lockTempo, showScale = true }: { value: JamSettings; onChange: (v: JamSettings) => void; disabled?: boolean; lockTempo?: boolean; showScale?: boolean }) {
  const g = getGroove(value.grooveId);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Style" className="col-span-2">
        {(id) => (
          <Select
            id={id}
            value={value.grooveId}
            disabled={disabled}
            onChange={(e) => {
              const ng = getGroove(e.target.value);
              onChange({ grooveId: ng.id, progression: 0, key: ng.progressions[0].key, bpm: ng.bpm.default, scale: ng.scales[0] });
            }}
          >
            <GrooveOptions />
          </Select>
        )}
      </Field>
      <Field label="Progression" className="col-span-2">
        {(id) => (
          <Select id={id} value={value.progression} disabled={disabled || g.progressions.length < 2} onChange={(e) => onChange({ ...value, progression: Number(e.target.value), key: value.key })}>
            {g.progressions.map((p, i) => (
              <option key={p.name} value={i}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Key">
        {(id) => (
          <Select id={id} value={value.key} disabled={disabled} onChange={(e) => onChange({ ...value, key: e.target.value })}>
            {KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {showScale && (
        <Field label="Scale">
          {(id) => (
            <Select id={id} value={value.scale} disabled={disabled} onChange={(e) => onChange({ ...value, scale: e.target.value })}>
              <optgroup label={`Suggested for ${g.name}`}>
                {g.scales.map((s) => (
                  <option key={`sug-${s}`} value={s}>
                    {findScale(s)?.name ?? s}
                  </option>
                ))}
              </optgroup>
              <ScaleOptions />
            </Select>
          )}
        </Field>
      )}
      <Field label="Tempo" className="col-span-2" hint={lockTempo ? 'Tempo is fixed while the coach is listening.' : `${g.name} sits well between ${g.bpm.min} and ${g.bpm.max} BPM.`}>
        {(id) => <Slider id={id} label="Tempo in beats per minute" value={value.bpm} min={40} max={240} onChange={(bpm) => onChange({ ...value, bpm })} format={(v) => `${v} bpm`} disabled={lockTempo} />}
      </Field>
    </div>
  );
}

export function PlayButton({ playing, onPlay, onStop, disabled, playLabel = 'Play', stopLabel = 'Stop', size = 'lg' }: { playing: boolean; onPlay: () => void; onStop: () => void; disabled?: boolean; playLabel?: string; stopLabel?: string; size?: 'md' | 'lg' }) {
  return playing ? (
    <Button variant="secondary" size={size} onClick={onStop} aria-label={stopLabel}>
      <Square className="h-4 w-4 fill-current" aria-hidden />
      {stopLabel}
    </Button>
  ) : (
    <Button variant="primary" size={size} onClick={onPlay} disabled={disabled} aria-label={playLabel}>
      <Play className="h-4 w-4 fill-current" aria-hidden />
      {playLabel}
    </Button>
  );
}

export function PauseIcon() {
  return <Pause className="h-4 w-4" aria-hidden />;
}

/** The chord timeline laid out like a lead sheet: four bars per row, the sounding chord lit. */
export function ChordStrip({ chords, loopBeats, beat, onSelect }: { chords: ChordSpan[]; loopBeats: number; beat: number | null; onSelect?: (index: number) => void }) {
  const pos = beat === null || beat < 0 ? null : ((beat % loopBeats) + loopBeats) % loopBeats;
  return (
    <ol className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' }} aria-label="Chord timeline">
      {chords.map((c, i) => {
        const on = pos !== null && pos >= c.startBeat && pos < c.endBeat;
        const pct = on ? ((pos - c.startBeat) / (c.endBeat - c.startBeat)) * 100 : 0;
        const span = Math.max(1, Math.min(8, Math.round((c.endBeat - c.startBeat) / 2)));
        const startCol = (Math.round(c.startBeat / 2) % 8) + 1;
        return (
          <li key={`${c.symbol}-${c.startBeat}`} style={{ gridColumn: `${startCol} / span ${Math.min(span, 9 - startCol)}` }} className="min-w-0">
            <button
              type="button"
              onClick={onSelect ? () => onSelect(i) : undefined}
              disabled={!onSelect}
              aria-current={on ? 'step' : undefined}
              className={cx(
                'relative flex h-12 w-full flex-col justify-center overflow-hidden rounded-xl border px-2.5 text-left transition-colors',
                on ? 'border-accent/70 bg-accent/15 text-ink' : 'border-line bg-surface/60 text-muted',
                onSelect ? 'cursor-pointer hover:border-line-strong' : 'cursor-default',
              )}
            >
              <span className="relative z-10 truncate font-mono text-sm font-semibold">{c.symbol}</span>
              <span className="relative z-10 truncate text-[0.65rem] text-faint">bar {Math.floor(c.startBeat / 4) + 1}</span>
              {on && <span className="absolute inset-y-0 left-0 bg-accent/15" style={{ width: `${pct}%` }} aria-hidden />}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

const MIX_KEY = 'guitarpulse-mix';
type MixState = Record<MixPart, { db: number; muted: boolean }>;
const DEFAULT_MIX: MixState = { drums: { db: -2, muted: false }, bass: { db: -4, muted: false }, keys: { db: -9, muted: false }, pad: { db: -14, muted: false }, lead: { db: -6, muted: false } };

function loadMix(): MixState {
  try {
    const raw = window.localStorage.getItem(MIX_KEY);
    if (!raw) return DEFAULT_MIX;
    const parsed = JSON.parse(raw) as Partial<MixState>;
    return Object.fromEntries(MIX_PARTS.map((p) => [p.id, { ...DEFAULT_MIX[p.id], ...(parsed[p.id] ?? {}) }])) as MixState;
  } catch {
    return DEFAULT_MIX;
  }
}

/** Per-part volume and mute; remembered on this device. */
export function Mixer({ engine, parts = MIX_PARTS.map((p) => p.id) }: { engine: Engine | null; parts?: MixPart[] }) {
  const [mix, setMix] = useState<MixState>(DEFAULT_MIX);
  useEffect(() => setMix(loadMix()), []);
  useEffect(() => {
    if (!engine) return;
    for (const p of MIX_PARTS) {
      engine.setVolume(p.id, mix[p.id].db);
      engine.setMuted(p.id, mix[p.id].muted);
    }
    try {
      window.localStorage.setItem(MIX_KEY, JSON.stringify(mix));
    } catch {
      // Storage can be blocked; the mix still applies for this visit.
    }
  }, [engine, mix]);
  return (
    <div className="grid gap-2.5">
      {MIX_PARTS.filter((p) => parts.includes(p.id)).map((p) => (
        <div key={p.id} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3">
          <span className={cx('text-sm', mix[p.id].muted ? 'text-faint line-through' : 'text-ink')}>{p.label}</span>
          <Slider label={`${p.label} volume`} value={mix[p.id].db} min={-40} max={6} onChange={(db) => setMix((m) => ({ ...m, [p.id]: { ...m[p.id], db } }))} format={(v) => `${v > 0 ? '+' : ''}${v} dB`} />
          <button
            type="button"
            aria-pressed={mix[p.id].muted}
            onClick={() => setMix((m) => ({ ...m, [p.id]: { ...m[p.id], muted: !m[p.id].muted } }))}
            className={cx('h-8 w-8 cursor-pointer rounded-lg border text-xs font-bold', mix[p.id].muted ? 'border-warm/50 bg-warm/15 text-amber-300' : 'border-line text-muted hover:text-ink')}
            aria-label={`Mute ${p.label}`}
          >
            M
          </button>
        </div>
      ))}
    </div>
  );
}

/** The last note heard: name, octave and how far off pitch it was. */
export function NoteMeter({ midi, cents, listening }: { midi: number | null; cents: number; listening: boolean }) {
  const off = Math.max(-50, Math.min(50, cents));
  return (
    <div className="flex items-center gap-4" aria-live="off">
      <div className={cx('grid h-16 w-16 shrink-0 place-items-center rounded-2xl border font-mono text-xl font-bold', listening ? 'animate-pulse-ring border-accent/50 bg-accent/10 text-accent' : 'border-line bg-white/5 text-faint')}>{midi === null ? '–' : midiName(midi, false)}</div>
      <div className="min-w-0 flex-1">
        <div className="relative h-2 rounded-full bg-white/5">
          <span className="absolute top-1/2 left-1/2 h-4 w-px -translate-y-1/2 bg-slate-500" aria-hidden />
          {midi !== null && <span className={cx('absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full', Math.abs(off) <= 12 ? 'bg-emerald-400' : 'bg-amber-400')} style={{ left: `${50 + off}%` }} aria-hidden />}
        </div>
        <p className="mt-1.5 text-xs text-muted">{midi === null ? (listening ? 'Listening… play a note' : 'Not listening') : `${off > 0 ? '+' : ''}${Math.round(off)} cents ${Math.abs(off) <= 12 ? '(in tune)' : off > 0 ? '(sharp)' : '(flat)'}`}</p>
      </div>
    </div>
  );
}

export interface RollNote {
  midi: number;
  onsetBeat: number;
  durationBeats: number;
  who?: 'you' | 'app';
}

/** A small piano roll for phrases (trading-fours transcripts, coach replay). */
export function PianoRoll({ notes, fromBeat, beats, playhead, height = 96, label }: { notes: RollNote[]; fromBeat: number; beats: number; playhead?: number | null; height?: number; label: string }) {
  const w = 640;
  const lo = notes.length ? Math.min(...notes.map((n) => n.midi)) - 2 : 52;
  const hi = notes.length ? Math.max(...notes.map((n) => n.midi)) + 2 : 76;
  const range = Math.max(12, hi - lo);
  const x = (b: number) => ((b - fromBeat) / beats) * w;
  const y = (m: number) => height - ((m - lo) / range) * (height - 8) - 4;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="block h-auto w-full" role="img" aria-label={label}>
      <rect width={w} height={height} rx={10} fill="rgb(15 23 42 / 0.6)" />
      {Array.from({ length: Math.floor(beats / 4) + 1 }, (_, i) => (
        <line key={i} x1={x(fromBeat + i * 4)} x2={x(fromBeat + i * 4)} y1={0} y2={height} stroke="rgb(148 163 184 / 0.18)" />
      ))}
      {notes.map((n, i) => (
        <rect key={i} x={x(n.onsetBeat)} y={y(n.midi) - 3} width={Math.max(3, x(n.onsetBeat + n.durationBeats) - x(n.onsetBeat) - 1)} height={6} rx={2} fill={n.who === 'app' ? '#f59e0b' : '#22d3ee'} />
      ))}
      {playhead !== null && playhead !== undefined && playhead >= fromBeat && playhead <= fromBeat + beats && <line x1={x(playhead)} x2={x(playhead)} y1={0} y2={height} stroke="#f8fafc" strokeWidth={1.5} />}
    </svg>
  );
}

export function Sparkline({ values, label, better }: { values: number[]; label: string; better: 'higher' | 'lower' }) {
  const w = 160;
  const h = 40;
  if (values.length < 2) return <p className="text-xs text-faint">Play two sessions to see a trend.</p>;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (w - 8) + 4},${h - 4 - ((v - lo) / span) * (h - 8)}`).join(' ');
  const delta = values[values.length - 1] - values[0];
  const good = better === 'higher' ? delta >= 0 : delta <= 0;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-40" role="img" aria-label={`${label}: from ${values[0]} to ${values[values.length - 1]}`}>
      <polyline points={pts} fill="none" stroke={good ? '#34d399' : '#fb7185'} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function CopyButton({ text, label = 'Copy link' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1800);
        } catch {
          window.prompt('Copy this link:', text);
        }
      }}
    >
      {done ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {done ? 'Copied' : label}
    </Button>
  );
}
