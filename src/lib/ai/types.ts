/**
 * Shared types for the AI chatbot subsystem.
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
   * Whether this assistant message is currently in reasoning mode.
   * True while the model is thinking (before visible content streams).
   * Removed once content starts arriving.
   */
  thinking?: boolean;
  /**
   * Marks a synthetic summary message inserted by cloud-summarize.
   * Filtered out of the visible UI but sent to the model as context.
   */
  isSummary?: boolean;
}

/** A client-side action the assistant can suggest. */
export interface ToolAction {
  type: 'navigate' | 'open_link';
  /** Display label for the action button. */
  label: string;
  /** URL or path to navigate to / open. */
  url: string;
}
