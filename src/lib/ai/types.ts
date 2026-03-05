/**
 * Shared types for the AI chat subsystem.
 *
 * Used by both RoastWidget and the Cybernus agent.
 * Keep this file lean — Cybernus-specific types live in @lib/cybernus/.
 */

/** A single message in the chat conversation. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Client-side actions parsed from the assistant's response. */
  actions?: ToolAction[];
  /** Web search phase: 'searching' while running, 'found' when complete (synthesizing). */
  searchStatus?: 'searching' | 'found';
  /** Reasoning tokens used by Grok 4's internal thinking. Persisted for the curious. */
  reasoningTokens?: number;
}

/** A client-side action the assistant can suggest. */
export interface ToolAction {
  type: 'navigate' | 'open_link';
  /** Display label for the action button. */
  label: string;
  /** URL or path to navigate to / open. */
  url: string;
}
