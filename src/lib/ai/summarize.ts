/**
 * Conversation summarization.
 *
 * When the conversation grows too long, older messages are summarized
 * by the LLM into a single condensed message. This preserves context
 * while keeping the history within the model's context window.
 */

import type { MLCEngineInterface } from '@mlc-ai/web-llm';
import type { ChatMessage } from './types';

/**
 * Number of message pairs (user + assistant) before summarization triggers.
 * With the welcome message, this means summarization starts after ~10 exchanges.
 */
const SUMMARIZE_THRESHOLD = 20;

/**
 * Number of recent messages to keep verbatim (not summarized).
 * Older messages beyond this count are compressed into a summary.
 */
const KEEP_RECENT = 6;

/** The summarization prompt sent to the LLM. */
const SUMMARIZE_SYSTEM = `You are a conversation summarizer. Summarize the following conversation between a user and an AI assistant into a brief paragraph. Focus on:
- Key topics discussed
- Important facts or questions asked
- The user's interests

Be concise (3-5 sentences). Only output the summary, nothing else.`;

/**
 * Check if the conversation needs summarization and perform it if so.
 *
 * Returns the (possibly shortened) message list. If summarization occurs,
 * older messages are replaced with a single assistant message containing
 * the summary.
 */
export async function maybeSummarize(
  engine: MLCEngineInterface,
  messages: ChatMessage[],
): Promise<ChatMessage[]> {
  if (messages.length <= SUMMARIZE_THRESHOLD) return messages;

  const toSummarize = messages.slice(0, -KEEP_RECENT);
  const toKeep = messages.slice(-KEEP_RECENT);

  try {
    const conversationText = toSummarize
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const result = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: SUMMARIZE_SYSTEM },
        { role: 'user', content: conversationText },
      ],
      temperature: 0.3,
      max_tokens: 256,
    });

    const summary = result.choices[0]?.message?.content?.trim();
    if (!summary) return messages;

    const summaryMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `*[Earlier conversation summary]* ${summary}`,
    };

    return [summaryMsg, ...toKeep];
  } catch (err) {
    console.error('[AiChat] Summarization failed:', err);
    // Fallback: just trim old messages without summary
    return toKeep;
  }
}
