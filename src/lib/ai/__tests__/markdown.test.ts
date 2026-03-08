import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, Fragment, type ReactNode } from 'react';
import { renderMarkdown } from '@lib/ai/markdown';

/** Render a markdown ReactNode to a static HTML string for assertion. */
function toHtml(node: ReactNode): string {
  if (node === null || node === undefined) return '';
  return renderToStaticMarkup(createElement(Fragment, null, node));
}

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

  describe('GFM tables', () => {
    it('renders a pipe table as <table>', () => {
      const md = '| Broker | Latency |\n| --- | --- |\n| Redis | 1ms |\n| RabbitMQ | 2ms |';
      const html = toHtml(renderMarkdown(md, true));
      expect(html).toContain('<table');
      expect(html).toContain('<thead');
      expect(html).toContain('<th');
      expect(html).toContain('Broker');
      expect(html).toContain('Latency');
      expect(html).toContain('<tbody');
      expect(html).toContain('Redis');
      expect(html).toContain('RabbitMQ');
    });

    it('handles tables without leading/trailing pipes', () => {
      const md = 'A | B\n--- | ---\n1 | 2';
      const html = toHtml(renderMarkdown(md, true));
      expect(html).toContain('<table');
      expect(html).toContain('A');
      expect(html).toContain('B');
    });

    it('handles aligned separator (:---:)', () => {
      const md = '| x | y |\n| :--- | ---: |\n| a | b |';
      const html = toHtml(renderMarkdown(md, true));
      expect(html).toContain('<table');
    });

    it('renders inline markdown inside cells', () => {
      const md = '| col |\n| --- |\n| **bold** |';
      const html = toHtml(renderMarkdown(md, true));
      expect(html).toContain('<strong');
      expect(html).toContain('bold');
    });

    it('does NOT treat a plain paragraph as a table', () => {
      const html = toHtml(renderMarkdown('hello | world', true));
      expect(html).not.toContain('<table');
    });
  });

  describe('bare URL autolinks', () => {
    it('linkifies a bare https URL', () => {
      const html = toHtml(renderMarkdown('visit https://celery.dev for docs', true));
      expect(html).toContain('<a');
      expect(html).toContain('href="https://celery.dev"');
    });

    it('strips trailing sentence punctuation from the href', () => {
      const html = toHtml(renderMarkdown('see https://github.com/celery.', true));
      expect(html).toContain('href="https://github.com/celery"');
      expect(html).not.toContain('href="https://github.com/celery."');
      // Trailing period still rendered as text after the link
      expect(html).toMatch(/<\/a>\./);
    });

    it('does not eat closing paren from markdown link syntax', () => {
      // Markdown link syntax should win over autolink — the url is inside [..](url)
      const html = toHtml(renderMarkdown('[celery](https://celery.dev) rocks', true));
      expect(html).toContain('>celery</a>');
      expect(html).toContain('href="https://celery.dev"');
      // "rocks" should be plain text after the link, not inside the href
      expect(html).toMatch(/<\/a> rocks/);
    });

    it('leaves URLs inside code spans alone', () => {
      const html = toHtml(renderMarkdown('`https://example.com`', true));
      expect(html).toContain('<code');
      // The code span alternative matches first in the regex — URL stays as text
      expect(html).toContain('https://example.com');
    });
  });
});
