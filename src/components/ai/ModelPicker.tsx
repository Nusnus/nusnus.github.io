import { Cloud, Monitor, Sparkles, Zap } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import {
  AVAILABLE_MODELS,
  GROUP_INFO,
  CLOUD_MODELS,
  type ModelGroup,
  type ChatProvider,
} from '@lib/ai/config';
import { ModelCard } from './ModelCard';

interface ModelPickerProps {
  provider: ChatProvider;
  setProvider: (p: ChatProvider) => void;
  webGPUSupported: boolean;
  selectedModelId: string;
  setSelectedModelId: (id: string) => void;
  selectedCloudModelId: string;
  setSelectedCloudModelId: (id: string) => void;
  cacheMap: Record<string, boolean>;
  isDeletingModel: string | null;
  deleteModel: (id: string) => void;
  hasSavedChat: boolean;
  onContinue: () => void;
  onNewChat: () => void;
}

/** Idle-screen model picker with provider toggle, model grid, and start buttons. */
export function ModelPicker({
  provider,
  setProvider,
  webGPUSupported,
  selectedModelId,
  setSelectedModelId,
  selectedCloudModelId,
  setSelectedCloudModelId,
  cacheMap,
  isDeletingModel,
  deleteModel,
  hasSavedChat,
  onContinue,
  onNewChat,
}: ModelPickerProps) {
  const selectedModel = AVAILABLE_MODELS.find((m) => m.id === selectedModelId);
  const groups: ModelGroup[] = ['top', 'more'];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-border shrink-0 border-b px-6 py-5 text-center">
        <div className="bg-accent/10 mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl">
          <Sparkles className="text-accent h-6 w-6" />
        </div>
        <h2 className="text-text-primary mb-1 text-lg font-bold">Ask AI about Tomer</h2>
        <p className="text-text-secondary text-xs">Choose how you want to chat</p>
      </div>

      {/* Provider toggle */}
      <div className="border-border shrink-0 border-b px-6 py-3">
        <div className="mx-auto flex max-w-5xl gap-2">
          <button
            onClick={() => setProvider('cloud')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
              provider === 'cloud'
                ? 'bg-accent/15 text-accent border-accent border'
                : 'border-border text-text-secondary hover:bg-bg-elevated border',
            )}
          >
            <Zap className="h-4 w-4" />
            Cloud · xAI Grok
          </button>
          <button
            onClick={() => webGPUSupported && setProvider('local')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
              !webGPUSupported && 'cursor-not-allowed opacity-40',
              provider === 'local'
                ? 'bg-accent/15 text-accent border-accent border'
                : 'border-border text-text-secondary hover:bg-bg-elevated border',
            )}
            disabled={!webGPUSupported}
            title={!webGPUSupported ? 'WebGPU is not supported in this browser' : undefined}
          >
            <Monitor className="h-4 w-4" />
            Local · In-Browser
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {provider === 'cloud' ? (
          /* ── Cloud model picker ── */
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
        ) : (
          /* ── Local model picker ── */
          <div className="mx-auto max-w-5xl space-y-8">
            {groups.map((group) => {
              const models = AVAILABLE_MODELS.filter((m) => m.group === group);
              if (models.length === 0) return null;
              const info = GROUP_INFO[group];
              return (
                <div key={group}>
                  <div className="mb-3">
                    <h3 className="text-text-primary text-sm font-semibold">{info.label}</h3>
                    <p className="text-text-muted text-[11px]">{info.subtitle}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {models.map((model) => (
                      <ModelCard
                        key={model.id}
                        model={model}
                        isSelected={selectedModelId === model.id}
                        isCached={!!cacheMap[model.id]}
                        isDeleting={isDeletingModel === model.id}
                        onSelect={() => setSelectedModelId(model.id)}
                        onDelete={() => deleteModel(model.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            <p className="text-text-muted text-center text-[10px]">
              All models run 100% in your browser via WebGPU — no data leaves your device
            </p>
          </div>
        )}
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
            {provider === 'local' && !cacheMap[selectedModelId] ? 'Download & Start' : 'New Chat'}
            {provider === 'local' && selectedModel && !cacheMap[selectedModelId] && (
              <span className="ml-1.5 opacity-70">({selectedModel.downloadSize})</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
