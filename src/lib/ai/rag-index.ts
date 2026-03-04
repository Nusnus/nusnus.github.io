/**
 * RAG index builder (server/build-time only).
 *
 * Reads all site content, splits it into searchable chunks, extracts
 * keywords, and produces a serialisable SearchIndex. This file uses
 * Node.js APIs and must NOT be imported from client-side code.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RepoData } from '@lib/github/types';
import { LINKEDIN_ARTICLES, COLLABORATIONS } from '@lib/utils/constants';
import type { SearchChunk, SearchIndex } from './types';

/** Common English stop words excluded from keyword extraction. */
const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'shall',
  'should',
  'may',
  'might',
  'can',
  'could',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'i',
  'me',
  'my',
  'we',
  'our',
  'you',
  'your',
  'he',
  'she',
  'they',
  'them',
  'his',
  'her',
  'not',
  'no',
  'so',
  'if',
  'as',
  'from',
  'about',
  'into',
  'than',
  'then',
  'also',
  'just',
  'more',
  'very',
  'what',
  'which',
  'who',
  'whom',
  'how',
  'when',
  'where',
  'why',
]);

/** Extract lowercase keywords from text, filtering stop words. */
function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/** Create a single search chunk. */
function chunk(id: string, source: string, content: string): SearchChunk {
  return { id, source, content: content.trim(), keywords: extractKeywords(content) };
}

/** Build the full search index from all available site data. */
export function buildSearchIndex(repos: RepoData[], orgRepos: RepoData[]): SearchIndex {
  const chunks: SearchChunk[] = [];

  /* ── Knowledge base sections ── */
  const knowledgePath = join(process.cwd(), 'public', 'data', 'ai-context', 'knowledge.md');
  const knowledge = readFileSync(knowledgePath, 'utf-8');
  const sections = knowledge.split(/^## /m).filter(Boolean);

  for (const section of sections) {
    const firstLine = section.split('\n')[0]?.trim() ?? 'General';
    const body = section.slice(firstLine.length).trim();
    if (body.length > 20) {
      chunks.push(chunk(`kb-${chunks.length}`, `Knowledge > ${firstLine}`, body));
    }
  }

  /* ── Repository data ── */
  for (const r of repos) {
    const rank = r.contributorRank ? `#${r.contributorRank} all-time contributor. ` : '';
    const text =
      `${r.fullName}: ${r.description}. ` +
      `${r.stars} stars, ${r.forks} forks. Role: ${r.role}. ${rank}` +
      `Language: ${r.language ?? 'Python'}. Last push: ${r.lastPush}.`;
    chunks.push(chunk(`repo-${r.name}`, `Project > ${r.fullName}`, text));
  }

  for (const r of orgRepos) {
    const text = `${r.fullName}: ${r.description}. ${r.stars} stars. Role: ${r.role}.`;
    chunks.push(chunk(`org-${r.name}`, `Celery Org > ${r.fullName}`, text));
  }

  /* ── Articles ── */
  for (const [i, a] of LINKEDIN_ARTICLES.entries()) {
    const text = `"${a.title}" published ${a.publishedAt}. ${a.excerpt}. URL: ${a.url}`;
    chunks.push(chunk(`article-${i}`, `Article > ${a.title}`, text));
  }

  /* ── Collaborations ── */
  for (const [i, c] of COLLABORATIONS.entries()) {
    const text = `${c.name}: ${c.title}. ${c.description}. URL: ${c.url}`;
    chunks.push(chunk(`collab-${i}`, `Collaboration > ${c.name}`, text));
  }

  /* ── Compute average doc length for BM25 ── */
  const totalKeywords = chunks.reduce((sum, c) => sum + c.keywords.length, 0);
  const avgDocLength = chunks.length > 0 ? totalKeywords / chunks.length : 1;

  return { chunks, avgDocLength };
}
