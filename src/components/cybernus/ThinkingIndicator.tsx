/**
 * ThinkingIndicator — shown while Grok 4 is reasoning.
 */

import { memo } from 'react';

interface ThinkingIndicatorProps {
  reasoningTokens?: number;
  toolActivity?: readonly string[];
}

export const ThinkingIndicator = memo(function ThinkingIndicator({
  reasoningTokens,
  toolActivity,
}: ThinkingIndicatorProps) {
  const hasTools = toolActivity !== undefined && toolActivity.length > 0;

  return (
    <div className="text-text-muted flex flex-wrap items-center gap-3 text-xs" aria-live="polite">
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="cybernus-think-dot bg-accent h-1.5 w-1.5 rounded-full" />
        <span className="cybernus-think-dot bg-accent h-1.5 w-1.5 rounded-full" />
        <span className="cybernus-think-dot bg-accent h-1.5 w-1.5 rounded-full" />
      </span>

      <span className="font-mono">
        {hasTools ? 'Running tools' : 'Thinking'}
        {reasoningTokens !== undefined && reasoningTokens > 0 && (
          <>
            {' · '}
            <span className="text-accent tabular-nums">{reasoningTokens.toLocaleString()}</span>
            {' reasoning tokens'}
          </>
        )}
      </span>

      {hasTools && (
        <span className="flex flex-wrap gap-1.5">
          {toolActivity.map((label, i) => (
            <span
              key={`${label}-${i}`}
              className="border-accent/30 bg-accent/10 text-accent rounded-full border px-2 py-0.5 font-mono text-[10px]"
            >
              {label}
            </span>
          ))}
        </span>
      )}
    </div>
  );
});
