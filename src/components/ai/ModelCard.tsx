import { Cpu, Loader2, Star, X } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import type { ModelInfo } from '@lib/ai/config';

const QUALITY_COLORS: Record<ModelInfo['quality'], string> = {
  basic: 'text-text-muted',
  good: 'text-blue-400',
  great: 'text-purple-400',
  best: 'text-amber-400',
};

interface ModelCardProps {
  model: ModelInfo;
  isSelected: boolean;
  isCached: boolean;
  isDeleting: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

/** Selection card for a local (WebLLM) model. */
export function ModelCard({
  model,
  isSelected,
  isCached,
  isDeleting,
  onSelect,
  onDelete,
}: ModelCardProps) {
  const qualityIdx = ['basic', 'good', 'great', 'best'].indexOf(model.quality) + 1;
  return (
    <button
      onClick={onSelect}
      className={cn(
        'border-border bg-bg-surface relative flex flex-col rounded-xl border p-4 text-left transition-all',
        isSelected
          ? 'border-accent ring-accent/30 ring-2'
          : 'hover:bg-bg-elevated hover:border-text-muted',
      )}
    >
      {/* Header: Name + Family badge + Stars */}
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-text-primary text-sm leading-tight font-semibold">{model.name}</h3>
          {model.recommended && (
            <span className="bg-accent text-bg-base shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold">
              ★ Recommended
            </span>
          )}
        </div>
        <div className={cn('flex shrink-0 gap-0.5 pt-0.5', QUALITY_COLORS[model.quality])}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Star
              key={i}
              className={cn('h-3 w-3', i < qualityIdx ? 'fill-current' : 'opacity-20')}
            />
          ))}
        </div>
      </div>

      {/* Family tag */}
      <span className="bg-bg-elevated text-text-muted mb-2 inline-block w-fit rounded px-1.5 py-0.5 text-[10px] font-medium">
        {model.family}
      </span>

      {/* Description — full text, not truncated */}
      <p className="text-text-secondary mb-3 text-xs leading-relaxed">{model.description}</p>

      {/* Stats */}
      <div className="text-text-muted mt-auto flex items-center gap-3 text-[11px]">
        <span className="flex items-center gap-1">
          <Cpu className="h-3.5 w-3.5 opacity-50" />
          {model.params}
        </span>
        <span className="opacity-30">|</span>
        <span>↓ {model.downloadSize}</span>
        <span className="opacity-30">|</span>
        <span>{(model.vramMB / 1024).toFixed(1)} GB VRAM</span>
      </div>

      {/* Cache status row */}
      {isCached && (
        <div className="border-border mt-3 flex items-center justify-between border-t pt-2.5">
          <span className="flex items-center gap-1.5 text-[11px]">
            <span className="bg-status-active h-2 w-2 rounded-full" />
            <span className="text-status-active font-medium">Cached locally</span>
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onDelete();
              }
            }}
            className="text-text-muted flex items-center gap-1 text-[11px] transition-colors hover:text-red-400"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Removing…
              </>
            ) : (
              <>
                <X className="h-3.5 w-3.5" />
                Remove
              </>
            )}
          </span>
        </div>
      )}
    </button>
  );
}
