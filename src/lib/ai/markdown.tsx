/**
 * Enhanced markdown renderer for Cybernus chat responses.
 *
 * Supports:
 * - Headings (# ## ###)
 * - **bold**, *italic*, `inline code`
 * - ```code blocks``` with syntax highlighting
 * - [links](url), [[n]](url) citations
 * - Unordered lists (- item), ordered lists (1. item)
 * - Horizontal rules (---)
 * - Mermaid diagrams (```mermaid)
 * - Obsidian callouts (> [!note], > [!warning], > [!tip])
 * - Wikilinks ([[Page Name]])
 * - Markdown tables (| col | col |)
 * - Paragraphs
 *
 * No external dependencies — keeps the bundle small.
 */
import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';

const MermaidBlock = lazy(() => import('@components/widgets/MermaidBlock'));

const HEADING_CLASSES: Record<number, string> = {
  1: 'text-base font-bold mt-3 mb-1',
  2: 'text-sm font-bold mt-2.5 mb-1',
  3: 'text-sm font-semibold mt-2 mb-0.5',
};

/* ── Callout type styling ── */
const CALLOUT_STYLES: Record<string, { icon: string; borderColor: string; bgColor: string }> = {
  note: { icon: '📝', borderColor: 'border-blue-500/40', bgColor: 'bg-blue-500/10' },
  info: { icon: 'ℹ️', borderColor: 'border-blue-500/40', bgColor: 'bg-blue-500/10' },
  tip: { icon: '💡', borderColor: 'border-green-500/40', bgColor: 'bg-green-500/10' },
  warning: { icon: '⚠️', borderColor: 'border-yellow-500/40', bgColor: 'bg-yellow-500/10' },
  danger: { icon: '🔴', borderColor: 'border-red-500/40', bgColor: 'bg-red-500/10' },
  example: { icon: '📋', borderColor: 'border-purple-500/40', bgColor: 'bg-purple-500/10' },
  quote: { icon: '💬', borderColor: 'border-gray-500/40', bgColor: 'bg-gray-500/10' },
  success: { icon: '🟢', borderColor: 'border-green-500/40', bgColor: 'bg-green-500/10' },
};

/* ── Minimal keyword-based syntax highlighter ── */

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
  if (!keywords) return [code];

  const elements: ReactNode[] = [];
  const tokenRegex =
    /(#[^\n]*|\/\/[^\n]*|\/\*[\s\S]*?\*\/|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b[0-9]+(?:\.[0-9]+)?\b|@\w+|\b[a-zA-Z_]\w*\b)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenRegex.exec(code)) !== null) {
    if (match.index > lastIndex) elements.push(code.slice(lastIndex, match.index));
    const token = match[0];
    const ch = token[0] ?? '';

    if (ch === '#' || token.startsWith('//') || token.startsWith('/*')) {
      elements.push(
        <span key={key++} className="text-text-muted italic">
          {token}
        </span>,
      );
    } else if (ch === '"' || ch === "'" || ch === '`') {
      elements.push(
        <span key={key++} className="text-status-warning">
          {token}
        </span>,
      );
    } else if (ch === '@') {
      elements.push(
        <span key={key++} className="text-accent">
          {token}
        </span>,
      );
    } else if (/^[0-9]/.test(ch)) {
      elements.push(
        <span key={key++} className="text-accent">
          {token}
        </span>,
      );
    } else if (keywords.has(token)) {
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

  if (lastIndex < code.length) elements.push(code.slice(lastIndex));
  return elements;
}

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

/** LRU-ish cache for rendered markdown. */
const markdownCache = new Map<string, ReactNode>();
const MAX_CACHE_SIZE = 100;

/**
 * Render a markdown string as React elements (memoized).
 */
export function renderMarkdown(text: string, skipCache = false): ReactNode {
  if (!text) return null;

  const cached = markdownCache.get(text);
  if (cached !== undefined) return cached;

  const blocks = splitBlocks(text);
  const result = blocks.map((block, i) => renderBlock(block, i));

  if (!skipCache) {
    if (markdownCache.size >= MAX_CACHE_SIZE) {
      const firstKey = markdownCache.keys().next().value;
      if (firstKey !== undefined) markdownCache.delete(firstKey);
    }
    markdownCache.set(text, result);
  }
  return result;
}

/** Split text into blocks while keeping fenced code blocks and callouts intact. */
function splitBlocks(text: string): string[] {
  const blocks: string[] = [];
  const lines = text.split('\n');
  let current: string[] = [];
  let inCodeBlock = false;
  let inCallout = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        current.push(line);
        blocks.push(current.join('\n'));
        current = [];
        inCodeBlock = false;
      } else {
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
    } else if (/^>\s*\[!(\w+)\]/.test(line.trim())) {
      // Start of callout — flush current
      if (current.length > 0) {
        const joined = current.join('\n').trim();
        if (joined) blocks.push(joined);
        current = [];
      }
      current.push(line);
      inCallout = true;
    } else if (inCallout && /^>\s/.test(line)) {
      current.push(line);
    } else if (inCallout) {
      // End of callout
      const joined = current.join('\n').trim();
      if (joined) blocks.push(joined);
      current = [];
      inCallout = false;
      if (line.trim()) current.push(line);
    } else if (line.trim() === '') {
      if (current.length > 0) {
        const joined = current.join('\n').trim();
        if (joined) blocks.push(joined);
        current = [];
      }
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    const joined = current.join('\n').trim();
    if (joined) blocks.push(joined);
  }

  return blocks;
}

