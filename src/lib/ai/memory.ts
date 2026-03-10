/**
 * Chat memory — persists conversation sessions in localStorage.
 *
 * This module re-exports session management from the canonical
 * `@lib/cybernus/services/SessionService` to eliminate duplication.
 * The `ChatSession` type is re-exported from `@lib/cybernus/types`.
 */

export type { ChatSession } from '@lib/cybernus/types';

export {
  loadSessions,
  getActiveSessionId,
  setActiveSessionId,
  saveMessages,
  loadMessages,
  clearMessages,
  deleteSession,
  clearAllSessions,
} from '@lib/cybernus/services/SessionService';
