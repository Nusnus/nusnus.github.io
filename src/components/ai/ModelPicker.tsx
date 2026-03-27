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
  onStartVideoChat?: () => void;
  language: Language;
}

/** Cybernus launch screen — single model, Matrix-themed entry point. */
export function ModelPicker({
  hasSavedChat,
  onContinue,
  onNewChat,
  onStartVideoChat,
  language,
}: ModelPickerProps) {
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
            Cybernus
          </h2>
          <p className="text-text-secondary mx-auto max-w-xs text-sm leading-relaxed">
            {strings.subtitle}
          </p>
        </div>

        {/* Capabilities card */}
        <div
          className="cybernus-fade-in-up mb-8 rounded-xl border border-[#00ff41]/20 bg-[#00ff41]/[0.03] p-5"
          style={{ animationDelay: '100ms' }}
        >
          <div className="mb-2 flex items-center gap-2">
            <span
              className="block h-2 w-2 rounded-full bg-[#00ff41]"
              style={{ boxShadow: '0 0 8px rgba(0,255,65,0.5)' }}
            />
            <span className="text-text-primary text-sm font-semibold">Neural Core Online</span>
          </div>
          <p className="text-text-muted text-xs leading-relaxed">
            Voice · Vision · Web · Code · Agents · Image Gen · Video Chat
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

          {/* Video Chat button */}
          {onStartVideoChat && (
            <button
              onClick={onStartVideoChat}
              className={cn(
                'group relative w-full overflow-hidden rounded-xl px-8 py-3.5 text-sm font-semibold transition-all',
                'border border-[#00ff41]/20 text-[#00ff41] hover:border-[#00ff41]/40 hover:bg-[#00ff41]/5',
              )}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                {strings.videoChat}
              </span>
            </button>
          )}
        </div>

        <p className="text-text-muted mt-8 text-center text-[10px]">{strings.poweredBy}</p>
      </div>
    </div>
  );
}
