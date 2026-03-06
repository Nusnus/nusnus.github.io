import { Cloud, Sparkles, Zap } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import { CLOUD_MODELS } from '@lib/ai/config';

interface ModelPickerProps {
  selectedCloudModelId: string;
  setSelectedCloudModelId: (id: string) => void;
  hasSavedChat: boolean;
  onContinue: () => void;
  onNewChat: () => void;
}

/** Idle-screen model picker for cloud models with start buttons. */
export function ModelPicker({
  selectedCloudModelId,
  setSelectedCloudModelId,
  hasSavedChat,
  onContinue,
  onNewChat,
}: ModelPickerProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-border shrink-0 border-b px-6 py-5 text-center">
        <div className="bg-accent/10 mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl">
          <Sparkles className="text-accent h-6 w-6" />
        </div>
        <h2 className="text-text-primary mb-1 text-lg font-bold">Ask AI about Tomer</h2>
        <p className="text-text-secondary text-xs">Powered by xAI Grok</p>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {CLOUD_MODELS.map((cm) => (
              <button
                key={cm.id}
                onClick={() => setSelectedCloudModelId(cm.id)}
                className={cn(
                  'border-border bg-bg-surface relative flex flex-col rounded-xl border p-4 text-left transition-all',
                  selectedCloudModelId === cm.id
                    ? 'border-accent ring-accent/30 ring-2'
                    : 'hover:bg-bg-elevated hover:border-text-muted',
                )}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <Zap className="text-accent h-4 w-4" />
                  <h3 className="text-text-primary text-sm font-semibold">{cm.name}</h3>
                  {cm.recommended && (
                    <span className="bg-accent text-bg-base rounded-full px-2 py-0.5 text-[9px] font-bold">
                      ★ Recommended
                    </span>
                  )}
                </div>
                <span className="bg-bg-elevated text-text-muted mb-2 inline-block w-fit rounded px-1.5 py-0.5 text-[10px] font-medium">
                  xAI
                </span>
                <p className="text-text-secondary text-xs leading-relaxed">{cm.description}</p>
                <div className="text-text-muted mt-3 flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1">
                    <Cloud className="h-3.5 w-3.5 opacity-50" /> Cloud
                  </span>
                  <span className="opacity-30">|</span>
                  <span>No download</span>
                  <span className="opacity-30">|</span>
                  <span>Instant start</span>
                </div>
              </button>
            ))}
          </div>
          <p className="text-text-muted text-center text-[10px]">
            Powered by xAI · Requests proxied through a secure endpoint · No API keys exposed
          </p>
        </div>
      </div>

      {/* Sticky footer with start button(s) */}
      <div className="border-border shrink-0 border-t px-6 py-4 text-center">
        <div className="flex items-center justify-center gap-3">
          {hasSavedChat && (
            <button
              onClick={onContinue}
              className="bg-accent text-bg-base hover:bg-accent-hover rounded-xl px-8 py-3 text-sm font-semibold transition-colors"
            >
              Continue Chat
            </button>
          )}
          <button
            onClick={onNewChat}
            className={cn(
              'rounded-xl px-8 py-3 text-sm font-semibold transition-colors',
              hasSavedChat
                ? 'border-border text-text-primary hover:bg-bg-elevated border'
                : 'bg-accent text-bg-base hover:bg-accent-hover',
            )}
          >
            New Chat
          </button>
        </div>
      </div>
    </div>
  );
}
