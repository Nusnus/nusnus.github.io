/**
 * SearchService — full-text search across all chat sessions.
 *
 * Provides instant search with highlighting and ranking.
 */

import type { ChatSession, SearchResult } from '../types';
import { loadSessions } from './SessionService';

/** Normalize text for search: lowercase, collapse whitespace. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Search across all chat sessions for messages matching the query.
 * Returns results ranked by recency, with match positions for highlighting.
 */
export function searchHistory(query: string, maxResults = 20): SearchResult[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery || normalizedQuery.length < 2) return [];

  const sessions = loadSessions();
  const results: SearchResult[] = [];

  for (const session of sessions) {
    for (const message of session.messages) {
      // Use toLowerCase (not normalize) to preserve original whitespace positions
      const lowerContent = message.content.toLowerCase();
      const matchIndex = lowerContent.indexOf(normalizedQuery);

      if (matchIndex !== -1) {
        results.push({
          sessionId: session.id,
          sessionTitle: session.title,
          messageId: message.id,
          messageRole: message.role,
          content: message.content,
          matchStart: matchIndex,
          matchEnd: matchIndex + normalizedQuery.length,
          timestamp: message.timestamp ?? session.updatedAt,
        });
      }
    }
  }

  // Sort by recency
  results.sort((a, b) => b.timestamp - a.timestamp);

  return results.slice(0, maxResults);
}

/**
 * Extract a context snippet around a match position.
 * Returns ~100 chars around the match with "..." on truncated sides.
 */
export function getMatchSnippet(
  content: string,
  matchStart: number,
  matchEnd: number,
  contextChars = 50,
): { before: string; match: string; after: string } {
  const start = Math.max(0, matchStart - contextChars);
  const end = Math.min(content.length, matchEnd + contextChars);

  const before = (start > 0 ? '…' : '') + content.slice(start, matchStart);
  const match = content.slice(matchStart, matchEnd);
  const after = content.slice(matchEnd, end) + (end < content.length ? '…' : '');

  return { before, match, after };
}

/**
 * Get unique sessions that match a query, for session-level filtering.
 */
export function searchSessions(query: string): ChatSession[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery || normalizedQuery.length < 2) return loadSessions();

  const sessions = loadSessions();
  return sessions.filter((session) => {
    // Match session title
    if (normalize(session.title).includes(normalizedQuery)) return true;
    // Match any message content
    return session.messages.some((m) => normalize(m.content).includes(normalizedQuery));
  });
}
