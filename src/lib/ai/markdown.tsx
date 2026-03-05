/**
 * Lightweight markdown renderer for AI chat responses.
 *
 * Supports:
 *   Block: headings (# ## ###), ```code blocks``` (+ syntax highlighting,
 *   + Mermaid), | tables |, > blockquotes, - [ ] task lists, unordered
 *   lists (- item), ordered lists (1. item), horizontal rules (---),
 *   paragraphs.
 *   Inline: **bold**, *italic*, `inline code`, [links](url), [[n]](url)
 *   citations, and bare URLs (auto-linked).
 *
 * No external dependencies — keeps the bundle small.
 * Obsidian-flavoured enough for Cybernus to format rich answers.
 */
import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';

const MermaidBlock = lazy(() => import('@components/widgets/MermaidBlock'));

const HEADING_CLASSES: Record<number, string> = {
  1: 'text-base font-bold mt-3 mb-1',
  2: 'text-sm font-bold mt-2.5 mb-1',
  3: 'text-sm font-semibold mt-2 mb-0.5',
};

/* ── Minimal keyword-based syntax highlighter ──
 * Avoids pulling in shiki/prism at runtime. Covers the languages
 * the AI is most likely to produce (Python, JS/TS, shell, etc.). */

const KEYWORD_SETS: Record<string, Set<string>> = {
  python: new Set([
    'def',
    'class',
    'import',
    'from',
    'return',
    'if',
    'elif',
    'else',
    'for',
    'while',
    'try',
    'except',
    'finally',
    'with',
    'as',
    'yield',
    'raise',
    'pass',
    'break',
    'continue',
    'and',
    'or',
    'not',
    'in',
    'is',
    'None',
    'True',
    'False',
    'lambda',
    'async',
    'await',
    'self',
    'print',
    'global',
    'nonlocal',
    'del',
    'assert',
  ]),
  javascript: new Set([
    'const',
    'let',
    'var',
    'function',
    'return',
    'if',
    'else',
    'for',
    'while',
    'do',
    'switch',
    'case',
    'break',
    'continue',
    'new',
    'this',
    'class',
    'extends',
    'import',
    'export',
    'from',
    'default',
    'try',
    'catch',
    'finally',
    'throw',
    'async',
    'await',
    'yield',
    'typeof',
    'instanceof',
    'in',
    'of',
    'null',
    'undefined',
    'true',
    'false',
    'void',
    'delete',
    'super',
    'static',
    'get',
    'set',
  ]),
  shell: new Set([
    'if',
    'then',
    'else',
    'elif',
    'fi',
    'for',
    'while',
    'do',
    'done',
    'case',
    'esac',
    'function',
    'return',
    'exit',
    'echo',
    'export',
    'source',
    'cd',
    'ls',
    'rm',
    'mkdir',
    'cp',
    'mv',
    'cat',
    'grep',
    'sed',
    'awk',
    'curl',
    'wget',
    'sudo',
    'apt',
    'brew',
    'npm',
    'bun',
    'pip',
    'docker',
    'git',
  ]),
};

// Alias common lang identifiers
const LANG_ALIAS: Record<string, string> = {
  py: 'python',
  python: 'python',
  python3: 'python',
  js: 'javascript',
  javascript: 'javascript',
  jsx: 'javascript',
  ts: 'javascript',
  typescript: 'javascript',
  tsx: 'javascript',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  shell: 'shell',
};

function highlightCode(code: string, lang: string): ReactNode[] {
  const resolved = LANG_ALIAS[lang.toLowerCase()] ?? '';
  const keywords = KEYWORD_SETS[resolved];
  if (!keywords) {
    // Unknown language — return plain text
    return [code];
  }

  const elements: ReactNode[] = [];
  // Tokenize: strings, comments, numbers, words, whitespace/symbols
  const tokenRegex =
    /(#[^\n]*|\/\/[^\n]*|\/\*[\s\S]*?\*\/|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b[0-9]+(?:\.[0-9]+)?\b|@\w+|\b[a-zA-Z_]\w*\b)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenRegex.exec(code)) !== null) {
    // Plain text before token
    if (match.index > lastIndex) {
      elements.push(code.slice(lastIndex, match.index));
    }

    const token = match[0];
    const ch = token[0] ?? '';

    if (ch === '#' || token.startsWith('//') || token.startsWith('/*')) {
      // Comment
      elements.push(
        <span key={key++} className="text-text-muted italic">
          {token}
        </span>,
      );
    } else if (ch === '"' || ch === "'" || ch === '`') {
      // String
      elements.push(
        <span key={key++} className="text-status-warning">
          {token}
        </span>,
      );
    } else if (ch === '@') {
      // Decorator
      elements.push(
        <span key={key++} className="text-accent">
          {token}
        </span>,
      );
    } else if (/^[0-9]/.test(ch)) {
      // Number
      elements.push(
        <span key={key++} className="text-accent">
          {token}
        </span>,
      );
    } else if (keywords.has(token)) {
      // Keyword
      elements.push(
        <span key={key++} className="text-accent font-semibold">
          {token}
        </span>,
      );
    } else {
      elements.push(token);
    }

    lastIndex = match.index + token.length;
  }

  // Remaining text
  if (lastIndex < code.length) {
    elements.push(code.slice(lastIndex));
  }

  return elements;
}

