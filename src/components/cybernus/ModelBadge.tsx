/**
 * ModelBadge — small chip showing which model Cybernus runs on.
 *
 * Expands into a tooltip-panel on hover/tap with context window and
 * capability list. Purely informational — no interaction beyond
 * disclosure.
 */

import { memo, useState } from 'react';

import { CYBERNUS_MODEL } from '@lib/ai/config';
import { cn } from '@lib/utils/cn';

export const ModelBadge = memo(function ModelBadge() {
  const [open, setOpen] = useState(false);
  const m = CYBERNUS_MODEL;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-label={`Model: ${m.name} ${m.variant}. Click for details.`}
        className={cn(
          'border-border bg-bg-surface hover:border-accent/50 flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors',
          open && 'border-accent/50',
        )}
      >
        <span className="bg-accent h-1.5 w-1.5 rounded-full" />
        <span className="text-text-secondary">{m.name}</span>
        <span className="text-accent">{m.variant}</span>
      </button>

      {open && (
        <div
          role="tooltip"
          className="border-border bg-bg-surface absolute top-full right-0 z-20 mt-2 w-56 rounded-lg border p-3 text-xs shadow-lg"
        >
          <div className="text-text-primary mb-1 font-semibold">{m.id}</div>
          <div className="text-text-muted mb-2">
            {m.provider} · {m.contextWindow} context
          </div>
          <ul className="space-y-0.5">
            {m.capabilities.map((cap) => (
              <li key={cap} className="text-text-secondary flex items-center gap-1.5">
                <span className="text-accent" aria-hidden="true">
                  ▸
                </span>
                {cap}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});
