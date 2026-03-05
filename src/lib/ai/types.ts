/**
 * Shared types for the AI chat subsystem.
 *
 * Used by both the legacy RoastWidget and the new Cybernus agent.
 * Keep this file lean — Cybernus-specific types live in @lib/cybernus/types.
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
  /**
   * Live tool activity labels (e.g. "DeepWiki", "Python", "Web search").
   * Populated during streaming so the UI can show what's happening.
   */
  toolActivity?: string[];
  /** Reasoning tokens used by Grok 4's internal thinking. Updates during stream. */
  reasoningTokens?: number;
  /** True while the model is still reasoning (before first output token). */
  isThinking?: boolean;
}

/** A client-side action the assistant can suggest. */
export interface ToolAction {
  type: 'navigate' | 'open_link';
  /** Display label for the action button. */
  label: string;
  /** URL or path to navigate to / open. */
  url: string;
}
