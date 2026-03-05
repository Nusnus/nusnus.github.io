/**
 * Conversation history trimming — sliding-window compression.
 *
 * The Cloudflare Worker caps request `input` at `MAX_INPUT_ITEMS = 60`.
 * A single long-running chat can blow past that (30 user messages + 30
 * assistant replies = 60, plus the system message = 61 → 400 error).
 *
 * `memory.ts` already trims *persisted* sessions to 50 messages, but that
 * only helps after a reload. In-flight state can grow past 60 in one
 * sitting. This module trims the history *at send time* so the request
 * always fits.
 *
 * Strategy: pure tail-keep (most recent N messages), aligned to a user
 * message so the model never sees an orphaned assistant reply as the
 * start of the conversation.
 *
 * This is the "standard history / summarize chat" answer from the spec —
 * a transparent sliding window rather than an LLM-based summary call
 * (which would add latency and cost on every over-length send).
 */

import type { ChatMessage } from '@lib/ai/types';

/**
 * Maximum messages to include in a request. Worker caps at 60 items
 * including the system message; 50 here leaves comfortable headroom.
 */
export const MAX_HISTORY_MESSAGES = 50;

/**
 * Trim a conversation to the most recent `max` messages, aligned so the
 * first kept message is always a user turn.
 *
 * @param messages Full conversation (user/assistant alternating, but we
 *   don't assume strict alternation — a trimmed-and-reloaded session
 *   might start mid-pair).
 * @param max Maximum messages to keep. Defaults to {@link MAX_HISTORY_MESSAGES}.
 * @returns The trimmed slice. Returns the input unchanged if already short
 *   enough. Returns an empty array only if the input was empty or
 *   contained no user messages in the keepable tail (pathological).
 */
export function trimHistoryForRequest(
  messages: readonly ChatMessage[],
  max: number = MAX_HISTORY_MESSAGES,
): ChatMessage[] {
  if (messages.length <= max) return [...messages];

  // Start at the naive cut point, then advance until we land on a user
  // message. Dropping one extra assistant turn is cheaper than confusing
  // the model with a conversation that appears to start mid-reply.
  let start = messages.length - max;
  while (start < messages.length && messages[start]?.role !== 'user') {
    start++;
  }

  return messages.slice(start);
}
