/**
 * Lightweight markdown renderer for Cybernus AI chat responses.
 *
 * Supports: headings, **bold**, *italic*, `inline code`, ```code blocks```
 * (with syntax highlighting), [links](url), lists, horizontal rules,
 * paragraphs, Mermaid diagrams, [[Wikilinks]], > [!callouts], and tables.
 */
import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';

const MermaidBlock = lazy(() => import('@components/widgets/MermaidBlock'));

const HEADING_CLASSES: Record<number, string> = {
  1: 'text-base font-bold mt-3 mb-1',
  2: 'text-sm font-bold mt-2.5 mb-1',
  3: 'text-sm font-semibold mt-2 mb-0.5',
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
    if (match.index > lastIndex) {
      elements.push(code.slice(lastIndex, match.index));
    }

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

  if (lastIndex < code.length) {
    elements.push(code.slice(lastIndex));
  }

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

/* ── Callout support (Obsidian format) ── */

const CALLOUT_STYLES: Record<string, { border: string; bg: string; icon: string; label: string }> =
  {
    note: { border: 'border-blue-500/40', bg: 'bg-blue-500/10', icon: 'i', label: 'Note' },
    info: { border: 'border-cyan-500/40', bg: 'bg-cyan-500/10', icon: 'i', label: 'Info' },
    tip: { border: 'border-green-500/40', bg: 'bg-green-500/10', icon: '💡', label: 'Tip' },
    warning: {
      border: 'border-yellow-500/40',
      bg: 'bg-yellow-500/10',
      icon: '⚠',
      label: 'Warning',
    },
    danger: { border: 'border-red-500/40', bg: 'bg-red-500/10', icon: '🔴', label: 'Danger' },
    error: { border: 'border-red-500/40', bg: 'bg-red-500/10', icon: '✗', label: 'Error' },
    success: { border: 'border-green-500/40', bg: 'bg-green-500/10', icon: '✓', label: 'Success' },
    example: {
      border: 'border-purple-500/40',
      bg: 'bg-purple-500/10',
      icon: '📋',
      label: 'Example',
    },
    quote: { border: 'border-gray-500/40', bg: 'bg-gray-500/10', icon: '"', label: 'Quote' },
  };

const DEFAULT_CALLOUT_STYLE = {
  border: 'border-blue-500/40',
  bg: 'bg-blue-500/10',
  icon: 'ℹ️',
  label: 'Note',
};

function renderCallout(type: string, content: string, key: number): ReactNode {
  const style = CALLOUT_STYLES[type.toLowerCase()] ?? DEFAULT_CALLOUT_STYLE;
  return (
    <div key={key} className={`my-2 rounded-lg border-l-4 ${style.border} ${style.bg} px-4 py-3`}>
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase opacity-80">
        <span>{style.icon}</span>
        <span>{style.label}</span>
      </div>
      <div className="text-sm leading-relaxed">{renderInline(content)}</div>
    </div>
  );
}

/* ── Table support ── */

function renderTable(lines: string[], key: number): ReactNode {
  const rows = lines.map((line) => {
    const cells = line.split('|').map((cell) => cell.trim());
    // Remove leading/trailing empty strings from pipe-delimited lines
    if (cells[0] === '') cells.shift();
    if (cells[cells.length - 1] === '') cells.pop();
    return cells;
  });

  if (rows.length < 2) return null;

  const headerRow = rows[0] ?? [];
  const separatorRow = rows[1] ?? [];
  const bodyRows = rows.slice(2);

  // Parse alignment from separator row
  const alignments = separatorRow.map((cell) => {
    const trimmed = cell.replace(/\s/g, '');
    if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center' as const;
    if (trimmed.endsWith(':')) return 'right' as const;
    return 'left' as const;
  });

  return (
    <div key={key} className="scrollbar-thin my-2 overflow-x-auto">
      <table className="border-border w-full border-collapse text-sm">
        <thead>
          <tr className="border-border border-b">
            {headerRow.map((cell, i) => (
              <th
                key={i}
                className="text-text-primary bg-bg-elevated px-3 py-2 text-left font-semibold"
                style={{ textAlign: alignments[i] ?? 'left' }}
              >
                {renderInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, i) => (
            <tr key={i} className="border-border border-b last:border-b-0">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="text-text-secondary px-3 py-2"
                  style={{ textAlign: alignments[j] ?? 'left' }}
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

/* ── Markdown Cache ── */

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

/** Split text into blocks while keeping fenced code blocks intact. */
function splitBlocks(text: string): string[] {
  const blocks: string[] = [];
  const lines = text.split('\n');
  let current: string[] = [];
  let inCodeBlock = false;

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

/** Render a single block. */
function renderBlock(block: string, key: number): ReactNode {
  const trimmed = block.trim();
  if (!trimmed) return null;

  // Code block: ```lang\n...\n```
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

  // Horizontal rule
  if (/^[-*_]{3,}$/.test(trimmed)) {
    return <hr key={key} className="border-border my-2" />;
  }

  const lines = trimmed.split('\n');

  // Callout: > [!type] content
  const calloutMatch = trimmed.match(/^>\s*\[!(\w+)\]\s*([\s\S]*)$/);
  if (calloutMatch) {
    const type = calloutMatch[1] ?? 'note';
    const content = (calloutMatch[2] ?? '').replace(/^>\s?/gm, '').trim();
    return renderCallout(type, content, key);
  }

  // Blockquote that might contain a callout across lines
  if (lines.every((l) => l.startsWith('> ') || l === '>')) {
    const inner = lines.map((l) => l.replace(/^>\s?/, '')).join('\n');
    const innerCallout = inner.match(/^\[!(\w+)\]\s*([\s\S]*)$/);
    if (innerCallout) {
      return renderCallout(innerCallout[1] ?? 'note', (innerCallout[2] ?? '').trim(), key);
    }
    // Regular blockquote
    return (
      <blockquote key={key} className="border-border my-2 border-l-4 pl-4 italic opacity-80">
        {renderInline(inner)}
      </blockquote>
    );
  }

  // Table: lines with | separators, second line is separator row
  if (
    lines.length >= 3 &&
    (lines[0] ?? '').includes('|') &&
    (lines[1] ?? '').includes('|') &&
    /^[\s|:-]+$/.test(lines[1] ?? '')
  ) {
    return renderTable(lines, key);
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
      // [[n]](url) — web search citation
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
      // [[Wikilink]] — render as a styled internal reference
      const pageName = match[9];
      parts.push(
        <span
          key={match.index}
          className="text-accent border-accent/30 cursor-help border-b border-dashed"
          title={`Reference: ${pageName}`}
        >
          {pageName}
        </span>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : parts;
}
