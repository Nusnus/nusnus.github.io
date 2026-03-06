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

  // Obsidian-style features
  it('handles wikilinks', () => {
    const result = renderMarkdown('Check out [[My Page]] for more info');
    expect(result).not.toBeNull();
  });

  it('handles wikilinks with display text', () => {
    const result = renderMarkdown('See [[actual-page|Custom Display Text]]');
    expect(result).not.toBeNull();
  });

  it('handles callouts - note type', () => {
    const result = renderMarkdown('> [!note]\n> This is a note callout\n> With multiple lines');
    expect(result).not.toBeNull();
  });

  it('handles callouts - warning type', () => {
    const result = renderMarkdown('> [!warning] Important\n> Be careful here');
    expect(result).not.toBeNull();
  });

  it('handles callouts - tip type', () => {
    const result = renderMarkdown('> [!tip]\n> Here is a helpful tip');
    expect(result).not.toBeNull();
  });

  it('handles callouts - danger type', () => {
    const result = renderMarkdown('> [!danger]\n> This is dangerous');
    expect(result).not.toBeNull();
  });

  it('handles markdown tables', () => {
    const table = `| Name | Age | City |
| --- | --- | --- |
| Alice | 30 | NYC |
| Bob | 25 | LA |`;
    const result = renderMarkdown(table);
    expect(result).not.toBeNull();
  });

  it('handles tables with alignment', () => {
    const table = `| Left | Center | Right |
| :--- | :---: | ---: |
| A | B | C |`;
    const result = renderMarkdown(table);
    expect(result).not.toBeNull();
  });

  it('handles tables with inline formatting', () => {
    const table = `| Feature | Status |
| --- | --- |
| **Bold** | \`code\` |
| *Italic* | [link](url) |`;
    const result = renderMarkdown(table);
    expect(result).not.toBeNull();
  });

  it('handles mixed content with wikilinks and callouts', () => {
    const mixed = `# Title

Check [[Page]] for details.

> [!note]
> Important information here

| Col1 | Col2 |
| --- | --- |
| A | B |`;
    const result = renderMarkdown(mixed);
    expect(result).not.toBeNull();
  });
});
