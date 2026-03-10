/**
 * Lightweight markdown renderer for Cybernus AI chat responses.
 *
 * Supports: headings, **bold**, *italic*, `inline code`, ```code blocks```
 * (with syntax highlighting), [links](url), lists, horizontal rules,
 * paragraphs, Mermaid diagrams, [[Wikilinks]], > [!callouts], and tables.
 */
import { lazy, Suspense, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

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
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        /* clipboard access denied — silently ignore */
      },
    );
  }, [code]);

  return (
    <div key={blockKey} className="group/code relative my-2">
      {/* Language badge + copy button */}
      <div className="absolute top-0 right-0 z-10 flex items-center gap-1 rounded-tr-lg rounded-bl-lg bg-black/40 px-2 py-1 opacity-0 backdrop-blur-sm transition-opacity group-hover/code:opacity-100">
        {lang && (
          <span className="text-[9px] font-medium tracking-wider text-white/30 uppercase">
            {lang}
          </span>
        )}
        <button
          onClick={handleCopy}
          className="flex h-5 w-5 items-center justify-center rounded text-white/40 transition-colors hover:text-white/70"
          aria-label="Copy code"
          title="Copy"
        >
          {copied ? (
            <svg
              className="h-3 w-3 text-[#00ff41]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              className="h-3 w-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
      <pre className="bg-bg-elevated scrollbar-thin overflow-x-auto rounded-lg p-3 text-xs">
        <code>{highlightCode(code, lang)}</code>
      </pre>
    </div>
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

  // Video block: <video>url|alt</video>
  const videoBlockMatch = trimmed.match(/^<video>([^|]+)\|?(.*)<\/video>$/);
  if (videoBlockMatch) {
    const videoUrl = videoBlockMatch[1] ?? '';
    const videoAlt = videoBlockMatch[2] ?? 'Generated video';
    return <VideoPlayer key={key} src={videoUrl} alt={videoAlt} />;
  }

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

/** Render inline markdown: bold, italic, code, links, images, citations, wikilinks. */
function renderInline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  // Groups: 2=img-alt, 3=img-url, 4=bold, 5=italic, 6=code, 7=citation-num, 8=citation-url, 9=link-text, 10=link-url, 11=wikilink
  const regex =
    /(!\[([^\]]*)\]\(([^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[\[(\d+)\]\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|\[\[([^\]]+)\]\])/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2] !== undefined && match[3]) {
      // ![alt](url) — inline image with lightbox
      parts.push(
        <ChatImage key={match.index} src={match[3]} alt={match[2] || 'Generated image'} />,
      );
    } else if (match[4]) {
      // **bold**
      parts.push(
        <strong key={match.index} className="font-semibold">
          {match[4]}
        </strong>,
      );
    } else if (match[5]) {
      // *italic*
      parts.push(
        <em key={match.index} className="italic">
          {match[5]}
        </em>,
      );
    } else if (match[6]) {
      // `code`
      parts.push(
        <code key={match.index} className="bg-bg-elevated rounded px-1 py-0.5 text-xs">
          {match[6]}
        </code>,
      );
    } else if (match[7] && match[8]) {
      // [[n]](url) — web search citation
      parts.push(
        <sup key={match.index}>
          <a
            href={match[8]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            [{match[7]}]
          </a>
        </sup>,
      );
    } else if (match[9] && match[10]) {
      // [text](url)
      parts.push(
        <a
          key={match.index}
          href={match[10]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          {match[9]}
        </a>,
      );
    } else if (match[11]) {
      // [[Wikilink]] — render as a styled internal reference
      const pageName = match[11];
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

/* ── Media Components ── */

/** Inline image with click-to-expand lightbox. */
function ChatImage({ src, alt }: { src: string; alt: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const handleClose = useCallback(() => setIsOpen(false), []);

  if (error) {
    return (
      <span className="bg-bg-elevated my-3 flex h-48 w-full items-center justify-center rounded-xl border border-red-500/20">
        <span className="text-text-muted text-sm">Image failed to load</span>
      </span>
    );
  }

  return (
    <>
      <span className="group/img relative my-3 block">
        {/* Skeleton placeholder — shown while image loads */}
        {!loaded && (
          <span className="bg-bg-elevated flex h-48 w-full animate-pulse items-center justify-center rounded-xl">
            <span className="text-text-muted text-xs">Loading image...</span>
          </span>
        )}
        {/* Image button — rendered in the DOM always so the browser loads the src.
            Use opacity-0 + h-0 overflow-hidden instead of display:none so
            the <img> fires onLoad even before it's visible. */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`block w-full cursor-zoom-in border-0 bg-transparent p-0 transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'pointer-events-none absolute h-0 overflow-hidden opacity-0'
          }`}
          aria-label={`Expand image: ${alt}`}
          tabIndex={loaded ? 0 : -1}
        >
          <img
            src={src}
            alt={alt}
            className="max-w-full rounded-xl border border-[#00ff41]/15 shadow-lg shadow-black/20 transition-all duration-200 hover:border-[#00ff41]/30 hover:shadow-[#00ff41]/10"
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
        </button>
        {loaded && (
          <span className="pointer-events-none absolute right-2 bottom-2 flex items-center gap-1.5 rounded-lg bg-black/60 px-2 py-1 text-[10px] text-white/0 opacity-0 backdrop-blur-sm transition-all group-hover/img:text-white/60 group-hover/img:opacity-100">
            Click to expand
          </span>
        )}
      </span>

      {/* Lightbox overlay */}
      {isOpen &&
        createPortal(<ImageLightbox src={src} alt={alt} onClose={handleClose} />, document.body)}
    </>
  );
}

/** Fullscreen image lightbox. */
function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- lightbox backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
        aria-label="Close"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- prevent close on image click */}
      <img
        src={src}
        alt={alt}
        className="max-h-[85vh] max-w-[92vw] rounded-xl object-contain shadow-2xl sm:max-h-[90vh] sm:max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

/** Inline video player with native controls. */
function VideoPlayer({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="bg-bg-elevated my-3 flex h-48 items-center justify-center rounded-xl border border-red-500/20">
        <span className="text-text-muted text-sm">Video failed to load</span>
      </div>
    );
  }

  return (
    <div className="group/vid relative my-3">
      {!loaded && (
        <div className="bg-bg-elevated flex h-48 w-full animate-pulse items-center justify-center rounded-xl">
          <div className="flex flex-col items-center gap-2">
            <svg className="h-8 w-8 animate-spin text-[#00ff41]/50" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-text-muted text-xs">Loading video...</span>
          </div>
        </div>
      )}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- alt provided via aria-label */}
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        className={`w-full max-w-full rounded-xl border border-[#00ff41]/15 shadow-lg shadow-black/20 transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'pointer-events-none absolute h-0 overflow-hidden opacity-0'
        }`}
        onLoadedData={() => setLoaded(true)}
        onError={() => setError(true)}
        aria-label={alt}
      />
    </div>
  );
}
