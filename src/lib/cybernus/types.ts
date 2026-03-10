/**
 * Shared types for the Cybernus AI system.
 */

/** A single message in the chat conversation. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Client-side actions parsed from the assistant's response. */
  actions?: ToolAction[];
  /** Web search phase: 'searching' while running, 'found' when complete. */
  searchStatus?: 'searching' | 'found';
  /** Tool calls made during this message. */
  toolCalls?: AgentToolCall[];
  /** Timestamp of when the message was created. */
  timestamp?: number;
}

/** A client-side action the assistant can suggest. */
export interface ToolAction {
  type: 'navigate' | 'open_link';
  label: string;
  url: string;
}

/** An MCP agent tool call record. */
export interface AgentToolCall {
  id: string;
  toolName: string;
  serverLabel?: string;
  arguments: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: string;
  timestamp: number;
}

/** Agent tool configuration. */
export interface AgentTool {
  id: string;
  name: string;
  description: string;
  type: 'builtin' | 'mcp';
  enabled: boolean;
  /** MCP server URL (for MCP tools). */
  serverUrl?: string;
  /** MCP server label. */
  serverLabel?: string;
  icon: string;
}

/** A persisted chat session. */
export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

/** Search result from history search. */
export interface SearchResult {
  sessionId: string;
  sessionTitle: string;
  messageId: string;
  messageRole: 'user' | 'assistant';
  content: string;
  matchStart: number;
  matchEnd: number;
  timestamp: number;
}

/** Voice connection state. */
export type VoiceState =
  | 'idle'
  | 'requesting-mic'
  | 'connecting'
  | 'connected'
  | 'recording'
  | 'transcribing'
  | 'speaking'
  | 'error';

/** Realtime voice session state. */
export type RealtimeVoiceState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'speaking'
  | 'listening'
  | 'error';

/** TTS playback state. */
export type TTSState = 'idle' | 'loading' | 'playing' | 'error';
