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

/** Idle-screen model picker — professional design matching main page. */
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
            <div className="cybernus-glow-pulse border-accent/20 absolute inset-0 rounded-2xl border" />
            <div className="bg-accent-muted flex h-14 w-14 items-center justify-center rounded-2xl">
              <Sparkles className="text-accent h-7 w-7" />
            </div>
          </div>
          <h2 className="text-text-primary mb-2 text-xl font-bold tracking-wide">
            {strings.title}
          </h2>
          <p className="text-text-muted text-sm">{strings.subtitle}</p>
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
                    ? 'border-accent/40 bg-accent-muted'
                    : 'border-border bg-bg-surface hover:border-accent/20 hover:bg-bg-elevated',
                )}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <div className="bg-accent absolute -top-px -right-px h-3 w-3 rounded-full rounded-tr-2xl" />
                )}

                <div className="mb-2 flex items-center gap-2">
                  <Zap className={cn('h-4 w-4', isSelected ? 'text-accent' : 'text-text-muted')} />
                  <h3
                    className={cn(
                      'text-sm font-semibold',
                      isSelected ? 'text-text-primary' : 'text-text-secondary',
                    )}
                  >
                    {cm.name}
                  </h3>
                  {cm.recommended && (
                    <span className="bg-accent text-bg-base rounded-full px-2 py-0.5 text-[9px] font-bold">
                      {strings.recommended}
                    </span>
                  )}
                </div>
                <span className="bg-bg-elevated text-text-muted mb-2 inline-block w-fit rounded-md px-2 py-0.5 text-[10px] font-medium">
                  xAI
                </span>
                <p className="text-text-muted text-xs leading-relaxed">{cm.description}</p>
                <div className="text-text-muted mt-3 flex items-center gap-3 text-[10px]">
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

        <p className="text-text-muted mb-6 text-center text-[10px]">{strings.poweredBy}</p>

        {/* Action buttons */}
        <div
          className="cybernus-fade-in-up flex items-center justify-center gap-3"
          style={{ animationDelay: '200ms' }}
        >
          {hasSavedChat && (
            <button
              onClick={onContinue}
              className="bg-accent text-bg-base hover:bg-accent-hover rounded-xl px-8 py-3 text-sm font-semibold transition-all"
            >
              {strings.continueChat}
            </button>
          )}
          <button
            onClick={onNewChat}
            className={cn(
              'rounded-xl px-8 py-3 text-sm font-semibold transition-all',
              hasSavedChat
                ? 'border-border text-text-primary hover:border-accent/40 hover:bg-accent-muted border'
                : 'bg-accent text-bg-base hover:bg-accent-hover',
            )}
          >
            {strings.newChat}
          </button>
        </div>
      </div>
    </div>
  );
}
