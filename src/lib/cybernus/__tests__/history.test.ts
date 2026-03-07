/**
 * Tests for `src/lib/cybernus/history.ts` — sliding-window conversation trim.
 *
 * The invariant: after trimming, the request sent to the worker is always
 * ≤ MAX_HISTORY_MESSAGES and always starts on a user turn. The second
 * part matters because an orphaned assistant reply at the head of the
 * context confuses the model about who spoke first.
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
    // But not the same reference — caller gets a fresh array either way.
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
    // 100 messages, trim to 51. Naive cut would start at index 49, which is
    // an assistant message (odd index). The trimmer should advance to 50.
    const input = conversation(100);
    const out = trimHistoryForRequest(input, 51);
    expect(out[0]?.role).toBe('user');
    expect(out.length).toBe(50); // dropped one extra to align
  });

  it('handles conversations that start on assistant (loaded-from-storage edge case)', () => {
    // memory.ts trims to 50 without alignment, so a reloaded session might
    // start mid-pair. When we trim again for the request, we still align.
    const input: ChatMessage[] = [
      msg('assistant', 0),
      msg('user', 1),
      msg('assistant', 2),
      msg('user', 3),
      msg('assistant', 4),
    ];
    const out = trimHistoryForRequest(input, 3);
    // Naive cut at index 2 (assistant) → advance to index 3 (user).
    expect(out[0]?.role).toBe('user');
    expect(out).toEqual([input[3], input[4]]);
  });

  it('returns empty if the tail contains no user messages (pathological)', () => {
    // Three assistant messages in a row, trim to 2. No user message to
    // align to → empty result. Better than sending a confused prompt.
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

  it('aligns to user even when no trim is needed (assistant-headed short list)', () => {
    // Regression: memory.ts trims to 50 without alignment; if that list is
    // then ≤ MAX_HISTORY_MESSAGES, the old early-return path copied it
    // verbatim, violating the user-turn invariant the file header promises.
    const input: ChatMessage[] = [
      msg('assistant', 0), // orphan — should be dropped
      msg('user', 1),
      msg('assistant', 2),
    ];
    const out = trimHistoryForRequest(input, 50);
    expect(out[0]?.role).toBe('user');
    expect(out).toEqual([input[1], input[2]]);
  });

  it('returns empty for a no-user short list (consistent with trim-path behaviour)', () => {
    // The trim path returns [] when no user message exists in the tail; the
    // no-trim path must match — one enforcement point, one outcome.
    const input: ChatMessage[] = [msg('assistant', 0), msg('assistant', 1)];
    expect(trimHistoryForRequest(input, 50)).toEqual([]);
  });
});
