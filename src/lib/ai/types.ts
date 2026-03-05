/**
 * Shared types for the Cybernus chat subsystem.
 *
 * Optional fields explicitly include `| undefined` so they play nice with
 * `exactOptionalPropertyTypes` — we legitimately clear them during streaming
 * (e.g. `{ ...msg, status: undefined }` when the first text token arrives).
 */

/** Ephemeral activity state shown in the assistant bubble while generating. */
export type MessageStatus =
  | 'thinking' // model is reasoning (reasoning tokens streaming)
  | 'searching' // web_search tool running
  | 'reading' // MCP tool running (DeepWiki / Context7)
  | 'coding' // code_execution tool running
  | 'found'; // a tool completed, synthesizing answer

/** A single message in the chat conversation. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Client-side actions parsed from the assistant's response. */
  actions?: ToolAction[] | undefined;
  /** Live activity status for the assistant bubble while generating. */
  status?: MessageStatus | undefined;
  /** Cumulative reasoning tokens observed (for "thinking N tokens" display). */
  reasoningTokens?: number | undefined;
}

/** A client-side action the assistant can suggest. */
export interface ToolAction {
  type: 'navigate' | 'open_link';
  /** Display label for the action button. */
  label: string;
  /** URL or path to navigate to / open. */
  url: string;
}
