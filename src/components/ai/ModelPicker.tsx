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

/** Idle-screen model picker — cloud-only, Matrix-inspired. */
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
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-[#00ff41]/10 px-6 py-5 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00ff41]/10 shadow-[0_0_20px_rgba(0,255,65,0.15)]">
          <Sparkles className="h-6 w-6 text-[#00ff41]" />
        </div>
        <h2 className="mb-1 text-lg font-bold text-[#00ff41]">{strings.title}</h2>
        <p className="text-xs text-[#00ff41]/40">{strings.subtitle}</p>
      </div>

      {/* Cloud model picker */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {CLOUD_MODELS.map((cm) => (
              <button
                key={cm.id}
                onClick={() => setSelectedCloudModelId(cm.id)}
                className={cn(
                  'relative flex flex-col rounded-xl border p-4 text-left transition-all',
                  selectedCloudModelId === cm.id
                    ? 'border-[#00ff41]/50 bg-[#00ff41]/5 shadow-[0_0_15px_rgba(0,255,65,0.1)]'
                    : 'border-[#00ff41]/10 bg-black/30 hover:border-[#00ff41]/25 hover:bg-[#00ff41]/5',
                )}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#00ff41]" />
                  <h3 className="text-sm font-semibold text-[#00ff41]">{cm.name}</h3>
                  {cm.recommended && (
                    <span className="rounded-full bg-[#00ff41] px-2 py-0.5 text-[9px] font-bold text-black">
                      {strings.recommended}
                    </span>
                  )}
                </div>
                <span className="mb-2 inline-block w-fit rounded bg-[#00ff41]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#00ff41]/60">
                  xAI
                </span>
                <p className="text-xs leading-relaxed text-[#00ff41]/50">{cm.description}</p>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-[#00ff41]/30">
                  <span className="flex items-center gap-1">
                    <Cloud className="h-3.5 w-3.5 opacity-50" /> Cloud
                  </span>
                  <span className="opacity-30">|</span>
                  <span>{strings.noDownload}</span>
                  <span className="opacity-30">|</span>
                  <span>{strings.instantStart}</span>
                </div>
              </button>
            ))}
          </div>
          <p className="text-center text-[10px] text-[#00ff41]/25">{strings.poweredBy}</p>
        </div>
      </div>

      {/* Sticky footer with start button(s) */}
      <div className="shrink-0 border-t border-[#00ff41]/10 px-6 py-4 text-center">
        <div className="flex items-center justify-center gap-3">
          {hasSavedChat && (
            <button
              onClick={onContinue}
              className="rounded-xl bg-[#00ff41] px-8 py-3 text-sm font-semibold text-black transition-all hover:bg-[#00cc33] hover:shadow-[0_0_20px_rgba(0,255,65,0.3)]"
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
                : 'bg-[#00ff41] text-black hover:bg-[#00cc33] hover:shadow-[0_0_20px_rgba(0,255,65,0.3)]',
            )}
          >
            {strings.newChat}
          </button>
        </div>
      </div>
    </div>
  );
}
