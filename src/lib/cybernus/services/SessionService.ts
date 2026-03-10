/**
 * SessionService — persists chat sessions in localStorage.
 *
 * Manages multiple named sessions with timestamps, search indexing,
 * and migration from legacy storage formats.
 */

import type { ChatMessage, ChatSession } from '../types';

const SESSIONS_KEY = 'ai-chat-sessions';
const ACTIVE_KEY = 'ai-chat-active';
const LEGACY_KEY = 'ai-chat-history';
const MAX_SESSIONS = 50;
const MAX_MESSAGES_PER_SESSION = 50;

/** Generate a short title from the first user message. */
function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New Chat';
  const text = firstUser.content.slice(0, 60);
  return text.length < firstUser.content.length ? text + '…' : text;
}

/** Validate a message shape from storage. */
function isValidMessage(m: unknown): m is ChatMessage {
  return (
    typeof m === 'object' &&
    m !== null &&
    typeof (m as ChatMessage).id === 'string' &&
    ((m as ChatMessage).role === 'user' || (m as ChatMessage).role === 'assistant') &&
    typeof (m as ChatMessage).content === 'string'
  );
}

/** Migrate legacy single-session storage. */
function migrateLegacy(): void {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(LEGACY_KEY);
      return;
    }
    const messages = parsed.filter(isValidMessage);
    if (messages.length === 0) {
      localStorage.removeItem(LEGACY_KEY);
      return;
    }
    const session: ChatSession = {
      id: crypto.randomUUID(),
      title: deriveTitle(messages),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages,
    };
    localStorage.setItem(SESSIONS_KEY, JSON.stringify([session]));
    localStorage.setItem(ACTIVE_KEY, session.id);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Migration failed — start fresh.
  }
}

/** Load all sessions from localStorage. */
export function loadSessions(): ChatSession[] {
  migrateLegacy();
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as ChatSession[])
      .filter(
        (s) => typeof s.id === 'string' && typeof s.title === 'string' && Array.isArray(s.messages),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/** Persist the sessions array. */
function saveSessions(sessions: ChatSession[]): void {
  try {
    const trimmed = sessions.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_SESSIONS);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full — silently ignore.
  }
}

/** Get the active session ID. */
export function getActiveSessionId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

/** Set the active session ID. */
export function setActiveSessionId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
  } catch {
    // Silently ignore.
  }
}

/** Save messages to the active session. */
export function saveMessages(messages: ChatMessage[], sessionId?: string): string {
  const sessions = loadSessions();
  const id = sessionId ?? getActiveSessionId() ?? crypto.randomUUID();
  const existing = sessions.find((s) => s.id === id);

  if (existing) {
    existing.messages = messages.slice(-MAX_MESSAGES_PER_SESSION);
    existing.title = deriveTitle(existing.messages);
    existing.updatedAt = Date.now();
  } else {
    sessions.push({
      id,
      title: deriveTitle(messages),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: messages.slice(-MAX_MESSAGES_PER_SESSION),
    });
  }

  saveSessions(sessions);
  setActiveSessionId(id);
  return id;
}

/** Load messages from the active session. */
export function loadMessages(): ChatMessage[] {
  const activeId = getActiveSessionId();
  if (!activeId) return [];
  const sessions = loadSessions();
  const session = sessions.find((s) => s.id === activeId);
  return session?.messages.filter(isValidMessage) ?? [];
}

/** Clear the active session pointer (does not delete). */
export function clearMessages(): void {
  setActiveSessionId(null);
}

/** Delete a specific session. */
export function deleteSession(sessionId: string): void {
  const sessions = loadSessions().filter((s) => s.id !== sessionId);
  saveSessions(sessions);
  if (getActiveSessionId() === sessionId) {
    setActiveSessionId(null);
  }
}

/** Delete all sessions. */
export function clearAllSessions(): void {
  try {
    localStorage.removeItem(SESSIONS_KEY);
    localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // Silently ignore.
  }
}
