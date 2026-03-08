/**
 * ThinkingIndicator — shown while Grok 4 is reasoning, before the
 * first output token arrives.
 *
 * Grok 4's actual reasoning content is encrypted by xAI (not exposed to
 * clients), so we can't show the chain-of-thought. What we CAN show is
 * the live reasoning-token count from `usage.output_tokens_details`,
 * which arrives via `response.in_progress` events during the stream.
 *
 * Three bouncing dots + a live counter. Simple, honest, no fake
 * "I'm thinking about X" theatre.
 */

import { memo } from 'react';

interface ThinkingIndicatorProps {
  /** Live reasoning-token count. Undefined until the first usage snapshot. */
  reasoningTokens?: number;
  /** Active tool activity labels (e.g. "Web search", "Python", "MCP · deepwiki"). */
  toolActivity?: readonly string[];
}

export const ThinkingIndicator = memo(function ThinkingIndicator({
  reasoningTokens,
  toolActivity,
}: ThinkingIndicatorProps) {
  const hasTools = toolActivity !== undefined && toolActivity.length > 0;

  return (
    <div className="text-text-muted flex flex-wrap items-center gap-3 text-xs" aria-live="polite">
      {/* Bouncing dots — the .cybernus-think-dot class staggers them. */}
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

      {/* Tool chips — show what's actually running right now. */}
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