/** React component for a highlighted code block. */
function HighlightedCodeBlock({
  code,
  lang,
  blockKey,
}: {
  code: string;
  lang: string;
  blockKey: number;
}) {
  return (
    <pre
      key={blockKey}
      className="bg-bg-elevated scrollbar-thin my-2 overflow-x-auto rounded-lg p-3 text-xs"
    >
      <code>{highlightCode(code, lang)}</code>
    </pre>
  );
}

/** LRU-ish cache for rendered markdown (avoids re-parsing identical strings). */
const markdownCache = new Map<string, ReactNode>();
const MAX_CACHE_SIZE = 100;

/**
 * Render a markdown string as React elements (memoized).
 *
 * @param text - The markdown string to render
 * @param skipCache - Skip caching (use during streaming to avoid polluting the cache with partial strings)
 */
export function renderMarkdown(text: string, skipCache = false): ReactNode {
  if (!text) return null;

  const cached = markdownCache.get(text);
  if (cached !== undefined) return cached;

  const blocks = splitBlocks(text);
  const result = blocks.map((block, i) => renderBlock(block, i));

  if (!skipCache) {
    // Evict oldest entries if cache is too large
    if (markdownCache.size >= MAX_CACHE_SIZE) {
      const firstKey = markdownCache.keys().next().value;
      if (firstKey !== undefined) markdownCache.delete(firstKey);
    }
    markdownCache.set(text, result);
  }
  return result;
}

/** Split text into blocks while keeping fenced code blocks intact. */
function splitBlocks(text: string): string[] {
  const blocks: string[] = [];
  const lines = text.split('\n');
  let current: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        current.push(line);
        blocks.push(current.join('\n'));
        current = [];
        inCodeBlock = false;
      } else {
        // Start of code block — flush current
        if (current.length > 0) {
          const joined = current.join('\n').trim();
          if (joined) blocks.push(joined);
          current = [];
        }
        current.push(line);
        inCodeBlock = true;
      }
    } else if (inCodeBlock) {
      current.push(line);
    } else if (line.trim() === '') {
      // Empty line — flush current block
      if (current.length > 0) {
        const joined = current.join('\n').trim();
        if (joined) blocks.push(joined);
        current = [];
      }
    } else {
      current.push(line);
    }
  }

  // Flush remaining
  if (current.length > 0) {
    const joined = current.join('\n').trim();
    if (joined) blocks.push(joined);
  }

  return blocks;
}

