'use client';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { bendValues, TICKS_PER_QUARTER, type TexBeat, type TexNote, type TexScore } from '@guitarpulse/core/tex/alphatex';
import { pc } from '@guitarpulse/core/theory/notes';
import { ROLE_STYLE, roleInScale } from '@/lib/degrees';

interface Props {
  score: TexScore;
  /** Open strings, lowest first (MIDI). */
  tuning: number[];
  keyPc: number;
  scalePcs: number[];
  activeBeat?: number | null;
  label: string;
}

const LINE = 13;
const TOP = 30;
const BOTTOM = 40;
const NOTE_FONT = 11.5;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

interface PlacedBeat {
  beat: TexBeat;
  index: number;
  x: number;
  w: number;
}
interface PlacedBar {
  index: number;
  beats: PlacedBeat[];
  x: number;
  width: number;
}

const hasFx = (n: TexNote, fx: string) => new RegExp(`(^|\\s)${fx}(\\s|$|\\()`).test(n.effects);
const fmtBend = (semis: number) => (semis === 0.5 ? '½' : semis === 1 ? 'full' : semis === 1.5 ? '1½' : semis === 0.25 ? '¼' : `${semis}`);

function TabViewImpl({ score, tuning, keyPc, scalePcs, activeBeat = null, label }: Props) {
  const { ref, width } = useWidth();
  const n = tuning.length;
  const staffH = (n - 1) * LINE;
  const rowH = TOP + staffH + BOTTOM;

  const rows = useMemo(() => {
    const bars: PlacedBar[] = [];
    score.beats.forEach((beat, index) => {
      const bi = Math.floor(beat.start / score.barTicks);
      while (bars.length <= bi) bars.push({ index: bars.length, beats: [], x: 0, width: 0 });
      bars[bi].beats.push({ beat, index, x: 0, w: Math.max(22, (beat.ticks / TICKS_PER_QUARTER) * 42) });
    });
    for (const b of bars) {
      let x = 14;
      for (const pb of b.beats) {
        pb.x = x;
        x += pb.w;
      }
      b.width = Math.max(120, x + 8);
    }
    const out: PlacedBar[][] = [];
    let row: PlacedBar[] = [];
    let used = 0;
    for (const b of bars) {
      if (row.length && used + b.width > width - 34) {
        out.push(row);
        row = [];
        used = 0;
      }
      row.push(b);
      used += b.width;
    }
    if (row.length) out.push(row);
    // Stretch each row to the full width (not the last row of a long piece if it is short).
    for (const [ri, r] of out.entries()) {
      const total = r.reduce((s, b) => s + b.width, 0);
      const scale = ri === out.length - 1 && out.length > 1 ? Math.min(1.25, (width - 34) / total) : Math.min(2.2, (width - 34) / total);
      let x = 30;
      for (const b of r) {
        b.x = x;
        b.width *= scale;
        for (const pb of b.beats) {
          pb.x *= scale;
          pb.w *= scale;
        }
        x += b.width;
      }
    }
    return out;
  }, [score, width]);

  const stringY = (s: number) => TOP + (s - 1) * LINE;
  const midiOf = (note: TexNote) => tuning[n - note.string] + note.fret;
  // Next sounding note on the same string, for hammer-on/slide arcs.
  const nextOnString = useMemo(() => {
    const map = new Map<string, { beatIndex: number; note: TexNote }>();
    for (let i = 0; i < score.beats.length; i++) {
      for (const note of score.beats[i].notes) {
        for (let j = i + 1; j < score.beats.length; j++) {
          const nx = score.beats[j].notes.find((x) => x.string === note.string && x.kind !== 'tie');
          if (nx) {
            map.set(`${i}:${note.string}`, { beatIndex: j, note: nx });
            break;
          }
        }
      }
    }
    return map;
  }, [score]);
  const beatPos = useMemo(() => {
    const m = new Map<number, { row: number; x: number; w: number }>();
    rows.forEach((r, ri) => r.forEach((b) => b.beats.forEach((pb) => m.set(pb.index, { row: ri, x: b.x + pb.x, w: pb.w }))));
    return m;
  }, [rows]);

  return (
    <div ref={ref} className="w-full">
      <svg viewBox={`0 0 ${width} ${rows.length * rowH + 8}`} className="block h-auto w-full" role="img" aria-label={label}>
        {rows.map((r, ri) => {
          const y0 = ri * rowH;
          const rowEnd = r[r.length - 1].x + r[r.length - 1].width;
          return (
            <g key={`row${ri}`} transform={`translate(0 ${y0})`}>
              {/* String names */}
              {Array.from({ length: n }, (_, i) => i + 1).map((s) => (
                <text key={`sn${s}`} x={12} y={stringY(s) + 3.5} fontSize={9.5} textAnchor="middle" className="fill-slate-500 font-mono">
                  {['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][pc(tuning[n - s])]}
                </text>
              ))}
              {Array.from({ length: n }, (_, i) => i + 1).map((s) => (
                <line key={`l${s}`} x1={26} x2={rowEnd} y1={stringY(s)} y2={stringY(s)} stroke="rgb(148 163 184 / 0.35)" strokeWidth={1} />
              ))}
              {r.map((b) => (
                <g key={`bar${b.index}`}>
                  <line x1={b.x + b.width} x2={b.x + b.width} y1={TOP} y2={TOP + staffH} stroke="rgb(148 163 184 / 0.55)" strokeWidth={1.2} />
                  <text x={b.x + 4} y={TOP - 18} fontSize={9} className="fill-slate-600 font-mono">
                    {b.index + 1}
                  </text>
                </g>
              ))}
              <line x1={26} x2={26} y1={TOP} y2={TOP + staffH} stroke="rgb(148 163 184 / 0.55)" strokeWidth={1.2} />
              {/* Active beat */}
              {r.flatMap((b) =>
                b.beats
                  .filter((pb) => pb.index === activeBeat)
                  .map((pb) => <rect key={`act${pb.index}`} x={b.x + pb.x - 9} y={TOP - 10} width={Math.max(20, pb.w - 2)} height={staffH + 20} rx={6} fill="#22d3ee" fillOpacity={0.14} stroke="#22d3ee" strokeOpacity={0.5} />),
              )}
              {r.map((b) => (
                <g key={`notes${b.index}`}>
                  {b.beats.map((pb) => {
                    const x = b.x + pb.x;
                    const beat = pb.beat;
                    const items = [];
                    if (beat.rest) {
                      items.push(<rect key="rest" x={x - 4} y={TOP + staffH / 2 - 3} width={8} height={6} rx={1.5} fill="rgb(148 163 184 / 0.45)" />);
                    }
                    for (const note of beat.notes) {
                      const y = stringY(note.string);
                      const isTie = note.kind === 'tie';
                      const isDead = note.kind === 'dead';
                      const harmonic = hasFx(note, 'nh');
                      const text = isDead ? 'x' : isTie ? `(${note.fret})` : harmonic ? `<${note.fret}>` : String(note.fret);
                      const role = isDead || isTie ? null : roleInScale(midiOf(note), keyPc, scalePcs);
                      const color = role ? ROLE_STYLE[role].color : '#64748b';
                      const tw = text.length * 7 + 4;
                      const grace = beat.effects.includes('gr');
                      items.push(<rect key={`bg${note.string}`} x={x - tw / 2} y={y - 7} width={tw} height={14} rx={3} fill="#0d1322" />);
                      items.push(
                        <text key={`t${note.string}`} x={x} y={y + 4} textAnchor="middle" fontSize={grace ? 9 : NOTE_FONT} fontWeight={700} fill={color} className="font-mono">
                          {text}
                        </text>,
                      );
                      const bends = bendValues(note.effects);
                      if (bends.length) {
                        const peak = Math.max(...bends);
                        const release = bends[bends.length - 1] < peak;
                        const bx = x + tw / 2 + 2;
                        items.push(<path key={`b${note.string}`} d={`M${bx} ${y - 2} Q ${bx + 9} ${y - 2} ${bx + 9} ${TOP - 12}`} fill="none" stroke="#e2e8f0" strokeWidth={1.2} />);
                        items.push(<path key={`ba${note.string}`} d={`M${bx + 6} ${TOP - 8} L${bx + 9} ${TOP - 14} L${bx + 12} ${TOP - 8} Z`} fill="#e2e8f0" />);
                        items.push(
                          <text key={`bl${note.string}`} x={bx + 10} y={TOP - 17} textAnchor="middle" fontSize={8.5} className="fill-slate-200 font-mono">
                            {fmtBend(peak / 2)}
                          </text>,
                        );
                        if (release) items.push(<path key={`br${note.string}`} d={`M${bx + 12} ${TOP - 12} Q ${bx + 18} ${TOP - 12} ${bx + 18} ${y - 3}`} fill="none" stroke="#e2e8f0" strokeWidth={1.1} strokeDasharray="2 2" />);
                      }
                      if (hasFx(note, 'v')) {
                        const vx = x - 6;
                        items.push(<path key={`v${note.string}`} d={`M${vx} ${TOP - 22} q 2.5 -3 5 0 t 5 0 t 5 0 t 5 0`} fill="none" stroke="#cbd5e1" strokeWidth={1.1} />);
                      }
                      const nxt = nextOnString.get(`${pb.index}:${note.string}`);
                      const nxPos = nxt ? beatPos.get(nxt.beatIndex) : undefined;
                      if (nxt && nxPos && nxPos.row === ri && (hasFx(note, 'h') || hasFx(note, 'sl'))) {
                        const x2 = nxPos.x;
                        if (hasFx(note, 'h')) {
                          items.push(<path key={`h${note.string}`} d={`M${x + 4} ${y - 8} Q ${(x + x2) / 2} ${y - 17} ${x2 - 4} ${y - 8}`} fill="none" stroke="#94a3b8" strokeWidth={1.1} />);
                          items.push(
                            <text key={`hl${note.string}`} x={(x + x2) / 2} y={y - 15} textAnchor="middle" fontSize={8} className="fill-slate-400 font-mono">
                              {nxt.note.fret > note.fret ? 'H' : 'P'}
                            </text>,
                          );
                        } else {
                          const up = nxt.note.fret > note.fret;
                          items.push(<line key={`sl${note.string}`} x1={x + 7} x2={x2 - 7} y1={up ? y + 4 : y - 4} y2={up ? y - 4 : y + 4} stroke="#94a3b8" strokeWidth={1.2} />);
                        }
                      }
                      if (hasFx(note, 'sib')) items.push(<line key={`si${note.string}`} x1={x - 16} x2={x - 8} y1={y + 5} y2={y - 2} stroke="#94a3b8" strokeWidth={1.2} />);
                      if (hasFx(note, 'tr')) items.push(<text key={`tr${note.string}`} x={x} y={TOP - 22} textAnchor="middle" fontSize={9} fontStyle="italic" className="fill-slate-300">tr</text>);
                      if (hasFx(note, 'ph')) items.push(<text key={`ph${note.string}`} x={x} y={TOP - 22} textAnchor="middle" fontSize={8} className="fill-slate-300 font-mono">P.H.</text>);
                      if (hasFx(note, 'ac')) items.push(<text key={`ac${note.string}`} x={x} y={TOP - 13} textAnchor="middle" fontSize={10} className="fill-slate-300">&gt;</text>);
                      if (hasFx(note, 'lr')) items.push(<text key={`lr${note.string}`} x={x} y={TOP + staffH + 34} textAnchor="middle" fontSize={8} className="fill-slate-500 font-mono">l.r.</text>);
                      if (hasFx(note, 'st')) items.push(<circle key={`st${note.string}`} cx={x} cy={TOP + staffH + 32} r={1.6} fill="#94a3b8" />);
                    }
                    for (const fx of beat.effects) {
                      const sym = fx === 'tt' ? 'T' : fx === 's' ? 'S' : fx === 'p' ? 'P' : null;
                      if (sym) items.push(<text key={`be${fx}`} x={x} y={TOP - 22} textAnchor="middle" fontSize={9} fontWeight={700} className="fill-amber-300 font-mono">{sym}</text>);
                    }
                    return <g key={`beat${pb.index}`}>{items}</g>;
                  })}
                  <Rhythm bar={b} y={TOP + staffH + 8} />
                </g>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Stems and beams under the staff, beamed per quarter-note group. */
function Rhythm({ bar, y }: { bar: PlacedBar; y: number }) {
  const stemLen = 14;
  const items = [];
  const groups = new Map<number, PlacedBeat[]>();
  for (const pb of bar.beats) {
    if (pb.beat.rest) continue;
    const x = bar.x + pb.x;
    const d = pb.beat.duration;
    if (d <= 2) {
      // Half and whole notes: hollow head (a half note also gets a stem).
      items.push(<circle key={`h${pb.index}`} cx={x} cy={y + 4} r={3} fill="none" stroke="#94a3b8" strokeWidth={1.1} />);
      if (d === 2) items.push(<line key={`s${pb.index}`} x1={x} x2={x} y1={y + 7} y2={y + stemLen} stroke="#94a3b8" strokeWidth={1.1} />);
    } else {
      items.push(<line key={`s${pb.index}`} x1={x} x2={x} y1={y} y2={y + stemLen} stroke="#94a3b8" strokeWidth={1.1} />);
    }
    if (pb.beat.dotted) items.push(<circle key={`d${pb.index}`} cx={x + 5} cy={y + stemLen - 2} r={1.4} fill="#94a3b8" />);
    if (d >= 8) {
      const g = Math.floor(pb.beat.start / TICKS_PER_QUARTER);
      groups.set(g, [...(groups.get(g) ?? []), pb]);
    }
  }
  for (const [g, list] of groups) {
    const beams = (b: PlacedBeat) => Math.max(1, Math.round(Math.log2(b.beat.duration / 4)));
    if (list.length === 1) {
      const pb = list[0];
      const x = bar.x + pb.x;
      for (let k = 0; k < beams(pb); k++) items.push(<path key={`f${g}-${k}`} d={`M${x} ${y + stemLen - k * 3.5} l 5 -4`} stroke="#94a3b8" strokeWidth={1.3} fill="none" />);
    } else {
      const x1 = bar.x + list[0].x;
      const x2 = bar.x + list[list.length - 1].x;
      const maxBeams = Math.max(...list.map(beams));
      for (let k = 0; k < maxBeams; k++) {
        const members = list.filter((b) => beams(b) > k);
        if (members.length >= 2) items.push(<line key={`bm${g}-${k}`} x1={bar.x + members[0].x} x2={bar.x + members[members.length - 1].x} y1={y + stemLen - k * 3.5} y2={y + stemLen - k * 3.5} stroke="#94a3b8" strokeWidth={2} />);
        else if (members.length === 1) items.push(<line key={`bm${g}-${k}`} x1={bar.x + members[0].x} x2={bar.x + members[0].x + 5} y1={y + stemLen - k * 3.5} y2={y + stemLen - k * 3.5} stroke="#94a3b8" strokeWidth={2} />);
      }
      if (list[0].beat.tuplet) items.push(<text key={`tu${g}`} x={(x1 + x2) / 2} y={y + stemLen + 10} textAnchor="middle" fontSize={8.5} className="fill-slate-400 font-mono">{list[0].beat.tuplet}</text>);
    }
  }
  return <g>{items}</g>;
}

export const TabView = memo(TabViewImpl);
