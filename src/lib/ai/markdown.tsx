/**
 * Lightweight markdown renderer for AI chat responses.
 *
 * Supports: headings (# ## ###), **bold**, *italic*, `inline code`,
 * ```code blocks``` (with syntax highlighting), [links](url),
 * unordered lists (- item), ordered lists (1. item), horizontal
 * rules (---), and paragraphs.
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

/** Render a markdown string as React elements. */
export function renderMarkdown(text: string): ReactNode {
  if (!text) return null;

  // Split into blocks, but preserve code blocks as single units
  const blocks = splitBlocks(text);
  return blocks.map((block, i) => renderBlock(block, i));
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

/** Render inline markdown: bold, italic, code, links, citations. */
function renderInline(text: string): ReactNode {
  // Split on inline patterns, preserving delimiters
  const parts: ReactNode[] = [];
  // Groups: 2=bold, 3=italic, 4=code, 5=citation-num, 6=citation-url, 7=link-text, 8=link-url
  const regex =
    /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[\[(\d+)\]\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\))/g;

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
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : parts;
}
