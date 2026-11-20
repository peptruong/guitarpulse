'use client';
import { memo, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { pcName } from '@guitarpulse/core/theory/notes';
import { ROLE_STYLE, type DegreeRole } from '@/lib/degrees';
import { useMediaQuery } from '@/lib/hooks';

export interface FretMark {
  /** 1 = highest-pitched string. */
  string: number;
  fret: number;
  label: string;
  role: DegreeRole;
  emphasis?: 'strong' | 'normal' | 'dim';
  /** 0-1 for heatmaps. */
  heat?: number;
}

export interface ActiveNote {
  string: number;
  fret: number;
  tone?: 'you' | 'app' | 'play';
}

interface Props {
  /** MIDI notes of the open strings, lowest string first. */
  tuning: number[];
  frets?: number;
  startFret?: number;
  marks: FretMark[];
  active?: ActiveNote[];
  heat?: boolean;
  leftHanded?: boolean;
  orientation?: 'auto' | 'horizontal' | 'vertical';
  onPlay?: (string: number, fret: number, midi: number) => void;
  label: string;
  preferFlats?: boolean;
}

const S = 26; // string spacing
const PAD = 30; // margin around the neck
const ACTIVE_COLOR = { you: '#22d3ee', app: '#f59e0b', play: '#f8fafc' } as const;
const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];

function shapePath(shape: (typeof ROLE_STYLE)[DegreeRole]['shape'], x: number, y: number, r: number) {
  const pts = (n: number, rot: number) =>
    Array.from({ length: n }, (_, i) => {
      const a = rot + (i * 2 * Math.PI) / n;
      return `${(x + r * Math.cos(a)).toFixed(2)},${(y + r * Math.sin(a)).toFixed(2)}`;
    }).join(' ');
  switch (shape) {
    case 'diamond':
      return { kind: 'polygon' as const, points: pts(4, -Math.PI / 2) };
    case 'triangle':
      return { kind: 'polygon' as const, points: pts(3, -Math.PI / 2) };
    case 'hexagon':
      return { kind: 'polygon' as const, points: pts(6, 0) };
    default:
      return null;
  }
}

