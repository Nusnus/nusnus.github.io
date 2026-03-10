/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  searchHistory,
  getMatchSnippet,
  searchSessions,
} from '@lib/cybernus/services/SearchService';
import type { ChatSession } from '@lib/cybernus/types';

// Mock localStorage with test sessions
function setupSessions(sessions: ChatSession[]) {
  localStorage.setItem('ai-chat-sessions', JSON.stringify(sessions));
}

const TEST_SESSIONS: ChatSession[] = [
  {
    id: 'session-1',
    title: 'Celery discussion',
    createdAt: Date.now() - 1000,
    updatedAt: Date.now() - 500,
    messages: [
      { id: 'msg-1', role: 'user', content: 'Tell me about Celery', timestamp: Date.now() - 1000 },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Celery is a distributed task queue for Python',
        timestamp: Date.now() - 900,
      },
    ],
  },
  {
    id: 'session-2',
    title: 'pytest-celery',
    createdAt: Date.now() - 2000,
    updatedAt: Date.now() - 1500,
    messages: [
      {
        id: 'msg-3',
        role: 'user',
        content: 'What is pytest-celery?',
        timestamp: Date.now() - 2000,
      },
      {
        id: 'msg-4',
        role: 'assistant',
        content: 'pytest-celery is a testing framework for Celery applications',
        timestamp: Date.now() - 1900,
      },
    ],
  },
];

describe('SearchService', () => {
  beforeEach(() => {
    localStorage.clear();
    setupSessions(TEST_SESSIONS);
  });

  describe('searchHistory', () => {
    it('finds messages matching query', () => {
      const results = searchHistory('celery');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.content.toLowerCase().includes('celery'))).toBe(true);
    });

    it('returns empty array for too-short queries', () => {
      expect(searchHistory('c')).toHaveLength(0);
      expect(searchHistory('')).toHaveLength(0);
    });

    it('returns empty array for non-matching queries', () => {
      expect(searchHistory('nonexistent-xyzzy')).toHaveLength(0);
    });

    it('results are sorted by recency', () => {
      const results = searchHistory('celery');
      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          const prev = results[i - 1];
          const curr = results[i];
          if (prev && curr) {
            expect(prev.timestamp).toBeGreaterThanOrEqual(curr.timestamp);
          }
        }
      }
    });

    it('respects maxResults limit', () => {
      const results = searchHistory('celery', 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('is case insensitive', () => {
      const lower = searchHistory('celery');
      const upper = searchHistory('CELERY');
      expect(lower.length).toBe(upper.length);
    });
  });

  describe('getMatchSnippet', () => {
    it('extracts snippet around match', () => {
      const content = 'This is a test string with the word Celery in it';
      const matchStart = content.indexOf('Celery');
      const matchEnd = matchStart + 'Celery'.length;
      const snippet = getMatchSnippet(content, matchStart, matchEnd);

      expect(snippet.match).toBe('Celery');
      expect(snippet.before).toContain('word');
      expect(snippet.after).toContain('in it');
    });

    it('handles match at beginning of content', () => {
      const content = 'Celery is great';
      const snippet = getMatchSnippet(content, 0, 6);
      expect(snippet.match).toBe('Celery');
      expect(snippet.before).toBe('');
    });

    it('handles match at end of content', () => {
      const content = 'I love Celery';
      const matchStart = content.indexOf('Celery');
      const snippet = getMatchSnippet(content, matchStart, content.length);
      expect(snippet.match).toBe('Celery');
      expect(snippet.after).toBe('');
    });
  });

  describe('searchSessions', () => {
    it('returns all sessions when query is empty', () => {
      const results = searchSessions('');
      expect(results.length).toBe(TEST_SESSIONS.length);
    });

    it('filters sessions by title match', () => {
      const results = searchSessions('pytest');
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe('session-2');
    });

    it('filters sessions by message content match', () => {
      const results = searchSessions('distributed task');
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe('session-1');
    });
  });
});
