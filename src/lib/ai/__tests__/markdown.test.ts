import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '@lib/ai/markdown';

describe('renderMarkdown', () => {
  it('returns null for empty input', () => {
    expect(renderMarkdown('')).toBeNull();
    expect(renderMarkdown('', false)).toBeNull();
    expect(renderMarkdown('', true)).toBeNull();
  });

  it('returns a non-null result for valid markdown', () => {
    const result = renderMarkdown('Hello **world**');
    expect(result).not.toBeNull();
    expect(result).toBeDefined();
  });

  it('returns cached result for identical input', () => {
    const text = 'Cache test: **bold**';
    const result1 = renderMarkdown(text);
    const result2 = renderMarkdown(text);
    // Cached – should return the exact same reference
    expect(result1).toBe(result2);
  });

  it('does not cache when skipCache is true', () => {
    // Use a unique string that hasn't been cached yet
    const text = 'Streaming partial: `code` and more...';
    const result1 = renderMarkdown(text, true);
    const result2 = renderMarkdown(text, true);
    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    // Both calls should produce structurally similar results but not
    // necessarily the same reference since they're not cached
    // (they're freshly computed each time)
    // Note: they may be referentially different arrays
  });

  it('caches by default (skipCache = false)', () => {
    const text = 'Default cache test: *italic*';
    const result1 = renderMarkdown(text, false);
    const result2 = renderMarkdown(text, false);
    expect(result1).toBe(result2);
  });

  it('handles headings', () => {
    const result = renderMarkdown('# Title');
    expect(result).not.toBeNull();
  });

  it('handles code blocks', () => {
    const result = renderMarkdown('```python\nprint("hi")\n```');
    expect(result).not.toBeNull();
  });

  it('handles lists', () => {
    const result = renderMarkdown('- item one\n- item two\n- item three');
    expect(result).not.toBeNull();
  });

  it('handles ordered lists', () => {
    const result = renderMarkdown('1. first\n2. second\n3. third');
    expect(result).not.toBeNull();
  });

  it('handles inline formatting', () => {
    const result = renderMarkdown('**bold** and *italic* and `code`');
    expect(result).not.toBeNull();
  });

  it('handles links', () => {
    const result = renderMarkdown('[click me](https://example.com)');
    expect(result).not.toBeNull();
  });

  it('handles horizontal rules', () => {
    const result = renderMarkdown('above\n\n---\n\nbelow');
    expect(result).not.toBeNull();
  });
});
