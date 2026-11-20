/** Markdown renderers: short, readable answers for the model; JSON mode returns the full data. */
import type { ImprovMetrics } from '@guitarpulse/core/coach/metrics';
import { METRIC_TARGETS } from '@guitarpulse/core/coach/metrics';
import type { Lick } from '@guitarpulse/core/licks/types';
import type { SongPractice } from '@guitarpulse/core/song';
import type { ProgressionAdvice } from '@guitarpulse/core/theory/chordScale';
import type { ScaleResult } from '@guitarpulse/core/theory/scales';
import type { VoicingResult } from '@guitarpulse/core/theory/voicings';

export function scaleMarkdown(s: ScaleResult, tuningStrings: number): string {
  const lines = [
    `# ${s.name}`,
    `- Notes: ${s.notes.join(' ')}`,
    `- Formula: ${s.formula}`,
    `- Pitch classes (C=0): ${s.pitchClasses.join(' ')}`,
    `- Sound: ${s.mood}`,
    ...(s.characteristic.length ? [`- Colour notes to land on: ${s.characteristic.join(', ')}`] : []),
    `- Pattern: ${s.pattern}`,
    '',
    '## Fretboard (string 1 = high E)',
  ];
  for (let str = 1; str <= tuningStrings; str++) {
    const notes = s.fretboard.filter((n) => n.string === str).sort((a, b) => a.fret - b.fret);
    lines.push(`- String ${str}: ${notes.map((n) => `${n.fret}${n.degree === '1' ? '(R)' : ''} ${n.note}`).join(', ')}`);
  }
  return lines.join('\n');
}

export function voicingsMarkdown(r: VoicingResult): string {
  const lines = [`# ${r.chord} (${r.name})`, `- Notes: ${r.notes.join(' ')} (${r.degrees.join(' ')})`, `- Tuning: ${r.tuning}`, '- Charts read lowest string first; x = muted, (12) = fret 12.', ''];
  let system = '';
  for (const v of r.voicings) {
    if (v.system !== system) {
      system = v.system;
      lines.push(`## ${system}`);
    }
    lines.push(`- \`${v.chart}\` ${v.label}, ${v.inversion}: ${v.notes.join(' ')} (${v.degrees.join(' ')}); fingers ${v.fingers.map((f) => (f === null ? 'x' : f)).join('')}${v.barre ? `, barre fret ${v.barre.fret}` : ''}`);
  }
  if (r.skipped.length) {
    lines.push('', '## Not available');
    for (const s of r.skipped) lines.push(`- ${s.system}: ${s.reason}`);
  }
  return lines.join('\n');
}

export function progressionMarkdown(a: ProgressionAdvice): string {
  const lines = [`# Scales for ${a.chords.map((c) => c.chord).join(' | ')}${a.key ? ` in ${a.key}` : ''}`];
  for (const c of a.chords) {
    lines.push('', `## ${c.chord}${c.function ? ` (${c.function})` : ''}`);
    lines.push(`- Chord tones: ${c.chordTones.join(', ')}`);
    if (c.guideTones.length) lines.push(`- Guide tones to target: ${c.guideTones.join(', ')}`);
    c.scales.forEach((s, i) => lines.push(`- ${i === 0 ? '**Best:** ' : ''}${s.scale}: ${s.notes.join(' ')} (${s.why})`));
    for (const av of c.avoidNotes) lines.push(`- Careful: ${av}`);
  }
  if (a.wholeProgression.length) {
    lines.push('', '## One scale for everything');
    for (const w of a.wholeProgression) lines.push(`- ${w.scale}: ${w.notes.join(' ')}. ${w.why}`);
  }
  if (a.guideToneLine.length) {
    lines.push('', '## Guide-tone line (smoothest 3rd/7th movement)');
    for (const g of a.guideToneLine) lines.push(`- ${g}`);
  }
  return lines.join('\n');
}

export function lickMarkdown(l: Lick, includeTab: boolean): string {
  const lines = [
    `## ${l.title} (${l.id})`,
    `- Style study in the style of ${l.artist}; ${l.genre}, difficulty ${l.difficulty}/5, ${l.bpm} BPM, ${l.timeSignature}`,
    `- Key/scale: ${l.key} ${l.scale}${l.passing.length ? ` + passing ${l.passing.join(', ')}` : ''}; over ${l.chord}`,
    `- Techniques: ${l.techniques.join(', ')}; targets: ${l.targetTones.join(', ')}`,
    `- Why it works: ${l.theory}`,
  ];
  if (includeTab) lines.push('```alphatex', l.alphaTex, '```');
  return lines.join('\n');
}

export function songMarkdown(s: SongPractice, link: string | null, grooveName: string): string {
  const lines = [
    `# Song practice in ${s.key.key}${s.key.confidence < 1 ? ` (confidence ${Math.round(s.key.confidence * 100)}%${s.key.alternatives.length ? `; could also be ${s.key.alternatives.slice(0, 2).join(' or ')}` : ''})` : ''}`,
    `- ${s.chart.bars} bars, ${s.chart.chords.length} chord changes`,
  ];
  if (s.named) lines.push(`- Progression: ${s.named.name}. ${s.named.about}`);
  lines.push(`- Focus: ${s.focus}`, '', '## Chord by chord (scale, notes, 3rd and 7th to aim for)');
  for (const t of s.timeline) lines.push(`- Bar ${t.bar}, ${t.symbol}: ${t.scale} (${t.scaleNotes.join(' ')}); guide tones ${t.guideTones.join(', ') || 'n/a'}`);
  if (s.advice.guideToneLine.length) lines.push('', '## Guide-tone line', ...s.advice.guideToneLine.map((g) => `- ${g}`));
  if (s.chart.errors.length) lines.push('', '## Skipped', ...s.chart.errors.map((e) => `- ${e.message}`));
  lines.push('', link ? `Open it in GuitarPulse with a ${grooveName} backing track: ${link}` : 'The chart is too long for a link (600 characters); paste it into the Song page instead.');
  return lines.join('\n');
}

export function mutationMarkdown(original: Lick, steps: { explanation: string; warnings: string[] }[], result: Lick): string {
  const lines = [`# ${original.title} → ${result.title}`, ''];
  steps.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.explanation}`);
    for (const w of s.warnings) lines.push(`   - Note: ${w}`);
  });
  lines.push('', lickMarkdown(result, true));
  return lines.join('\n');
}

export function metricsMarkdown(m: ImprovMetrics, verdicts: { metric: string; label: string; value: number | null; status: string }[]): string {
  const lines = ['# Improvisation metrics', `- Notes played: ${m.noteCount}; phrases: ${m.phraseCount}; notes per bar: ${m.notesPerBar}`, ''];
  for (const v of verdicts) lines.push(`- ${v.label}: ${v.value ?? 'n/a'}${METRIC_TARGETS[v.metric]?.unit ? ` ${METRIC_TARGETS[v.metric].unit}` : ''} (${v.status})`);
  lines.push('', `Timing: average ${m.timingMeanMs} ms ${m.timingMeanMs >= 0 ? 'behind' : 'ahead of'} the grid, spread ${m.timingSdMs} ms.`);
  return lines.join('\n');
}