/** Detect if a block is a markdown table. */
function isTable(lines: string[]): boolean {
  if (lines.length < 2) return false;
  const hasHeaderSep = lines[1] !== undefined && /^\|[\s:|-]+\|$/.test(lines[1].trim());
  const allPipeLines = lines.every((l) => l.trim().startsWith('|') && l.trim().endsWith('|'));
  return hasHeaderSep && allPipeLines;
}

/** Render a markdown table. */
function renderTable(lines: string[], key: number): ReactNode {
  const parseRow = (line: string): string[] =>
    line
      .trim()
      .slice(1, -1)
      .split('|')
      .map((c) => c.trim());

  const headers = lines[0] ? parseRow(lines[0]) : [];
  // lines[1] is the separator row, skip it
  const alignments = lines[1]
    ? parseRow(lines[1]).map((c) => {
        if (c.startsWith(':') && c.endsWith(':')) return 'center' as const;
        if (c.endsWith(':')) return 'right' as const;
        return 'left' as const;
      })
    : [];

  const rows = lines.slice(2).map(parseRow);

  return (
    <div key={key} className="my-2 overflow-x-auto">
      <table className="border-border w-full border-collapse text-xs">
        <thead>
          <tr className="border-border border-b">
            {headers.map((h, i) => (
              <th
                key={i}
                className="text-text-primary px-3 py-1.5 text-left font-semibold"
                style={{ textAlign: alignments[i] ?? 'left' }}
              >
                {renderInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-border border-b last:border-0">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="text-text-secondary px-3 py-1.5"
                  style={{ textAlign: alignments[ci] ?? 'left' }}
                >
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

/** Render an Obsidian-style callout block. */
function renderCallout(block: string, key: number): ReactNode {
  const lines = block.split('\n');
  const headerMatch = lines[0]?.match(/^>\s*\[!(\w+)\]\s*(.*)/);
  if (!headerMatch) return null;

  const calloutType = headerMatch[1]?.toLowerCase() ?? 'note';
  const title = headerMatch[2] || calloutType.charAt(0).toUpperCase() + calloutType.slice(1);
  const style = CALLOUT_STYLES[calloutType] ?? CALLOUT_STYLES.note;
  if (!style) return null;

  const content = lines
    .slice(1)
    .map((l) => l.replace(/^>\s?/, ''))
    .join('\n')
    .trim();

  return (
    <div
      key={key}
      className={`my-2 rounded-lg border-l-4 px-4 py-2.5 ${style.borderColor} ${style.bgColor}`}
    >
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
        <span>{style.icon}</span>
        <span>{title}</span>
      </div>
      {content && (
        <div className="text-text-secondary text-xs leading-relaxed">{renderInline(content)}</div>
      )}
    </div>
  );
}

/** Render a single block. */
function renderBlock(block: string, key: number): ReactNode {
  const trimmed = block.trim();
  if (!trimmed) return null;

  // Code block
  const codeBlockMatch = trimmed.match(/^```(\w*)\n([\s\S]*?)```$/);
  if (codeBlockMatch) {
    const lang = codeBlockMatch[1] ?? '';
    const code = codeBlockMatch[2]?.trim() ?? '';

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

  // Callout: > [!type] title
  if (/^>\s*\[!\w+\]/.test(trimmed)) {
    return renderCallout(trimmed, key);
  }

  // Horizontal rule
  if (/^[-*_]{3,}$/.test(trimmed)) {
    return <hr key={key} className="border-border my-2" />;
  }

  const lines = trimmed.split('\n');

  // Table
  if (isTable(lines)) {
    return renderTable(lines, key);
  }

  // Heading
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

  // Unordered list
  if (lines.every((l) => /^[-*]\s/.test(l.trim()))) {
    return (
      <ul key={key} className="my-1 list-inside list-disc space-y-0.5">
        {lines.map((line, j) => (
          <li key={j}>{renderInline(line.replace(/^[-*]\s/, ''))}</li>
        ))}
      </ul>
    );
  }

  // Ordered list
  if (lines.every((l) => /^[0-9]+\.\s/.test(l.trim()))) {
    return (
      <ol key={key} className="my-1 list-inside list-decimal space-y-0.5">
        {lines.map((line, j) => (
          <li key={j}>{renderInline(line.replace(/^[0-9]+\.\s/, ''))}</li>
        ))}
      </ol>
    );
  }

  // Mixed block with headings
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

/** Render inline markdown: bold, italic, code, links, citations, wikilinks. */
function renderInline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  // Groups: 2=bold, 3=italic, 4=code, 5=citation-num, 6=citation-url, 7=link-text, 8=link-url, 9=wikilink
  const regex =
    /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[\[(\d+)\]\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|\[\[([^\]]+)\]\])/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));

    if (match[2]) {
      parts.push(
        <strong key={match.index} className="font-semibold">
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      parts.push(
        <em key={match.index} className="italic">
          {match[3]}
        </em>,
      );
    } else if (match[4]) {
      parts.push(
        <code key={match.index} className="bg-bg-elevated rounded px-1 py-0.5 text-xs">
          {match[4]}
        </code>,
      );
    } else if (match[5] && match[6]) {
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
      // Wikilink [[Page Name]] — render as styled inline reference
      parts.push(
        <span
          key={match.index}
          className="text-accent border-accent/30 inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-xs font-medium"
        >
          {match[9]}
        </span>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length === 1 ? parts[0] : parts;
}
