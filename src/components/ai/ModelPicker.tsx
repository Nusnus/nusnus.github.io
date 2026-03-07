import { Sparkles, Zap, Cloud } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import { CLOUD_MODELS } from '@lib/ai/config';
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

/** Idle-screen model picker — modern 2026 Matrix-inspired design. */
export function ModelPicker({
  selectedCloudModelId,
  setSelectedCloudModelId,
  hasSavedChat,
  onContinue,
  onNewChat,
  language,
}: ModelPickerProps) {
  const strings = t(language);

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="w-full max-w-2xl px-6 py-8">
        {/* Hero header */}
        <div className="cybernus-fade-in-up mb-8 text-center">
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center">
            <div className="cybernus-glow-pulse absolute inset-0 rounded-2xl border border-[#00ff41]/20" />
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00ff41]/10 shadow-[0_0_30px_rgba(0,255,65,0.15)]">
              <Sparkles className="h-7 w-7 text-[#00ff41]" />
            </div>
          </div>
          <h2 className="mb-2 text-xl font-bold tracking-wide text-[#00ff41]">{strings.title}</h2>
          <p className="text-sm text-[#00ff41]/35">{strings.subtitle}</p>
        </div>

        {/* Model cards */}
        <div
          className="cybernus-fade-in-up mb-6 grid gap-3 sm:grid-cols-2"
          style={{ animationDelay: '100ms' }}
        >
          {CLOUD_MODELS.map((cm) => {
            const isSelected = selectedCloudModelId === cm.id;
            return (
              <button
                key={cm.id}
                onClick={() => setSelectedCloudModelId(cm.id)}
                className={cn(
                  'group relative flex flex-col rounded-2xl border p-5 text-left transition-all',
                  isSelected
                    ? 'border-[#00ff41]/40 bg-[#00ff41]/5 shadow-[0_0_25px_rgba(0,255,65,0.08)]'
                    : 'border-[#00ff41]/8 bg-black/20 hover:border-[#00ff41]/20 hover:bg-[#00ff41]/[0.03]',
                )}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute -top-px -right-px h-3 w-3 rounded-full rounded-tr-2xl bg-[#00ff41] shadow-[0_0_8px_rgba(0,255,65,0.5)]" />
                )}

                <div className="mb-2 flex items-center gap-2">
                  <Zap
                    className={cn('h-4 w-4', isSelected ? 'text-[#00ff41]' : 'text-[#00ff41]/50')}
                  />
                  <h3
                    className={cn(
                      'text-sm font-semibold',
                      isSelected ? 'text-[#00ff41]' : 'text-[#00ff41]/80',
                    )}
                  >
                    {cm.name}
                  </h3>
                  {cm.recommended && (
                    <span className="rounded-full bg-[#00ff41] px-2 py-0.5 text-[9px] font-bold text-black">
                      {strings.recommended}
                    </span>
                  )}
                </div>
                <span className="mb-2 inline-block w-fit rounded-md bg-[#00ff41]/8 px-2 py-0.5 text-[10px] font-medium text-[#00ff41]/50">
                  xAI
                </span>
                <p className="text-xs leading-relaxed text-[#00ff41]/40">{cm.description}</p>
                <div className="mt-3 flex items-center gap-3 text-[10px] text-[#00ff41]/25">
                  <span className="flex items-center gap-1">
                    <Cloud className="h-3 w-3 opacity-50" /> Cloud
                  </span>
                  <span className="opacity-20">|</span>
                  <span>{strings.noDownload}</span>
                  <span className="opacity-20">|</span>
                  <span>{strings.instantStart}</span>
                </div>
              </button>
            );
          })}
        </div>

        <p className="mb-6 text-center text-[10px] text-[#00ff41]/20">{strings.poweredBy}</p>

        {/* Action buttons */}
        <div
          className="cybernus-fade-in-up flex items-center justify-center gap-3"
          style={{ animationDelay: '200ms' }}
        >
          {hasSavedChat && (
            <button
              onClick={onContinue}
              className="rounded-xl bg-[#00ff41] px-8 py-3 text-sm font-semibold text-black transition-all hover:bg-[#00cc33] hover:shadow-[0_0_25px_rgba(0,255,65,0.35)]"
            >
              {strings.continueChat}
            </button>
          )}
          <button
            onClick={onNewChat}
            className={cn(
              'rounded-xl px-8 py-3 text-sm font-semibold transition-all',
              hasSavedChat
                ? 'border border-[#00ff41]/20 text-[#00ff41] hover:border-[#00ff41]/40 hover:bg-[#00ff41]/10'
                : 'bg-[#00ff41] text-black hover:bg-[#00cc33] hover:shadow-[0_0_25px_rgba(0,255,65,0.35)]',
            )}
          >
            {strings.newChat}
          </button>
        </div>
      </div>
    </div>
  );
}
