/**
 * Claude's written coaching. The API key stays on the server; the browser sends only the session
 * measurements. Without ANTHROPIC_API_KEY the route reports that it is off and the app's own
 * report still works.
 */
import { NextResponse } from 'next/server';
import { buildCoachRequest, CoachRequestSchema, DEFAULT_COACH_MODEL, parseCoachResponse } from '@/lib/coachPrompt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 20_000;
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 12;
const hits = new Map<string, { count: number; reset: number }>();

function limited(ip: string) {
  const now = Date.now();
  for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  const h = hits.get(ip) ?? { count: 0, reset: now + WINDOW_MS };
  h.count++;
  hits.set(ip, h);
  return h.count > MAX_PER_WINDOW;
}

export async function GET() {
  return NextResponse.json({ available: Boolean(process.env.ANTHROPIC_API_KEY), model: process.env.COACH_MODEL || DEFAULT_COACH_MODEL });
}

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ message: 'Claude feedback is off: ANTHROPIC_API_KEY is not set on the server.' }, { status: 503 });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
  if (limited(ip)) return NextResponse.json({ message: 'That is a lot of reports in a short time. Wait a few minutes and try again.' }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'The request was not valid JSON.' }, { status: 400 });
  }
  const parsed = CoachRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: 'The session data was incomplete, so it was not sent to Claude.' }, { status: 400 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(buildCoachRequest(parsed.data, process.env.COACH_MODEL || DEFAULT_COACH_MODEL)),
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403) return NextResponse.json({ message: 'The server’s Anthropic API key was refused. Check ANTHROPIC_API_KEY.' }, { status: 502 });
    if (res.status === 429 || res.status === 529) return NextResponse.json({ message: 'Claude is busy right now. Try again in a minute.' }, { status: 503 });
    if (!res.ok) return NextResponse.json({ message: `Claude could not answer (status ${res.status}).` }, { status: 502 });
    const advice = parseCoachResponse(await res.json(), parsed.data.groove);
    if (!advice) return NextResponse.json({ message: 'Claude’s answer came back in an unexpected shape. Try again.' }, { status: 502 });
    return NextResponse.json({ advice });
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return NextResponse.json({ message: aborted ? 'Claude took too long to answer. Try again.' : 'The server could not reach Claude.' }, { status: aborted ? 504 : 502 });
  } finally {
    clearTimeout(timer);
  }
}