/** Render a single block (heading, code, list, hr, or paragraph). */
function renderBlock(block: string, key: number): ReactNode {
  const trimmed = block.trim();
  if (!trimmed) return null;

  // Code block: ```lang\n...\n```
  const codeBlockMatch = trimmed.match(/^```(\w*)\n([\s\S]*?)```$/);
  if (codeBlockMatch) {
    const lang = codeBlockMatch[1] ?? '';
    const code = codeBlockMatch[2]?.trim() ?? '';

    // Mermaid diagrams — render as interactive SVG
    if (lang === 'mermaid') {
      return (
        <Suspense
          key={key}
          fallback={
            <div className="bg-bg-elevated text-text-muted my-2 rounded-lg p-3 text-xs">
              Loading diagram…
            </div>
          }
        >
          <MermaidBlock code={code} blockKey={key} />
        </Suspense>
      );
    }

    return <HighlightedCodeBlock key={key} code={code} lang={lang} blockKey={key} />;
  }

  // Horizontal rule: --- or *** or ___
  if (/^[-*_]{3,}$/.test(trimmed)) {
    return <hr key={key} className="border-border my-2" />;
  }

  const lines = trimmed.split('\n');

  // Table: |...| rows with a |---|---| separator as the second line.
  // Must have at least 2 lines (header + separator), all lines must be | rows.
  if (lines.length >= 2 && lines.every((l) => /^\s*\|.*\|\s*$/.test(l))) {
    const sep = lines[1] ?? '';
    if (/^\s*\|[\s:|-]+\|\s*$/.test(sep)) {
      return renderTable(lines, key);
    }
  }

  // Blockquote: every line starts with > (optionally followed by a space)
  if (lines.every((l) => /^>\s?/.test(l))) {
    const inner = lines.map((l) => l.replace(/^>\s?/, '')).join('\n');
    return (
      <blockquote
        key={key}
        className="border-accent/40 text-text-muted my-2 border-l-2 pl-3 italic"
      >
        {/* Recurse so nested formatting inside the quote still works. */}
        {renderMarkdown(inner, true)}
      </blockquote>
    );
  }

  // Task list: - [ ] / - [x] (check BEFORE generic unordered list —
  // the `- ` prefix overlaps)
  if (lines.every((l) => /^[-*]\s\[[ xX]\]\s/.test(l.trim()))) {
    return (
      <ul key={key} className="my-1 space-y-0.5">
        {lines.map((line, j) => {
          const m = line.trim().match(/^[-*]\s\[([ xX])\]\s(.*)$/);
          const checked = (m?.[1] ?? ' ').toLowerCase() === 'x';
          const label = m?.[2] ?? '';
          return (
            <li key={j} className="flex items-start gap-2">
              {/* Display-only checkbox — chat UI is not an editable task manager. */}
              <input
                type="checkbox"
                checked={checked}
                readOnly
                aria-hidden="true"
                tabIndex={-1}
                className="accent-accent mt-1 cursor-default"
              />
              <span className={checked ? 'text-text-muted line-through' : undefined}>
                {renderInline(label)}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  // Heading: # ## ###
  if (lines.length === 1) {
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = (headingMatch[1] ?? '#').length;
      const content = headingMatch[2] ?? '';
      const cls = HEADING_CLASSES[level] ?? HEADING_CLASSES[3];
      if (level === 1)
        return (
          <h2 key={key} className={cls}>
            {renderInline(content)}
          </h2>
        );
      if (level === 2)
        return (
          <h3 key={key} className={cls}>
            {renderInline(content)}
          </h3>
        );
      return (
        <h4 key={key} className={cls}>
          {renderInline(content)}
        </h4>
      );
    }
  }

  // Unordered list: lines starting with - or *
  if (lines.every((l) => /^[-*]\s/.test(l.trim()))) {
    return (
      <ul key={key} className="my-1 list-inside list-disc space-y-0.5">
        {lines.map((line, j) => (
          <li key={j}>{renderInline(line.replace(/^[-*]\s/, ''))}</li>
        ))}
      </ul>
    );
  }

  // Ordered list: lines starting with 1. 2. etc.
  if (lines.every((l) => /^[0-9]+\.\s/.test(l.trim()))) {
    return (
      <ol key={key} className="my-1 list-inside list-decimal space-y-0.5">
        {lines.map((line, j) => (
          <li key={j}>{renderInline(line.replace(/^[0-9]+\.\s/, ''))}</li>
        ))}
      </ol>
    );
  }

  // Mixed block: may contain headings, list items, and paragraphs on separate lines
  // Render line-by-line for blocks that mix types
  if (lines.length > 1 && lines.some((l) => /^#{1,3}\s/.test(l.trim()))) {
    return <div key={key}>{lines.map((line, j) => renderBlock(line, j))}</div>;
  }

  // Regular paragraph
  return (
    <p key={key} className="my-1">
      {lines.map((line, j) => (
        <span key={j}>
          {j > 0 && <br />}
          {renderInline(line)}
        </span>
      ))}
    </p>
  );
}

/** Split a pipe-table row into trimmed cells (drop leading/trailing empties). */
function splitTableRow(line: string): string[] {
  const cells = line.split('|').map((c) => c.trim());
  // Leading/trailing `|` produce empty strings at the edges — drop them.
  if (cells.length > 0 && cells[0] === '') cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

/** Render a markdown pipe table. `lines` is [header, separator, ...body]. */
function renderTable(lines: string[], key: number): ReactNode {
  const header = splitTableRow(lines[0] ?? '');
  const body = lines.slice(2).map(splitTableRow);

  return (
    <div key={key} className="scrollbar-thin my-2 overflow-x-auto">
      <table className="border-border w-full border-collapse text-xs">
        <thead>
          <tr className="border-border border-b">
            {header.map((cell, j) => (
              <th key={j} className="px-2 py-1 text-left font-semibold">
                {renderInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i} className="border-border/50 border-b last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1 align-top">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Render inline markdown: bold, italic, code, links, citations, bare URLs. */
function renderInline(text: string): ReactNode {
  // Split on inline patterns, preserving delimiters
  const parts: ReactNode[] = [];
  // Groups: 2=bold, 3=italic, 4=code, 5=citation-num, 6=citation-url, 7=link-text, 8=link-url, 9=bare-url
  // Bare URL stops at whitespace or common trailing punctuation so sentence-final
  // periods/commas don't become part of the href.
  const regex =
    /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[\[(\d+)\]\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/[^\s<>)\]]+[^\s<>)\].,;:!?]))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // **bold**
      parts.push(
        <strong key={match.index} className="font-semibold">
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      // *italic*
      parts.push(
        <em key={match.index} className="italic">
          {match[3]}
        </em>,
      );
    } else if (match[4]) {
      // `code`
      parts.push(
        <code key={match.index} className="bg-bg-elevated rounded px-1 py-0.5 text-xs">
          {match[4]}
        </code>,
      );
    } else if (match[5] && match[6]) {
      // [[n]](url) — web search citation, render as superscript link
      parts.push(
        <sup key={match.index}>
          <a
            href={match[6]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            [{match[5]}]
          </a>
        </sup>,
      );
    } else if (match[7] && match[8]) {
      // [text](url)
      parts.push(
        <a
          key={match.index}
          href={match[8]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          {match[7]}
        </a>,
      );
    } else if (match[9]) {
      // Bare URL — auto-link. Obsidian does this; so do we.
      parts.push(
        <a
          key={match.index}
          href={match[9]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent break-all hover:underline"
        >
          {match[9]}
        </a>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : parts;
}
