/**
 * Shared types for the Cybernus AI chatbot subsystem.
 */

/** Inline agent activity record — displayed inside conversation messages. */
export interface AgentActivityItem {
  /** Agent display name (e.g. "Scout Agent", "Vision Agent"). */
  agent: string;
  /** Tool type being used (e.g. "web_search", "generate_image"). */
  toolType: string;
  /** Short status label (e.g. "Searching the web...", "Generating image..."). */
  label: string;
  /** Current status. */
  status: 'working' | 'done';
  /** SVG icon path (viewBox 0 0 24 24). */
  iconPath: string;
  /** Accent colour for this agent. */
  color: string;
}

/** A single message in the chat conversation. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Client-side actions parsed from the assistant's response. */
  actions?: ToolAction[];
  /** Web search phase: 'searching' while running, 'found' when complete (synthesizing). */
  searchStatus?: 'searching' | 'found';
  /** Inline sub-agent activity tracked during generation. */
  agentActivity?: AgentActivityItem[];
}

/** A client-side action the assistant can suggest. */
export interface ToolAction {
  type: 'navigate' | 'open_link';
  /** Display label for the action button. */
  label: string;
  /** URL or path to navigate to / open. */
  url: string;
}
