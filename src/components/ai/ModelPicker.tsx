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
            <div className="bg-accent/10 absolute inset-0 animate-pulse rounded-2xl blur-xl" />
            <div className="bg-accent-muted ring-accent/20 relative flex h-14 w-14 items-center justify-center rounded-2xl ring-1">
              <Sparkles className="text-accent h-7 w-7" />
            </div>
          </div>
          <h2 className="text-text-primary mb-2 text-2xl font-bold">{strings.title}</h2>
          <p className="text-text-muted text-sm">{strings.subtitle}</p>
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
                    ? 'border-accent/30 bg-accent-muted'
                    : 'border-border hover:border-accent/15 hover:bg-bg-surface',
                )}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <Zap
                    className={cn('h-3.5 w-3.5', isSelected ? 'text-accent' : 'text-text-muted')}
                  />
                  <h3
                    className={cn(
                      'text-sm font-semibold',
                      isSelected ? 'text-text-primary' : 'text-text-secondary',
                    )}
                  >
                    {cm.name}
                  </h3>
                  {cm.recommended && (
                    <span className="bg-accent text-bg-base rounded-full px-1.5 py-px text-[9px] font-bold">
                      {strings.recommended}
                    </span>
                  )}
                </div>
                <p className="text-text-muted text-xs leading-relaxed">{cm.description}</p>
                <div className="text-text-muted mt-2.5 flex items-center gap-2 text-[10px]">
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
              className="bg-accent text-bg-base shadow-accent/20 hover:bg-accent-hover hover:shadow-accent/30 w-full rounded-xl px-8 py-3 text-sm font-semibold shadow-lg transition-all sm:w-auto"
            >
              {strings.continueChat}
            </button>
          )}
          <button
            onClick={onNewChat}
            className={cn(
              'w-full rounded-xl px-8 py-3 text-sm font-semibold transition-all sm:w-auto',
              hasSavedChat
                ? 'border-border text-text-secondary hover:border-accent/30 hover:bg-accent-muted border'
                : 'bg-accent text-bg-base shadow-accent/20 hover:bg-accent-hover hover:shadow-accent/30 shadow-lg',
            )}
          >
            {strings.newChat}
          </button>
        </div>

        <p className="text-text-muted mt-6 text-center text-[10px]">{strings.poweredBy}</p>
      </div>
    </div>
  );
}
