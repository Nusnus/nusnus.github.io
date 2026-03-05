/**
 * Tests for `src/lib/ai/cloud.ts` — the SSE stream parser.
 *
 * This file exists because a real bug lived here: an early version wrapped
 * the *entire* event dispatch in the JSON.parse try/catch, silently
 * swallowing the intentional `throw` from `response.failed`. The fix was
 * to scope the try/catch to JSON.parse alone. These tests pin that fix
 * in place — if someone widens the catch again, `response.failed throws`
 * goes red.
 *
 * We mock `fetch` at the global level and feed a `ReadableStream` of
 * pre-encoded SSE lines. Node's undici `Response` supports stream bodies
 * natively, so this runs in the plain `node` vitest environment.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { cloudChatStream } from '@lib/ai/cloud';
import type { CloudMessage } from '@lib/ai/cloud';

/* ─── Test helpers ─── */

/**
 * Build a `Response` whose body is a ReadableStream of SSE `data:` lines.
 *
 * Each entry is either an event object (JSON-encoded into a `data:` line)
 * or the literal string `'malformed'` (an unparseable `data:` line — the
 * parser should skip these without blowing up).
 *
 * Lines are joined with a trailing newline so the SSE parser's
 * `buffer.split('\n')` finds a complete final line on the first chunk.
 */
function sseResponse(events: readonly (object | 'malformed')[]): Response {
  const encoder = new TextEncoder();
  const body =
    events
      .map((e) => (e === 'malformed' ? 'data: {not json' : `data: ${JSON.stringify(e)}`))
      .join('\n') + '\n';

  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    }),
    { status: 200 },
  );
}

/** Stub the global `fetch` to return a canned SSE stream. */
function stubFetch(events: readonly (object | 'malformed')[]): void {
  vi.stubGlobal('fetch', async () => sseResponse(events));
}

/** Minimal valid request payload — the content doesn't matter, fetch is stubbed. */
const MESSAGES: CloudMessage[] = [{ role: 'user', content: 'hi' }];

afterEach(() => {
  vi.unstubAllGlobals();
});

/* ─── Text deltas ─── */

describe('cloudChatStream — text deltas', () => {
  it('accumulates deltas and calls onToken with (delta, runningTotal)', async () => {
    stubFetch([
      { type: 'response.output_text.delta', delta: 'Hello' },
      { type: 'response.output_text.delta', delta: ', ' },
      { type: 'response.output_text.delta', delta: 'Neo.' },
      { type: 'response.completed', response: {} },
    ]);

    const tokens: [string, string][] = [];
    const result = await cloudChatStream(MESSAGES, 'test-model', (t, acc) => {
      tokens.push([t, acc]);
    });

    expect(result.content).toBe('Hello, Neo.');
    // The `accumulated` argument is post-processed by `stripGrokRenderForDisplay`,
    // which strips trailing whitespace (so the UI cursor doesn't chase a space).
    // The delta argument is raw. The final result is whitespace-preserving.
    expect(tokens).toEqual([
      ['Hello', 'Hello'],
      [', ', 'Hello,'],
      ['Neo.', 'Hello, Neo.'],
    ]);
  });

  it('handles SSE lines split across two stream chunks', async () => {
    // A single event deliberately cut mid-JSON between two enqueue() calls.
    // The parser buffers the partial line and completes it on the next read.
    const encoder = new TextEncoder();
    const full = `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: 'ok' })}\n`;
    const mid = 20; // somewhere in the middle of the JSON
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(encoder.encode(full.slice(0, mid)));
              controller.enqueue(encoder.encode(full.slice(mid)));
              controller.close();
            },
          }),
          { status: 200 },
        ),
    );

    const result = await cloudChatStream(MESSAGES, 'test-model', () => undefined);
    expect(result.content).toBe('ok');
  });
});

/* ─── Error events ─── */

