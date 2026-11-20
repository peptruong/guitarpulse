import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { askClaude } from '../lib/askClaude';
import { cleanKey, forgetKey, KEY_STORAGE_NAME, loadKey, saveKey } from '../lib/claudeKey';
import type { CoachRequest } from '../lib/coachPrompt';

const request: CoachRequest = {
  groove: 'slow-blues',
  grooveName: 'Slow blues',
  key: 'A',
  scale: 'minor-pentatonic',
  bpm: 64,
  minutes: 3.2,
  noteCount: 84,
  verdicts: [{ label: 'Chord tones on beats 1 and 3', value: 0.31, status: 'work on this (target ≥ 0.5)' }],
  focus: { label: 'Chord tones on beats 1 and 3', exercise: 'Aim for the 3rd of each chord on beat 1.' },
  boxes: null,
  opening: [{ note: 'C', beat: 0.5, beats: 1 }],
};

const advice = {
  headline: 'Relaxed phrasing; now aim for chord tones on beat 1.',
  strengths: ['A timing spread of 22 ms is tight.'],
  fixes: [{ issue: 'Only 31% chord tones on beats 1 and 3.', drill: 'Play C# on beat 1 of every A7 bar for two choruses.' }],
  next_session: { groove: 'slow-blues', bpm: 60, focus: 'Land on the 3rd of each chord on beat 1.' },
};

function message(content: unknown[], stop_reason = 'tool_use') {
  return { id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', content, stop_reason, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } };
}

const toolCall = message([{ type: 'tool_use', id: 'toolu_test', name: 'coach_feedback', input: advice }]);

interface Call {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

/** Stands in for the network: records each request and answers every one with the same response. */
function fakeFetch(status: number, json: unknown) {
  const calls: Call[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> });
    return new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const KEY = 'sk-ant-test-key';
const offline = (fetch: typeof globalThis.fetch) => ({ fetch, maxRetries: 0 });

describe('askClaude', () => {
  it('sends the coach request to the Messages API', async () => {
    const net = fakeFetch(200, toolCall);
    await askClaude(request, KEY, offline(net.fetch));
    assert.equal(net.calls.length, 1);
    const [call] = net.calls;
    assert.equal(call.url, 'https://api.anthropic.com/v1/messages');
    // The pasted key is the credential sent (SDK 1.x sends it as a bearer token).
    assert.ok(call.headers.get('x-api-key') === KEY || call.headers.get('authorization') === `Bearer ${KEY}`);
    assert.equal(call.headers.get('anthropic-dangerous-direct-browser-access'), 'true');
    assert.equal(call.body.model, 'claude-haiku-5-5');
    assert.equal((call.body.tool_choice as { name?: string }).name, 'coach_feedback');
    assert.equal(call.body.max_tokens, 4096);
  });

  it('returns the advice from the tool call', async () => {
    const result = await askClaude(request, KEY, offline(fakeFetch(200, toolCall).fetch));
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.advice.headline, advice.headline);
  });

  const failures: [string, number, unknown, RegExp][] = [
    ['a refused key', 401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, /refused this API key/],
    ['an account without credit', 402, { type: 'error', error: { type: 'billing_error', message: 'credit balance is too low' } }, /out of credit/],
    ['an overloaded API', 529, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }, /busy/],
    ['a declined request', 200, message([], 'refusal'), /declined/],
    ['a reply without the tool call', 200, message([{ type: 'text', text: 'Nice playing!' }], 'end_turn'), /unexpected shape/],
  ];
  for (const [name, status, json, expected] of failures) {
    it(`explains ${name}`, async () => {
      const result = await askClaude(request, KEY, offline(fakeFetch(status, json).fetch));
      assert.equal(result.ok, false);
      assert.match(result.ok ? '' : result.message, expected);
    });
  }

  it('flags a refused key so the card can ask for a new one', async () => {
    const result = await askClaude(request, KEY, offline(fakeFetch(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }).fetch));
    assert.equal(!result.ok && result.badKey, true);
  });

  it('explains a dropped connection', async () => {
    const fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof globalThis.fetch;
    const result = await askClaude(request, KEY, offline(fetch));
    assert.match(result.ok ? '' : result.message, /reach Claude/);
  });

  it('does not send an incomplete session', async () => {
    const net = fakeFetch(200, toolCall);
    const result = await askClaude({ ...request, bpm: 999 }, KEY, offline(net.fetch));
    assert.match(result.ok ? '' : result.message, /incomplete/);
    assert.equal(net.calls.length, 0);
  });
});

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  };
}

describe('the saved Anthropic key', () => {
  it('trims a pasted key', () => {
    assert.equal(cleanKey('  sk-ant-abc \n'), 'sk-ant-abc');
  });

  it('rejects text that is not a key', () => {
    assert.equal(cleanKey('hello'), null);
    assert.equal(cleanKey('sk-ant-a b'), null);
  });

  it('saves, loads and forgets the key', () => {
    const storage = memoryStorage();
    assert.equal(saveKey(storage, 'sk-ant-abc'), true);
    assert.equal(storage.getItem(KEY_STORAGE_NAME), 'sk-ant-abc');
    assert.equal(loadKey(storage), 'sk-ant-abc');
    forgetKey(storage);
    assert.equal(loadKey(storage), null);
  });

  it('never throws when the browser blocks storage', () => {
    const blocked = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
      removeItem() {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    assert.equal(saveKey(blocked, 'sk-ant-abc'), false);
    assert.equal(loadKey(blocked), null);
    assert.doesNotThrow(() => forgetKey(blocked));
    assert.equal(saveKey(null, 'sk-ant-abc'), false);
    assert.equal(loadKey(null), null);
  });
});
