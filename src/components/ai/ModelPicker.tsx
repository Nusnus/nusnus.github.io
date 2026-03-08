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

/** Idle-screen model picker — centered hero with model selection. */
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
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="w-full max-w-xl">
        {/* Hero */}
        <div className="cybernus-fade-in-up mb-10 text-center">
          <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 animate-pulse rounded-2xl bg-emerald-500/10 blur-xl" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/20">
              <Sparkles className="h-7 w-7 text-emerald-400" />
            </div>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-white">{strings.title}</h2>
          <p className="text-sm text-white/40">{strings.subtitle}</p>
        </div>

        {/* Model cards */}
        <div
          className="cybernus-fade-in-up mb-8 grid gap-3 sm:grid-cols-2"
          style={{ animationDelay: '100ms' }}
        >
          {CLOUD_MODELS.map((cm) => {
            const isSelected = selectedCloudModelId === cm.id;
            return (
              <button
                key={cm.id}
                onClick={() => setSelectedCloudModelId(cm.id)}
                className={cn(
                  'group relative flex flex-col rounded-xl border p-4 text-left transition-all',
                  isSelected
                    ? 'border-emerald-500/30 bg-emerald-500/[0.05]'
                    : 'border-white/[0.06] hover:border-emerald-500/15 hover:bg-white/[0.02]',
                )}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <Zap
                    className={cn('h-3.5 w-3.5', isSelected ? 'text-emerald-400' : 'text-white/30')}
                  />
                  <h3
                    className={cn(
                      'text-sm font-semibold',
                      isSelected ? 'text-white' : 'text-white/70',
                    )}
                  >
                    {cm.name}
                  </h3>
                  {cm.recommended && (
                    <span className="rounded-full bg-emerald-500 px-1.5 py-px text-[9px] font-bold text-white">
                      {strings.recommended}
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-white/40">{cm.description}</p>
                <div className="mt-2.5 flex items-center gap-2 text-[10px] text-white/25">
                  <Cloud className="h-3 w-3 opacity-40" />
                  <span>
                    {strings.noDownload} · {strings.instantStart}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Action buttons */}
        <div
          className="cybernus-fade-in-up flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
          style={{ animationDelay: '200ms' }}
        >
          {hasSavedChat && (
            <button
              onClick={onContinue}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/30 sm:w-auto"
            >
              {strings.continueChat}
            </button>
          )}
          <button
            onClick={onNewChat}
            className={cn(
              'w-full rounded-xl px-8 py-3 text-sm font-semibold transition-all sm:w-auto',
              hasSavedChat
                ? 'border border-white/[0.08] text-white/80 hover:border-emerald-500/30 hover:bg-emerald-500/[0.05]'
                : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30',
            )}
          >
            {strings.newChat}
          </button>
        </div>

        <p className="mt-6 text-center text-[10px] text-white/20">{strings.poweredBy}</p>
      </div>
    </div>
  );
}
