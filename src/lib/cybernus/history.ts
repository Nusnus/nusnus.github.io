/**
 * Sliding-window conversation trim for API requests.
 *
 * The Cloudflare Worker caps `input` at MAX_INPUT_ITEMS=60 and rejects
 * anything over. Long sessions would eventually 400. We keep a tail of
 * ~50 messages (leaving room for the system message and one fresh turn)
 * and align the cut to a user-turn boundary so the model never sees an
 * orphaned assistant reply at the head of its context.
 *
 * localStorage persistence (`memory.ts`) trims to 50 WITHOUT alignment,
 * so a reloaded session might already start mid-pair — this trimmer
 * handles that too.
 */

import type { ChatMessage } from '@lib/ai/types';

/** Maximum conversation messages to send in a request. */
export const MAX_HISTORY_MESSAGES = 50;

/**
 * Trim a message list to at most `max` items, aligned to a user turn.
 *
 * Always returns a fresh array (never the input reference).
 *
 * Algorithm:
 *   1. Cut to the last `max` messages (clamped — a short list starts at 0).
 *   2. If the cut landed on an assistant message, advance until it lands
 *      on a user message (or runs out → empty).
 *
 * Step 2 runs even when no trim was needed: a session loaded from
 * localStorage may already be assistant-headed (see file header), and
 * we want a single enforcement point for the user-turn invariant.
 */
export function trimHistoryForRequest(
  messages: readonly ChatMessage[],
  max: number = MAX_HISTORY_MESSAGES,
): ChatMessage[] {
  let start = Math.max(0, messages.length - max);
  // Advance past any orphaned assistant messages at the head of the cut.
  // A conversation tail starting with "assistant said X" confuses the model
  // about who spoke first.
  while (start < messages.length && messages[start]?.role !== 'user') {
    start++;
  }
  return messages.slice(start);
}
