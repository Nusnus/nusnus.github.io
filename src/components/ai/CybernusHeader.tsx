/**
 * CybernusHeader — top bar for the chat page.
 *
 * Layout (desktop):
 *   [← Back]  CYBERNUS  [model meta chips]  ·····  [lang] [history] [new]
 *
 * Mobile collapses model chips into a single icon-backed pill.
 */

import { ArrowLeft, Cpu, History, Languages, Plus } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import { CYBERNUS_MODEL_META, getStrings, type ChatLanguage } from '@lib/ai/config';

interface CybernusHeaderProps {
  language: ChatLanguage;
  onToggleLanguage: () => void;
  onToggleHistory: () => void;
  onNewChat: () => void;
  disabled?: boolean;
}

export function CybernusHeader({
  language,
  onToggleLanguage,
  onToggleHistory,
  onNewChat,
  disabled = false,
}: CybernusHeaderProps) {
  const strings = getStrings(language);
  const meta = CYBERNUS_MODEL_META;

  return (
    <header className="border-accent/20 bg-bg-base/80 relative z-10 flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5 backdrop-blur-md sm:px-4">
      {/* Left — back + wordmark + model meta */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <a
          href="/"
          className="text-text-muted hover:text-text-primary flex shrink-0 items-center gap-1 text-sm transition-colors"
          aria-label="Back to portfolio"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </a>

        <div className="bg-border/50 hidden h-5 w-px sm:block" />

        <div className="flex min-w-0 items-center gap-2">
          <h1 className="matrix-flicker text-accent shrink-0 font-mono text-sm font-bold tracking-[0.15em] sm:tracking-[0.2em]">
            CYBERNUS
          </h1>

          {/* Model metadata — desktop: full chips; mobile: single compact pill */}
          <div className="hidden items-center gap-1.5 lg:flex">
            <Chip icon={<Cpu className="h-3 w-3" />}>{meta.displayName}</Chip>
            <Chip>{meta.contextWindow}</Chip>
            {meta.reasoning && <Chip accent>Reasoning</Chip>}
          </div>
          <div className="flex lg:hidden">
            <Chip icon={<Cpu className="h-3 w-3" />}>{meta.displayName}</Chip>
          </div>
        </div>
      </div>

      {/* Right — language / history / new */}
      <div className="flex shrink-0 items-center gap-1">
        <IconButton
          onClick={onToggleLanguage}
          disabled={disabled}
          label={`Switch language (${language === 'en' ? 'English → Español' : 'Español → English'})`}
          badge={language.toUpperCase()}
        >
          <Languages className="h-4 w-4" />
        </IconButton>

        <IconButton onClick={onToggleHistory} disabled={disabled} label={strings.history}>
          <History className="h-4 w-4" />
        </IconButton>

        <IconButton onClick={onNewChat} disabled={disabled} label={strings.newChat}>
          <Plus className="h-4 w-4" />
        </IconButton>
      </div>
    </header>
  );
}

/** Small metadata chip — model name, context window, features. */
function Chip({
  icon,
  accent,
  children,
}: {
  icon?: React.ReactNode;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium',
        accent
          ? 'bg-accent/10 border-accent/30 text-accent'
          : 'bg-bg-surface/60 border-border text-text-secondary',
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Header action button — icon with optional floating badge. */
function IconButton({
  onClick,
  disabled,
  label,
  badge,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'text-text-secondary hover:text-text-primary hover:bg-bg-surface relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {children}
      {badge && (
        <span className="bg-accent text-bg-base absolute -top-0.5 -right-0.5 rounded px-1 text-[8px] leading-tight font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}