function FretboardImpl({ tuning, frets = 15, startFret = 0, marks, active = [], heat = false, leftHanded = false, orientation = 'auto', onPlay, label, preferFlats = false }: Props) {
  const narrow = useMediaQuery('(max-width: 640px)');
  const vertical = orientation === 'vertical' || (orientation === 'auto' && narrow);
  const n = tuning.length;
  const first = Math.max(0, Math.min(startFret, frets - 1));
  const a = first === 0 ? 0 : first - 1; // leftmost wire drawn
  const span = frets - a;
  const neckLen = vertical ? Math.max(420, span * 40) : Math.max(620, span * 58);
  const openRoom = first === 0 ? 34 : 14;

  const geo = useMemo(() => {
    const real = (j: number) => 1 - 2 ** (-j / 12);
    const wire = (j: number) => {
      const r = (real(j) - real(a)) / (real(frets) - real(a));
      const lin = (j - a) / span;
      return openRoom + neckLen * (0.55 * r + 0.45 * lin);
    };
    const across = (n - 1) * S;
    const width = vertical ? across + PAD * 2 : openRoom + neckLen + PAD;
    const height = vertical ? openRoom + neckLen + PAD : across + PAD * 2 + 6;
    // u: along the neck from the nut side, v: across the strings.
    const vOf = (s: number) => (vertical ? (leftHanded ? (s - 1) * S : (n - s) * S) : (s - 1) * S);
    const toXY = (u: number, v: number) => {
      if (vertical) return { x: PAD + v, y: u + 10 };
      return { x: leftHanded ? width - u - 6 : u + 6, y: PAD + v };
    };
    const cellU = (fret: number) => (fret === 0 ? openRoom - 16 : (wire(fret - 1) + wire(fret)) / 2);
    return { wire, width, height, vOf, toXY, cellU, across };
  }, [a, frets, span, neckLen, openRoom, n, vertical, leftHanded]);

  const markMap = useMemo(() => new Map(marks.map((m) => [`${m.string}:${m.fret}`, m])), [marks]);
  const fretList = useMemo(() => Array.from({ length: frets - first + 1 }, (_, i) => first + i), [first, frets]);
  const [focus, setFocus] = useState<{ s: number; f: number }>({ s: 1, f: first });
  const cellRefs = useRef(new Map<string, SVGRectElement>());

  const noteName = (s: number, f: number) => pcName(tuning[n - s] + f, preferFlats);
  const midiAt = (s: number, f: number) => tuning[n - s] + f;

  const onKey = (e: KeyboardEvent<SVGRectElement>, s: number, f: number) => {
    let ns = s;
    let nf = f;
    const alongPlus = leftHanded && !vertical ? -1 : 1;
    if (e.key === 'ArrowRight') vertical ? (ns = leftHanded ? s + 1 : s - 1) : (nf = f + alongPlus);
    else if (e.key === 'ArrowLeft') vertical ? (ns = leftHanded ? s - 1 : s + 1) : (nf = f - alongPlus);
    else if (e.key === 'ArrowDown') vertical ? (nf = f + 1) : (ns = s + 1);
    else if (e.key === 'ArrowUp') vertical ? (nf = f - 1) : (ns = s - 1);
    else if (e.key === 'Home') nf = first;
    else if (e.key === 'End') nf = frets;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPlay?.(s, f, midiAt(s, f));
      return;
    } else return;
    e.preventDefault();
    ns = Math.min(n, Math.max(1, ns));
    nf = Math.min(frets, Math.max(first, nf));
    setFocus({ s: ns, f: nf });
    cellRefs.current.get(`${ns}:${nf}`)?.focus();
  };

  const { wire, width, height, vOf, toXY, cellU, across } = geo;
  const line = (u1: number, v1: number, u2: number, v2: number) => {
    const p = toXY(u1, v1);
    const q = toXY(u2, v2);
    return { x1: p.x, y1: p.y, x2: q.x, y2: q.y };
  };
  const midV = across / 2;

  return (
    <div className={vertical ? 'w-full' : 'w-full overflow-x-auto'} style={vertical ? undefined : { WebkitOverflowScrolling: 'touch' }}>
      <svg viewBox={`0 0 ${width} ${height}`} className={vertical ? 'mx-auto block h-auto w-full max-w-[22rem]' : 'block h-auto w-full'} style={vertical ? undefined : { minWidth: `${Math.min(width, 980)}px` }} role="group" aria-label={label}>
        <defs>
          <linearGradient id="fb-wood" x1="0" x2={vertical ? '1' : '0'} y1="0" y2={vertical ? '0' : '1'}>
            <stop offset="0" stopColor="#1e1b2e" />
            <stop offset="1" stopColor="#141221" />
          </linearGradient>
        </defs>
        {/* Neck */}
        {(() => {
          const p = toXY(first === 0 ? openRoom : wire(a), -10);
          const q = toXY(wire(frets), across + 10);
          return <rect x={Math.min(p.x, q.x)} y={Math.min(p.y, q.y)} width={Math.abs(q.x - p.x)} height={Math.abs(q.y - p.y)} rx={4} fill="url(#fb-wood)" stroke="rgb(148 163 184 / 0.15)" />;
        })()}
        {/* Inlays */}
        {fretList
          .filter((f) => f > 0 && (INLAYS.includes(f) || f === 12 || f === 24))
          .map((f) => {
            const u = cellU(f);
            const dots = f === 12 || f === 24 ? [midV - S, midV + S] : [midV];
            return dots.map((v, i) => {
              const p = toXY(u, v);
              return <circle key={`${f}-${i}`} cx={p.x} cy={p.y} r={4.5} fill="rgb(148 163 184 / 0.16)" />;
            });
          })}
        {/* Frets and nut */}
        {Array.from({ length: frets - a + 1 }, (_, i) => a + i).map((j) => (
          <line key={`w${j}`} {...line(wire(j), -10, wire(j), across + 10)} stroke={j === 0 ? '#e2e8f0' : 'rgb(148 163 184 / 0.45)'} strokeWidth={j === 0 ? 5 : 1.6} strokeLinecap="round" />
        ))}
        {/* Strings (thicker for lower strings) */}
        {Array.from({ length: n }, (_, i) => i + 1).map((s) => (
          <line key={`s${s}`} {...line(first === 0 ? openRoom - 26 : wire(a), vOf(s), wire(frets), vOf(s))} stroke="rgb(203 213 225 / 0.55)" strokeWidth={0.7 + ((s - 1) / Math.max(1, n - 1)) * 1.6} />
        ))}
        {/* Fret numbers */}
        {fretList
          .filter((f) => f === first || INLAYS.includes(f) || f === 12 || f === 24 || f === 1)
          .map((f) => {
            if (f === 0) return null;
            const p = toXY(cellU(f), vertical ? -18 : across + 22);
            const q = vertical ? { x: leftHanded ? width - 12 : 12, y: p.y + 4 } : { x: p.x, y: p.y };
            return (
              <text key={`n${f}`} x={q.x} y={q.y} textAnchor="middle" className="fill-slate-500 font-mono" fontSize={11}>
                {f}
              </text>
            );
          })}
        {/* String names at the nut */}
        {first === 0 &&
          Array.from({ length: n }, (_, i) => i + 1).map((s) => {
            const p = toXY(openRoom - 30, vOf(s));
            const q = vertical ? { x: p.x, y: 10 } : { x: leftHanded ? p.x + 2 : p.x - 2, y: p.y + 4 };
            return (
              <text key={`t${s}`} x={q.x} y={q.y} textAnchor="middle" fontSize={10.5} className="fill-slate-500 font-mono">
                {noteName(s, 0)}
              </text>
            );
          })}
        {/* Hit targets for playing notes (keyboard: arrows move, Enter plays) */}
        {onPlay &&
          Array.from({ length: n }, (_, i) => i + 1).flatMap((s) =>
            fretList.map((f) => {
              const u0 = f === 0 ? openRoom - 30 : wire(f - 1);
              const u1 = f === 0 ? openRoom : wire(f);
              const p = toXY(u0, vOf(s) - S / 2);
              const q = toXY(u1, vOf(s) + S / 2);
              const mark = markMap.get(`${s}:${f}`);
              const isFocus = focus.s === s && focus.f === f;
              return (
                <rect
                  key={`h${s}-${f}`}
                  ref={(el) => {
                    if (el) cellRefs.current.set(`${s}:${f}`, el);
                    else cellRefs.current.delete(`${s}:${f}`);
                  }}
                  x={Math.min(p.x, q.x)}
                  y={Math.min(p.y, q.y)}
                  width={Math.abs(q.x - p.x)}
                  height={Math.abs(q.y - p.y)}
                  fill="transparent"
                  className="cursor-pointer outline-none focus-visible:fill-cyan-400/15"
                  role="button"
                  tabIndex={isFocus ? 0 : -1}
                  aria-label={`String ${s}, ${f === 0 ? 'open' : `fret ${f}`}: ${noteName(s, f)}${mark ? `, ${mark.label}` : ''}`}
                  onFocus={() => setFocus({ s, f })}
                  onClick={() => onPlay(s, f, midiAt(s, f))}
                  onKeyDown={(e) => onKey(e, s, f)}
                />
              );
            }),
          )}
        {/* Marks */}
        <g pointerEvents="none">
          {marks
            .filter((m) => m.fret >= first && m.fret <= frets && m.string >= 1 && m.string <= n)
            .map((m) => {
              const { x, y } = toXY(cellU(m.fret), vOf(m.string));
              const style = ROLE_STYLE[m.role];
              const opacity = m.emphasis === 'dim' ? 0.32 : 1;
              if (heat) {
                const h = Math.max(0, Math.min(1, m.heat ?? 0));
                return (
                  <g key={`m${m.string}-${m.fret}`} opacity={opacity}>
                    <circle cx={x} cy={y} r={6 + h * 7} fill="#22d3ee" fillOpacity={0.18 + h * 0.7} stroke="#22d3ee" strokeOpacity={0.5 + h * 0.5} />
                    {m.label && (
                      <text x={x} y={y + 3.5} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={h > 0.55 ? '#042f37' : '#e2e8f0'} className="font-mono">
                        {m.label}
                      </text>
                    )}
                  </g>
                );
              }
              const r = 10.5;
              const poly = shapePath(style.shape, x, y, style.shape === 'triangle' ? r * 1.25 : style.shape === 'diamond' ? r * 1.2 : r * 1.05);
              const ring = style.shape === 'ring';
              return (
                <g key={`m${m.string}-${m.fret}`} opacity={opacity}>
                  {m.emphasis === 'strong' && <circle cx={x} cy={y} r={r + 4} fill="none" stroke="#f8fafc" strokeWidth={1.6} strokeOpacity={0.85} />}
                  {style.shape === 'square' && <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={3} fill={style.color} />}
                  {style.shape === 'circle' && <circle cx={x} cy={y} r={r} fill={style.color} />}
                  {ring && <circle cx={x} cy={y} r={r - 1} fill="#0f172a" stroke={style.color} strokeWidth={2} strokeDasharray="3 2" />}
                  {poly && <polygon points={poly.points} fill={style.color} />}
                  <text x={x} y={y + (style.shape === 'triangle' ? 5 : 3.6)} textAnchor="middle" fontSize={m.label.length > 2 ? 8.5 : 10} fontWeight={700} fill={ring ? style.color : '#0b0f19'} className="font-mono">
                    {m.label}
                  </text>
                </g>
              );
            })}
          {active.map((a2, i) => {
            if (a2.fret < first || a2.fret > frets) return null;
            const { x, y } = toXY(cellU(a2.fret), vOf(a2.string));
            const color = ACTIVE_COLOR[a2.tone ?? 'play'];
            return (
              <g key={`a${i}`}>
                <circle cx={x} cy={y} r={15} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={2.5} />
                <circle cx={x} cy={y} r={4} fill={color} />
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export const Fretboard = memo(FretboardImpl);

export function DegreeLegend({ roles = ['root', 'third', 'fifth', 'seventh', 'ext'] as DegreeRole[] }: { roles?: DegreeRole[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Colour key">
      {roles.map((r) => {
        const st = ROLE_STYLE[r];
        return (
          <li key={r} className="flex items-center gap-1.5">
            <svg viewBox="-12 -12 24 24" className="h-3.5 w-3.5" aria-hidden>
              {st.shape === 'square' && <rect x={-9} y={-9} width={18} height={18} rx={3} fill={st.color} />}
              {st.shape === 'circle' && <circle r={9} fill={st.color} />}
              {st.shape === 'ring' && <circle r={8} fill="none" stroke={st.color} strokeWidth={2.5} strokeDasharray="3 2" />}
              {(() => {
                const p = shapePath(st.shape, 0, 0, st.shape === 'triangle' ? 11 : 10.5);
                return p ? <polygon points={p.points} fill={st.color} /> : null;
              })()}
            </svg>
            {st.label}
          </li>
        );
      })}
    </ul>
  );
}
