/**
 * Cloud-based summarization — collapses long conversations into a
 * compact summary using Grok itself.
 *
 * Triggered when the visible message count exceeds SUMMARIZE_AFTER_MESSAGES.
 * The oldest messages are replaced with a single synthetic assistant
 * message marked `isSummary: true`, which is sent to the model but
 * hidden from the UI.
 *
 * This keeps the worker's 30-item input limit comfortable and keeps
 * localStorage lean, without relying on WebLLM.
 */

import { cloudChat } from './cloud';
import { CYBERNUS_MODEL_ID, SUMMARIZE_AFTER_MESSAGES } from './config';
import type { ChatMessage } from './types';

/** Keep this many recent exchanges verbatim after summarizing. */
const KEEP_RECENT = 6;

/** Summary prefix — lets us detect existing summaries. */
const SUMMARY_PREFIX = '[Earlier conversation summary]';

/**
 * Maybe summarize the conversation. No-op if under threshold or
 * already contains a recent summary.
 *
 * Non-blocking failure: if summarization errors, returns the
 * original messages unchanged.
 */
export async function maybeSummarizeCloud(messages: ChatMessage[]): Promise<ChatMessage[]> {
  const userCount = messages.filter((m) => m.role === 'user').length;
  if (userCount < SUMMARIZE_AFTER_MESSAGES) return messages;

  // Don't re-summarize if there's already a summary in the tail region
  const tail = messages.slice(-KEEP_RECENT - 2);
  if (tail.some((m) => m.isSummary)) return messages;

  // Split: [existing summary?] [...to summarize] [...to keep]
  const keepFrom = Math.max(0, messages.length - KEEP_RECENT);
  const toSummarize = messages.slice(0, keepFrom);
  const toKeep = messages.slice(keepFrom);

  if (toSummarize.length === 0) return messages;

  const transcript = toSummarize
    .map((m) => `${m.role === 'user' ? 'User' : 'Cybernus'}: ${m.content}`)
    .join('\n\n');

  try {
    const result = await cloudChat(
      [
        {
          role: 'system',
          content:
            'You are a summarizer. Produce a dense, factual summary of the conversation below in 3-5 sentences. Preserve specific facts, names, numbers, and any unresolved threads. No preamble, no "the user asked" — just the meat.',
        },
        { role: 'user', content: transcript },
      ],
      CYBERNUS_MODEL_ID,
      { temperature: 0.3 },
    );

    const summaryMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `${SUMMARY_PREFIX} ${result.content}`,
      isSummary: true,
    };

    return [summaryMsg, ...toKeep];
  } catch {
    // Summarization is best-effort — fall back to the original on any error.
    return messages;
  }
}
