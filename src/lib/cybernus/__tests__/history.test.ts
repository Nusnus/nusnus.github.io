/**
 * Tests for `src/lib/cybernus/history.ts` — sliding-window conversation trim.
 */

import { describe, it, expect } from 'vitest';
import { trimHistoryForRequest, MAX_HISTORY_MESSAGES } from '@lib/cybernus/history';
import type { ChatMessage } from '@lib/ai/types';

/** Build a test message. */
const msg = (role: 'user' | 'assistant', i: number): ChatMessage => ({
  id: `m${i}`,
  role,
  content: `message ${i}`,
});

/** Build N alternating user/assistant messages starting with user. */
const conversation = (n: number): ChatMessage[] =>
  Array.from({ length: n }, (_, i) => msg(i % 2 === 0 ? 'user' : 'assistant', i));

describe('trimHistoryForRequest', () => {
  it('returns short conversations unchanged', () => {
    const input = conversation(10);
    const out = trimHistoryForRequest(input, 50);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  it('trims to the tail when over the limit', () => {
    const input = conversation(100);
    const out = trimHistoryForRequest(input, 50);
    expect(out.length).toBe(50);
    expect(out[0]).toEqual(input[50]);
    expect(out[out.length - 1]).toEqual(input[99]);
  });

  it('always starts on a user message (drops orphan assistant head)', () => {
    const input = conversation(100);
    const out = trimHistoryForRequest(input, 51);
    expect(out[0]?.role).toBe('user');
    expect(out.length).toBe(50);
  });

  it('handles conversations that start on assistant (loaded-from-storage edge case)', () => {
    const input: ChatMessage[] = [
      msg('assistant', 0),
      msg('user', 1),
      msg('assistant', 2),
      msg('user', 3),
      msg('assistant', 4),
    ];
    const out = trimHistoryForRequest(input, 3);
    expect(out[0]?.role).toBe('user');
    expect(out).toEqual([input[3], input[4]]);
  });

  it('returns empty if the tail contains no user messages (pathological)', () => {
    const input: ChatMessage[] = [msg('user', 0), msg('assistant', 1), msg('assistant', 2)];
    const out = trimHistoryForRequest(input, 2);
    expect(out).toEqual([]);
  });

  it('uses MAX_HISTORY_MESSAGES by default', () => {
    const input = conversation(MAX_HISTORY_MESSAGES + 20);
    const out = trimHistoryForRequest(input);
    expect(out.length).toBeLessThanOrEqual(MAX_HISTORY_MESSAGES);
    expect(out[0]?.role).toBe('user');
  });

  it('handles empty input', () => {
    expect(trimHistoryForRequest([])).toEqual([]);
  });

  it('handles exactly-max input (no trim needed)', () => {
    const input = conversation(50);
    const out = trimHistoryForRequest(input, 50);
    expect(out).toEqual(input);
  });
});
