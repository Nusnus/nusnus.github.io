/**
 * RAG retrieval — client-side search over a pre-built index.
 *
 * Uses BM25 scoring to rank chunks by relevance to the user's query.
 * The index is built at build time (rag-index.ts) and passed as a prop.
 */

import type { SearchChunk, SearchIndex } from './types';

/** BM25 tuning parameters. */
const K1 = 1.5;
const B = 0.75;

/** Maximum number of chunks to return (kept low for 4K context windows). */
const TOP_K = 2;

/** Minimum score threshold — ignore near-zero matches. */
const MIN_SCORE = 0.1;

/**
 * Search the index for chunks relevant to the given query.
 * Returns the top-K most relevant chunks with their scores.
 */
export function searchIndex(
  query: string,
  index: SearchIndex,
): { chunk: SearchChunk; score: number }[] {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0 || index.chunks.length === 0) return [];

  // Build inverse document frequency (IDF) for each query term
  const N = index.chunks.length;
  const idf = new Map<string, number>();

  for (const term of queryTerms) {
    const df = index.chunks.filter((c) => c.keywords.includes(term)).length;
    // Standard BM25 IDF with smoothing
    idf.set(term, Math.log((N - df + 0.5) / (df + 0.5) + 1));
  }

  // Score each chunk
  const scored = index.chunks.map((chunk) => {
    let score = 0;
    const docLen = chunk.keywords.length;

    for (const term of queryTerms) {
      const tf = chunk.keywords.filter((k) => k === term).length;
      const termIdf = idf.get(term) ?? 0;
      // BM25 scoring formula
      score +=
        termIdf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (docLen / index.avgDocLength))));
    }

    return { chunk, score };
  });

  return scored
    .filter((s) => s.score > MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);
}

/**
 * Format retrieved chunks as a context string for the system prompt.
 */
export function formatRetrievedContext(results: { chunk: SearchChunk; score: number }[]): string {
  if (results.length === 0) return '';

  const MAX_CHARS = 600; // ~150 tokens — keep compact for 4K context
  let total = 0;
  const lines: string[] = [];
  for (const r of results) {
    const line = `[${r.chunk.source}]\n${r.chunk.content}`;
    if (total + line.length > MAX_CHARS) break;
    lines.push(line);
    total += line.length;
  }
  if (lines.length === 0) return '';

  return `\n# Relevant Context\n${lines.join('\n\n')}`;
}

/** Tokenize a query string into lowercase terms (>2 chars). */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}
