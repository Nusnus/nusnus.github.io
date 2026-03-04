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
  /** True while a web search is in progress (cloud provider only). */
  isSearching?: boolean;
}

/** A client-side action the assistant can suggest. */
export interface ToolAction {
  type: 'navigate' | 'open_link';
  /** Display label for the action button. */
  label: string;
  /** URL or path to navigate to / open. */
  url: string;
}

/** A chunk of indexed content for RAG retrieval. */
export interface SearchChunk {
  /** Unique chunk identifier. */
  id: string;
  /** The text content of the chunk. */
  content: string;
  /** Human-readable source label (e.g., "Knowledge Base > About"). */
  source: string;
  /** Pre-extracted lowercase keywords for BM25 scoring. */
  keywords: string[];
}

/** Pre-built search index serialized as a prop from the Astro page. */
export interface SearchIndex {
  chunks: SearchChunk[];
  /** Average document length in keywords (used for BM25 normalisation). */
  avgDocLength: number;
}
