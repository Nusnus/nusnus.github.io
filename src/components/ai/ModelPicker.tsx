import { Sparkles } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import type { Language } from '@lib/ai/i18n';
import { t } from '@lib/ai/i18n';

interface ModelPickerProps {
  selectedCloudModelId: string;
  setSelectedCloudModelId: (id: string) => void;
  hasSavedChat: boolean;
  onContinue: () => void;
  onNewChat: () => void;
  language: Language;
}

/** Cybernus launch screen — single model, Matrix-themed entry point. */
export function ModelPicker({ hasSavedChat, onContinue, onNewChat, language }: ModelPickerProps) {
  const strings = t(language);

  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        {/* Hero */}
        <div className="cybernus-fade-in-up mb-12 text-center">
          <div className="relative mx-auto mb-8 flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 animate-pulse rounded-2xl bg-[#00ff41]/10 blur-xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00ff41]/5 ring-1 ring-[#00ff41]/20">
              <Sparkles className="h-8 w-8 text-[#00ff41]" />
            </div>
          </div>
          <h2 className="text-text-primary mb-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            CYBERNUS
          </h2>
          <p className="text-text-secondary mx-auto max-w-xs text-sm leading-relaxed">
            {strings.subtitle}
          </p>
        </div>

        {/* Model info card */}
        <div
          className="cybernus-fade-in-up mb-8 rounded-xl border border-[#00ff41]/20 bg-[#00ff41]/[0.03] p-5"
          style={{ animationDelay: '100ms' }}
        >
          <div className="mb-2 flex items-center gap-2">
            <span
              className="block h-2 w-2 rounded-full bg-[#00ff41]"
              style={{ boxShadow: '0 0 8px rgba(0,255,65,0.5)' }}
            />
            <span className="text-text-primary text-sm font-semibold">Grok 4.1 Fast</span>
          </div>
          <p className="text-text-muted text-xs leading-relaxed">
            2M context window · MCP tools · Web search · Code execution
          </p>
        </div>

        {/* Action buttons */}
        <div
          className="cybernus-fade-in-up flex flex-col items-center gap-3"
          style={{ animationDelay: '200ms' }}
        >
          {hasSavedChat && (
            <button
              onClick={onContinue}
              className={cn(
                'w-full rounded-xl px-8 py-3.5 text-sm font-semibold transition-all',
                'bg-[#00ff41] text-black shadow-lg shadow-[#00ff41]/20',
                'hover:shadow-[#00ff41]/30 hover:brightness-110',
              )}
            >
              {strings.continueChat}
            </button>
          )}
          <button
            onClick={onNewChat}
            className={cn(
              'w-full rounded-xl px-8 py-3.5 text-sm font-semibold transition-all',
              hasSavedChat
                ? 'border-border text-text-secondary border hover:border-[#00ff41]/30 hover:bg-[#00ff41]/5'
                : 'bg-[#00ff41] text-black shadow-lg shadow-[#00ff41]/20 hover:shadow-[#00ff41]/30 hover:brightness-110',
            )}
          >
            {strings.startNewChat}
          </button>
        </div>

        <p className="text-text-muted mt-8 text-center text-[10px]">{strings.poweredBy}</p>
      </div>
    </div>
  );
}
