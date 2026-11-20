/**
 * Claude's written coaching, called straight from the browser with the player's own API key.
 * Only the session's numbers are sent, never audio. The Anthropic SDK is loaded on first use, so
 * no other page pays for it.
 */
import type AnthropicClient from '@anthropic-ai/sdk';
import { buildCoachRequest, CoachRequestSchema, DEFAULT_COACH_MODEL, parseCoachResponse, type CoachAdvice, type CoachRequest } from './coachPrompt';

export type AskResult = { ok: true; advice: CoachAdvice } | { ok: false; message: string; badKey?: boolean };

export interface AskOptions {
  /** Replaces the network, for tests. */
  fetch?: typeof globalThis.fetch;
  maxRetries?: number;
  model?: string;
}

const TIMEOUT_MS = 30_000;

export async function askClaude(request: CoachRequest, apiKey: string, opts: AskOptions = {}): Promise<AskResult> {
  const parsed = CoachRequestSchema.safeParse(request);
  if (!parsed.success) return { ok: false, message: 'The session data was incomplete, so it was not sent to Claude.' };

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: opts.maxRetries ?? 1, timeout: TIMEOUT_MS, fetch: opts.fetch });
  try {
    const response = await client.messages.create(buildCoachRequest(parsed.data, opts.model ?? DEFAULT_COACH_MODEL));
    if (response.stop_reason === 'refusal') return { ok: false, message: 'Claude declined to answer this time. Your report above is unchanged.' };
    const advice = parseCoachResponse(response, parsed.data.groove);
    return advice ? { ok: true, advice } : { ok: false, message: 'Claude’s answer came back in an unexpected shape. Try again.' };
  } catch (e) {
    return { ok: false, ...explain(e, Anthropic) };
  }
}

/** Most specific first: in this SDK the connection errors are subclasses of APIError. */
function explain(e: unknown, sdk: typeof AnthropicClient): { message: string; badKey?: boolean } {
  if (e instanceof sdk.APIConnectionTimeoutError) return { message: 'Claude took too long to answer. Try again.' };
  if (e instanceof sdk.APIConnectionError) return { message: 'Could not reach Claude. Check your internet connection and try again.' };
  if (e instanceof sdk.AuthenticationError || e instanceof sdk.PermissionDeniedError) return { message: 'Anthropic refused this API key. Check it or paste a new one.', badKey: true };
  if (e instanceof sdk.RateLimitError || e instanceof sdk.InternalServerError) return { message: 'Claude is busy right now. Try again in a minute.' };
  if (e instanceof sdk.APIError) {
    if (e.status === 402) return { message: 'Your Anthropic account is out of credit. Add credit in the Claude Console, then try again.' };
    return { message: `Claude could not answer (status ${e.status}).` };
  }
  return { message: 'Claude could not answer right now. Try again in a minute.' };
}
