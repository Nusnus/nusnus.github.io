/**
 * Right-rail metadata panel — model info, spectrum slider, suggested prompts.
 * Desktop only; on mobile these collapse into a bottom sheet toggled from the
 * header.
 */

import { memo } from 'react';
import { Cpu, Sparkles, Zap } from 'lucide-react';
import { MODEL_META, SUGGESTED_QUESTIONS } from '@lib/ai/config';
import { getNotch } from '@lib/ai/spectrum';
import { SpectrumSlider } from './SpectrumSlider';

interface MetadataPanelProps {
  spectrumIndex: number;
  onSpectrumChange: (index: number) => void;
  lastReasoningTokens: number;
  isGenerating: boolean;
  onSendMessage: (text: string) => void;
}

export const MetadataPanel = memo(function MetadataPanel({
  spectrumIndex,
  onSpectrumChange,
  lastReasoningTokens,
  isGenerating,
  onSendMessage,
}: MetadataPanelProps) {
  const activeNotch = getNotch(spectrumIndex);

  return (
    <div className="scrollbar-thin flex h-full flex-col gap-5 overflow-y-auto p-4">
      {/* ── Spectrum slider ── */}
      <section>
        <h3 className="text-text-secondary mb-4 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase">
          <Zap className="size-3.5" />
          Personality Dial
        </h3>
        <SpectrumSlider value={spectrumIndex} onChange={onSpectrumChange} />
        <p className="text-text-tertiary mt-3 text-[10px] leading-relaxed">
          temp={activeNotch.temperature} · Applies to the next message.
        </p>
      </section>

      <div className="border-border border-t" />

      {/* ── Model card ── */}
      <section>
        <h3 className="text-text-secondary mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase">
          <Cpu className="size-3.5" />
          Model
        </h3>
        <div className="bg-bg-surface border-border rounded-lg border p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-text-primary text-sm font-semibold">{MODEL_META.name}</span>
            <span className="text-text-tertiary text-[10px]">{MODEL_META.vendor}</span>
          </div>
          <code className="text-text-tertiary text-[10px]">{MODEL_META.id}</code>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <dt className="text-text-tertiary">Context</dt>
            <dd className="text-text-secondary text-right">{MODEL_META.contextWindow}</dd>
            <dt className="text-text-tertiary">Reasoning</dt>
            <dd className="text-text-secondary text-right">{MODEL_META.reasoning}</dd>
            {lastReasoningTokens > 0 && (
              <>
                <dt className="text-text-tertiary">Last think</dt>
                <dd className="text-accent text-right font-mono">
                  {lastReasoningTokens.toLocaleString()} tok
                </dd>
              </>
            )}
          </dl>
          <div className="mt-2 flex flex-wrap gap-1">
            {MODEL_META.capabilities.map((c) => (
              <span
                key={c}
                className="bg-accent/10 text-accent rounded px-1.5 py-0.5 text-[9px] font-medium"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="border-border border-t" />

      {/* ── Suggested prompts ── */}
      <section className="flex-1">
        <h3 className="text-text-secondary mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase">
          <Sparkles className="size-3.5" />
          Try Asking
        </h3>
        <div className="space-y-1.5">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => onSendMessage(q)}
              disabled={isGenerating}
              className="bg-bg-surface hover:bg-bg-elevated border-border text-text-secondary hover:text-text-primary block w-full rounded-lg border px-3 py-2 text-left text-xs leading-relaxed transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
});
