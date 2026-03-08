/**
 * CybernusThinking — reasoning-mode indicator.
 *
 * Shown inside the assistant bubble while Grok is in its chain-of-thought
 * phase (before visible content streams). xAI redacts the actual reasoning
 * trace, so this is a visual heartbeat rather than a text viewer.
 */

import { Brain } from 'lucide-react';
import { getStrings, type ChatLanguage } from '@lib/ai/config';

interface CybernusThinkingProps {
  language: ChatLanguage;
}

export function CybernusThinking({ language }: CybernusThinkingProps) {
  const strings = getStrings(language);

  return (
    <span className="text-accent inline-flex items-center gap-2 font-mono text-xs">
      <span className="think-pulse inline-flex">
        <Brain className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="tracking-wide">{strings.thinking}</span>
      <span className="inline-flex gap-0.5" aria-hidden="true">
        <span className="bg-accent inline-block h-1 w-1 animate-bounce rounded-full" />
        <span className="bg-accent inline-block h-1 w-1 animate-bounce rounded-full [animation-delay:120ms]" />
        <span className="bg-accent inline-block h-1 w-1 animate-bounce rounded-full [animation-delay:240ms]" />
      </span>
    </span>
  );
}
