/**
 * Lightweight markdown renderer for AI chat responses.
 *
 * Supports: **bold**, *italic*, `inline code`, ```code blocks```,
 * [links](url), unordered lists (- item), and paragraphs.
 * No external dependencies — keeps the bundle small.
 */
import type { ReactNode } from 'react';

/** Render a markdown string as React elements. */
export function renderMarkdown(text: string): ReactNode {
  if (!text) return null;

  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    // Code block: ```...```
    const codeBlockMatch = trimmed.match(/^```[\s\S]*?\n([\s\S]*?)```$/);
    if (codeBlockMatch) {
      return (
        <pre
          key={i}
          className="bg-bg-elevated scrollbar-thin my-2 overflow-x-auto rounded-lg p-3 text-xs"
        >
          <code>{codeBlockMatch[1]?.trim()}</code>
        </pre>
      );
    }

    // Unordered list: lines starting with - or *
    const lines = trimmed.split('\n');
    if (lines.every((l) => /^[-*]\s/.test(l.trim()))) {
      return (
        <ul key={i} className="my-1 list-inside list-disc space-y-0.5">
          {lines.map((line, j) => (
            <li key={j}>{renderInline(line.replace(/^[-*]\s/, ''))}</li>
          ))}
        </ul>
      );
    }

    // Regular paragraph (may contain multiple lines)
    return (
      <p key={i} className="my-1">
        {lines.map((line, j) => (
          <span key={j}>
            {j > 0 && <br />}
            {renderInline(line)}
          </span>
        ))}
      </p>
    );
  });
}

/** Render inline markdown: bold, italic, code, links. */
function renderInline(text: string): ReactNode {
  // Split on inline patterns, preserving delimiters
  const parts: ReactNode[] = [];
  // Combined regex for: **bold**, *italic*, `code`, [text](url)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;

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
      // [text](url)
      parts.push(
        <a
          key={match.index}
          href={match[6]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          {match[5]}
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
