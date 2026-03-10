/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSessions,
  saveMessages,
  loadMessages,
  clearMessages,
  deleteSession,
  clearAllSessions,
  setActiveSessionId,
} from '@lib/cybernus/services/SessionService';
import type { ChatMessage } from '@lib/cybernus/types';

const TEST_MESSAGES: ChatMessage[] = [
  { id: 'msg-1', role: 'user', content: 'Hello' },
  { id: 'msg-2', role: 'assistant', content: 'Hi there! How can I help?' },
];

describe('SessionService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('saveMessages / loadMessages', () => {
    it('saves and loads messages for a new session', () => {
      const sessionId = saveMessages(TEST_MESSAGES);
      expect(sessionId).toBeTruthy();

      const loaded = loadMessages();
      expect(loaded).toHaveLength(2);
      expect(loaded[0]?.content).toBe('Hello');
    });

    it('updates existing session when sessionId is provided', () => {
      const sessionId = saveMessages(TEST_MESSAGES);
      const additionalMsg: ChatMessage = { id: 'msg-3', role: 'user', content: 'Follow up' };
      const sameId = saveMessages([...TEST_MESSAGES, additionalMsg], sessionId);
      expect(sameId).toBe(sessionId);

      const sessions = loadSessions();
      expect(sessions).toHaveLength(1);
    });

    it('generates title from first user message', () => {
      saveMessages(TEST_MESSAGES);
      const sessions = loadSessions();
      expect(sessions[0]?.title).toBe('Hello');
    });
  });

  describe('loadSessions', () => {
    it('returns empty array when no sessions exist', () => {
      const sessions = loadSessions();
      expect(sessions).toHaveLength(0);
    });

    it('returns sessions sorted by updatedAt (most recent first)', () => {
      saveMessages([{ id: '1', role: 'user', content: 'First' }]);
      // Clear active so the second save creates a new session
      setActiveSessionId(null);
      saveMessages([{ id: '2', role: 'user', content: 'Second' }]);
      const sessions = loadSessions();
      expect(sessions.length).toBe(2);
      const first = sessions[0];
      const second = sessions[1];
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      if (first && second) {
        expect(first.updatedAt).toBeGreaterThanOrEqual(second.updatedAt);
      }
    });
  });

  describe('clearMessages', () => {
    it('clears the active session', () => {
      saveMessages(TEST_MESSAGES);
      clearMessages();
      const loaded = loadMessages();
      expect(loaded).toHaveLength(0);
    });
  });

  describe('deleteSession', () => {
    it('removes a specific session', () => {
      const id = saveMessages(TEST_MESSAGES);
      deleteSession(id);
      const sessions = loadSessions();
      expect(sessions.find((s) => s.id === id)).toBeUndefined();
    });
  });

  describe('clearAllSessions', () => {
    it('removes all sessions', () => {
      saveMessages([{ id: '1', role: 'user', content: 'First' }]);
      setActiveSessionId(null);
      saveMessages([{ id: '2', role: 'user', content: 'Second' }]);
      clearAllSessions();
      expect(loadSessions()).toHaveLength(0);
    });
  });
});
