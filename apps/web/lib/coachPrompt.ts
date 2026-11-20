/**
 * Claude coach feedback: request validation, the Messages API body, and parsing the reply.
 * The model answers through a forced tool call, so the reply is structured JSON we validate.
 */
import type Anthropic from '@anthropic-ai/sdk';
import * as z from 'zod';
import { GROOVES } from '@guitarpulse/core/grooves';

export const DEFAULT_COACH_MODEL = 'claude-haiku-5-5';

export const CoachRequestSchema = z.object({
  groove: z.string().min(1).max(40),
  grooveName: z.string().min(1).max(60),
  key: z.string().min(1).max(12),
  scale: z.string().min(1).max(40),
  bpm: z.number().min(30).max(300),
  minutes: z.number().min(0).max(240),
  noteCount: z.number().int().min(0).max(20000),
  verdicts: z
    .array(z.object({ label: z.string().max(80), value: z.number().nullable(), status: z.string().max(80) }))
    .max(20),
  focus: z.object({ label: z.string().max(80), exercise: z.string().max(400) }).nullable(),
  boxes: z
    .object({ box1Share: z.number().min(0).max(1), boxesUsed: z.number().int().min(0).max(5), lowestFret: z.number().min(0).max(24), highestFret: z.number().min(0).max(24), advice: z.string().max(400) })
    .nullable(),
  /** The first notes as names with beats, so the coach can talk about actual phrases. */
  opening: z.array(z.object({ note: z.string().max(4), beat: z.number(), beats: z.number() })).max(48),
});
export type CoachRequest = z.infer<typeof CoachRequestSchema>;

export const CoachAdviceSchema = z.object({
  headline: z.string().min(1).max(160),
  strengths: z.array(z.string().min(1).max(240)).min(1).max(3),
  fixes: z.array(z.object({ issue: z.string().min(1).max(240), drill: z.string().min(1).max(360) })).min(1).max(3),
  next_session: z.object({ groove: z.string().min(1).max(40), bpm: z.number().int().min(40).max(240), focus: z.string().min(1).max(200) }),
});
export type CoachAdvice = z.infer<typeof CoachAdviceSchema>;

export const COACH_TOOL: Anthropic.Tool = {
  name: 'coach_feedback',
  description: 'Give the guitarist feedback on one improvisation session and set up the next one.',
  input_schema: {
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'One encouraging, specific sentence about this session (max 160 characters).' },
      strengths: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3, description: 'What went well, each tied to a number from the session.' },
      fixes: {
        type: 'array',
        minItems: 1,
        maxItems: 3,
        items: {
          type: 'object',
          properties: { issue: { type: 'string', description: 'What to improve, tied to a number.' }, drill: { type: 'string', description: 'A concrete drill with notes, frets or counts.' } },
          required: ['issue', 'drill'],
        },
      },
      next_session: {
        type: 'object',
        properties: {
          groove: { type: 'string', enum: GROOVES.map((g) => g.id) },
          bpm: { type: 'integer', minimum: 40, maximum: 240 },
          focus: { type: 'string', description: 'The one thing to work on next time (max 200 characters).' },
        },
        required: ['groove', 'bpm', 'focus'],
      },
    },
    required: ['headline', 'strengths', 'fixes', 'next_session'],
  },
};

const SYSTEM = `You are the improvisation coach inside GuitarPulse, a guitar practice app.
You receive measurements from one session where the player improvised over a backing track while the app listened.
Rules:
- Use only the numbers given. Never invent notes, bars or events that are not in the data.
- Be concrete: name scale degrees, notes, frets, boxes or counts. Prefer one clear drill over general advice.
- Keep the tone warm and direct, like a good teacher after a lesson. No filler.
- Strengths and fixes must each point to a measurement.
- next_session.groove must be one of the listed groove ids; choose a tempo the player can manage (slower if timing spread is high).
Answer only by calling the coach_feedback tool.`;

export function buildCoachRequest(data: CoachRequest, model = DEFAULT_COACH_MODEL): Anthropic.MessageCreateParamsNonStreaming {
  const lines = [
    `Backing track: ${data.grooveName} (${data.groove}) in ${data.key}, ${data.bpm} BPM; scale shown: ${data.scale}.`,
    `Session length: ${data.minutes} minutes, ${data.noteCount} notes detected.`,
    '',
    'Measurements:',
    ...data.verdicts.map((v) => `- ${v.label}: ${v.value ?? 'not measured'} (${v.status})`),
  ];
  if (data.focus) lines.push('', `The app's own top priority: ${data.focus.label}. Built-in drill: ${data.focus.exercise}`);
  if (data.boxes) lines.push('', `Neck use: ${Math.round(data.boxes.box1Share * 100)}% in pentatonic box 1, ${data.boxes.boxesUsed} of 5 boxes used, frets ${data.boxes.lowestFret}-${data.boxes.highestFret}. ${data.boxes.advice}`);
  if (data.opening.length) lines.push('', `First notes (name@beat for beats): ${data.opening.map((n) => `${n.note}@${n.beat}/${n.beats}`).join(' ')}`);
  lines.push('', `Groove ids you may suggest: ${GROOVES.map((g) => g.id).join(', ')}.`);
  return {
    model,
    // Claude Haiku 5.5 counts the same text as more tokens than older models; a cut-off tool
    // call can't be parsed, so leave plenty of room (it is a cap, not a charge).
    max_tokens: 4096,
    system: SYSTEM,
    tools: [COACH_TOOL],
    tool_choice: { type: 'tool', name: COACH_TOOL.name },
    messages: [{ role: 'user', content: lines.join('\n') }],
  };
}

/** Extracts and validates the tool call from a Messages API response. */
export function parseCoachResponse(json: unknown, fallbackGroove: string): CoachAdvice | null {
  const content = (json as { content?: unknown })?.content;
  if (!Array.isArray(content)) return null;
  const call = content.find((b): b is { type: 'tool_use'; name: string; input: unknown } => !!b && typeof b === 'object' && (b as { type?: string }).type === 'tool_use' && (b as { name?: string }).name === COACH_TOOL.name);
  if (!call) return null;
  const parsed = CoachAdviceSchema.safeParse(call.input);
  if (!parsed.success) return null;
  const advice = parsed.data;
  if (!GROOVES.some((g) => g.id === advice.next_session.groove)) advice.next_session.groove = fallbackGroove;
  return advice;
}
