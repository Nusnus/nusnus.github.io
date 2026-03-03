/**
 * Chat memory — persists conversation history in localStorage.
 *
 * Messages are stored as a JSON array under a single key.
 * A maximum cap prevents unbounded storage growth.
 */

import type { ChatMessage } from './types';

const STORAGE_KEY = 'ai-chat-history';
const MAX_MESSAGES = 50;

/** Save messages to localStorage, keeping the most recent MAX_MESSAGES. */
export function saveMessages(messages: ChatMessage[]): void {
  try {
    const trimmed = messages.slice(-MAX_MESSAGES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full or unavailable — silently ignore.
  }
}

/** Load previously saved messages from localStorage. */
export function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Basic shape validation
    return parsed.filter(
      (m): m is ChatMessage =>
        typeof m === 'object' &&
        m !== null &&
        typeof m.id === 'string' &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string',
    );
  } catch {
    return [];
  }
}

/** Remove all stored messages. */
export function clearMessages(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently ignore.
  }
}