describe('cloudChatStream — error events', () => {
  it('throws on response.failed (NOT swallowed by the JSON.parse catch)', async () => {
    // REGRESSION TEST. The parse-catch must stay scoped to JSON.parse only;
    // this throw must bubble out.
    stubFetch([
      { type: 'response.output_text.delta', delta: 'partial' },
      { type: 'response.failed', response: { error: { message: 'upstream exploded' } } },
    ]);

    await expect(cloudChatStream(MESSAGES, 'test-model', () => undefined)).rejects.toThrow(
      'upstream exploded',
    );
  });

  it('throws on response.incomplete when no content was accumulated', async () => {
    stubFetch([
      { type: 'response.incomplete', response: { incomplete_details: { reason: 'max_tokens' } } },
    ]);

    await expect(cloudChatStream(MESSAGES, 'test-model', () => undefined)).rejects.toThrow(
      /Incomplete response: max_tokens/,
    );
  });

  it('does NOT throw on response.incomplete if content already streamed', async () => {
    // Partial answers are better than errors. If the model hit max_tokens
    // after producing useful output, keep the output.
    stubFetch([
      { type: 'response.output_text.delta', delta: 'The answer is 4' },
      { type: 'response.incomplete', response: { incomplete_details: { reason: 'max_tokens' } } },
    ]);

    const result = await cloudChatStream(MESSAGES, 'test-model', () => undefined);
    expect(result.content).toBe('The answer is 4');
  });

  it('throws a generic message on HTTP error status', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ error: { message: 'rate limited, calm down' } }), {
          status: 429,
        }),
    );

    await expect(cloudChatStream(MESSAGES, 'test-model', () => undefined)).rejects.toThrow(
      'rate limited, calm down',
    );
  });

  it('throws "Empty response" if stream ends with no content and no tool calls', async () => {
    stubFetch([
      { type: 'response.created', response: {} },
      { type: 'response.completed', response: {} },
    ]);

    await expect(cloudChatStream(MESSAGES, 'test-model', () => undefined)).rejects.toThrow(
      /Empty response/,
    );
  });
});

/* ─── Malformed input ─── */

describe('cloudChatStream — malformed input', () => {
  it('skips unparseable data lines and keeps processing', async () => {
    stubFetch([
      { type: 'response.output_text.delta', delta: 'A' },
      'malformed',
      { type: 'response.output_text.delta', delta: 'B' },
      { type: 'response.completed', response: {} },
    ]);

    const result = await cloudChatStream(MESSAGES, 'test-model', () => undefined);
    expect(result.content).toBe('AB');
  });

  it('ignores unknown event types (forward compatibility)', async () => {
    stubFetch([
      { type: 'response.output_text.delta', delta: 'ok' },
      { type: 'response.some_future_event', whatever: true },
      { type: 'response.completed', response: {} },
    ]);

    const result = await cloudChatStream(MESSAGES, 'test-model', () => undefined);
    expect(result.content).toBe('ok');
  });
});

/* ─── Reasoning tokens ─── */

describe('cloudChatStream — reasoning tokens', () => {
  it('fires onReasoning when usage arrives in a progress event', async () => {
    stubFetch([
      { type: 'response.output_text.delta', delta: '.' },
      {
        type: 'response.in_progress',
        response: { usage: { output_tokens_details: { reasoning_tokens: 42 } } },
      },
      { type: 'response.completed', response: {} },
    ]);

    const onReasoning = vi.fn();
    const result = await cloudChatStream(MESSAGES, 'test-model', () => undefined, undefined, {
      onReasoning,
    });

    expect(onReasoning).toHaveBeenCalledWith(42);
    expect(result.reasoningTokens).toBe(42);
  });

  it('does not fire onReasoning twice for the same count (no spurious updates)', async () => {
    stubFetch([
      { type: 'response.output_text.delta', delta: '.' },
      {
        type: 'response.in_progress',
        response: { usage: { output_tokens_details: { reasoning_tokens: 10 } } },
      },
      {
        type: 'response.completed',
        response: { usage: { output_tokens_details: { reasoning_tokens: 10 } } },
      },
    ]);

    const onReasoning = vi.fn();
    await cloudChatStream(MESSAGES, 'test-model', () => undefined, undefined, { onReasoning });

    expect(onReasoning).toHaveBeenCalledTimes(1);
  });
});
