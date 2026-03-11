import { type RefObject, useMemo, useCallback, useState, useEffect, memo } from 'react';
import {
  ArrowRight,
  ExternalLink,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@lib/utils/cn';
import { SUGGESTED_QUESTIONS } from '@lib/ai/config';
import type { ChatMessage, AgentActivityItem } from '@lib/ai/types';
import { renderMarkdown } from '@lib/ai/markdown';
import { executeAction } from '@lib/ai/tools';
import type { Language } from '@lib/ai/i18n';
import { t, LANGUAGES } from '@lib/ai/i18n';
import { TTSButton } from './TTSButton';
import { InlineChatForm } from './InlineChatForm';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onSendMessage: (text: string) => void;
  /** Callback when a user selects an option from an inline form (ask_user tool). */
  onFormSubmit?:
    | ((messageId: string, selectedId: string, value: string, customValue?: string) => void)
    | undefined;
  language: Language;
  /** Called after the expanded (zoomed) view closes. */
  onExpandClose?: () => void;
}

/**
 * Extract follow-up suggestions (lines starting with "→ ") from the end
 * of an assistant message. Returns the main content and suggestion strings.
 */
function extractFollowUps(content: string): { body: string; suggestions: string[] } {
  const lines = content.split('\n');
  const suggestions: string[] = [];

  // Walk backwards collecting → lines
  let i = lines.length - 1;
  while (i >= 0) {
    const line = (lines[i] ?? '').trim();
    if (line.startsWith('→ ')) {
      suggestions.unshift(line.slice(2).trim());
      i--;
    } else if (line === '') {
      // skip trailing blank lines between content and suggestions
      i--;
    } else {
      break;
    }
  }

  const body = lines
    .slice(0, i + 1)
    .join('\n')
    .trimEnd();
  return { body, suggestions };
}

/** Timing (ms) between progressive thinking steps. */
const THINKING_STEP_DELAYS: readonly number[] = [800, 1800];

/** Shared SVG path for the user avatar icon. */
const USER_AVATAR_PATH =
  'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z';

/**
 * IDE-like thinking indicator — shows progressive (non-looping) steps.
 *
 * Steps advance forward on fixed timers and never cycle back.
 * The final step stays active with animated dots until real content arrives.
 */
function ThinkingIndicator() {
  const [step, setStep] = useState(0);

  const steps = [
    { label: 'Initializing context' },
    { label: 'Analyzing query' },
    { label: 'Generating response' },
  ];

  useEffect(() => {
    // Schedule each step transition once — no looping
    const timers: ReturnType<typeof setTimeout>[] = [];
    THINKING_STEP_DELAYS.forEach((delay, i) => {
      timers.push(setTimeout(() => setStep(i + 1), delay));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="space-y-1 py-1">
      {steps.map((s, i) => {
        const isDone = i < step;
        const isActive = i === step;
        const isPending = i > step;

        return (
          <div
            key={s.label}
            className={cn(
              'ide-step-appear flex items-center gap-2 font-mono text-xs transition-all duration-300',
              isDone && 'text-[#00ff41]/40',
              isActive && 'text-[#00ff41]',
              isPending && 'text-white/10',
            )}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            {/* Step indicator */}
            <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[10px]">
              {isDone ? (
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : isActive ? (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-[#00ff41] opacity-30" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00ff41]" />
                </span>
              ) : (
                <span className="inline-block h-1 w-1 rounded-full bg-current opacity-40" />
              )}
            </span>

            {/* Label */}
            <span className={cn(isActive && 'font-medium')}>{s.label}</span>

            {/* Active dots — only on the current step */}
            {isActive && (
              <span className="inline-flex gap-0.5">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="inline-block h-1 w-1 rounded-full bg-[#00ff41]/60"
                    style={{
                      animation: 'roast-dot 1.4s ease-in-out infinite',
                      animationDelay: `${d * 0.2}s`,
                    }}
                  />
                ))}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Animated typing indicator dots. */
function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 py-1">
      <span className="bg-accent/60 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]" />
      <span className="bg-accent/50 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]" />
      <span className="bg-accent/40 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]" />
    </span>
  );
}

/**
 * InlineAgentActivity — IDE-style tool activity display.
 *
 * Each agent step renders as a compact, monospace-styled status line
 * with a spinner (working) or checkmark (done), matching the aesthetic
 * of modern IDE chat panels (Cursor, Copilot, etc.).
 */
function InlineAgentActivity({ items }: { items: AgentActivityItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mb-3 space-y-0.5 rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2">
      {items.map((item) => {
        const isWorking = item.status === 'working';
        return (
          <div
            key={item.toolType}
            className="ide-step-appear flex items-center gap-2.5 py-1 font-mono text-xs"
          >
            {/* Status indicator */}
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {isWorking ? (
                <span className="relative flex h-2 w-2">
                  <span
                    className="absolute inset-0 rounded-full opacity-30"
                    style={{
                      backgroundColor: item.color,
                      animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
                    }}
                  />
                  <span
                    className="relative inline-flex h-2 w-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                </span>
              ) : (
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={item.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: 0.5 }}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>

            {/* Agent icon */}
            <svg
              className="h-3.5 w-3.5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke={item.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: isWorking ? 0.9 : 0.4 }}
            >
              <path d={item.iconPath} />
            </svg>

            {/* Agent name + status */}
            <span
              className="text-[11px] font-bold tracking-wider uppercase"
              style={{ color: item.color, opacity: isWorking ? 0.9 : 0.4 }}
            >
              {item.agent}
            </span>
            <span className={cn('text-[11px]', isWorking ? 'text-white/50' : 'text-white/25')}>
              {item.label}
            </span>

            {/* Working dots */}
            {isWorking && (
              <span className="inline-flex gap-0.5">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="inline-block h-1 w-1 rounded-full"
                    style={{
                      backgroundColor: item.color,
                      opacity: 0.6,
                      animation: 'roast-dot 1.4s ease-in-out infinite',
                      animationDelay: `${d * 0.2}s`,
                    }}
                  />
                ))}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Zoom constants ── */
const ZOOM_STEP = 0.15;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.0;
const DEFAULT_ZOOM = 1.0;

/** Floating zoom control bar. */
function ZoomControls({
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onExpand,
}: {
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onExpand: () => void;
}) {
  const zoomBtnClass =
    'flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className="bg-bg-base/90 border-border absolute right-4 bottom-4 z-10 hidden items-center gap-0.5 rounded-xl border px-1 py-1 shadow-lg backdrop-blur-md sm:flex">
      <button
        onClick={onZoomOut}
        className={zoomBtnClass}
        title="Zoom out"
        disabled={zoomLevel <= MIN_ZOOM}
        aria-label="Zoom out"
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onZoomReset}
        className="text-text-muted hover:bg-bg-elevated hover:text-text-secondary flex h-7 min-w-[3rem] items-center justify-center rounded-md px-1 text-[10px] font-medium transition-colors"
        title="Reset zoom"
        aria-label="Reset zoom"
      >
        {Math.round(zoomLevel * 100)}%
      </button>
      <button
        onClick={onZoomIn}
        className={zoomBtnClass}
        title="Zoom in"
        disabled={zoomLevel >= MAX_ZOOM}
        aria-label="Zoom in"
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </button>
      <div className="bg-border mx-0.5 h-4 w-px" />
      <button
        onClick={onExpand}
        className={zoomBtnClass}
        title="Expand to full screen"
        aria-label="Expand to full screen"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Fullscreen expanded markdown viewer. */
function ExpandedMarkdownView({
  messages,
  onClose,
  onSendMessage,
  isGenerating,
  language,
}: {
  messages: ChatMessage[];
  onClose: () => void;
  onSendMessage: (text: string) => void;
  isGenerating: boolean;
  language: Language;
}) {
  const [expandedZoom, setExpandedZoom] = useState(DEFAULT_ZOOM);
  const dir = language === 'he' ? 'rtl' : 'ltr';

  const handleZoomIn = useCallback(
    () => setExpandedZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM)),
    [],
  );
  const handleZoomOut = useCallback(
    () => setExpandedZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM)),
    [],
  );
  const handleZoomReset = useCallback(() => setExpandedZoom(DEFAULT_ZOOM), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const zoomBtnClass =
    'flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className="bg-bg-base fixed inset-0 z-50 flex flex-col" dir={dir}>
      {/* Header */}
      <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-3 sm:px-6">
        <span className="text-text-secondary text-sm font-medium">Expanded View</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className={zoomBtnClass}
            title="Zoom out"
            disabled={expandedZoom <= MIN_ZOOM}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-text-muted min-w-[3rem] text-center text-xs">
            {Math.round(expandedZoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className={zoomBtnClass}
            title="Zoom in"
            disabled={expandedZoom >= MAX_ZOOM}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={handleZoomReset}
            className={zoomBtnClass}
            title="Reset zoom"
            aria-label="Reset zoom"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <div className="bg-border mx-1 h-5 w-px" />
          <button
            onClick={onClose}
            className="text-text-muted hover:bg-bg-elevated hover:text-text-primary flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            title="Close expanded view"
            aria-label="Close expanded view"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable messages at expanded zoom */}
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div
          className="origin-top-left transition-transform duration-150 ease-out"
          style={{ zoom: expandedZoom }}
        >
          {messages.map((msg, msgIndex) => {
            const isUser = msg.role === 'user';
            const isLastAssistant = !isUser && msgIndex === messages.length - 1;
            const isStreamingMsg = isGenerating && isLastAssistant;

            if (!msg.content && !msg.searchStatus && !msg.agentActivity?.length && !isStreamingMsg)
              return null;

            return (
              <div
                key={msg.id}
                className={cn(
                  'px-4 py-6 sm:px-6 sm:py-8 md:px-12 lg:px-20',
                  isUser ? 'bg-bg-surface/30' : '',
                )}
              >
                <div className="mx-auto flex max-w-3xl gap-5">
                  {/* Avatar */}
                  <div className="shrink-0 pt-0.5">
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg',
                        isUser
                          ? 'bg-bg-elevated ring-border ring-1'
                          : 'bg-accent-muted ring-accent/20 ring-1',
                      )}
                    >
                      {isUser ? (
                        <svg
                          className="text-text-secondary h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d={USER_AVATAR_PATH} />
                        </svg>
                      ) : (
                        <Sparkles className="text-accent h-4 w-4" />
                      )}
                    </div>
                  </div>

                  {/* Message body */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'mb-2.5 text-xs font-semibold tracking-wide',
                        isUser ? 'text-text-secondary' : 'text-accent',
                      )}
                    >
                      {isUser ? (
                        'You'
                      ) : (
                        <span className="flex items-center gap-2">
                          Cybernus
                          {msg.content && !isStreamingMsg && (
                            <TTSButton text={msg.content} language={language} />
                          )}
                        </span>
                      )}
                    </p>
                    <div className="text-text-primary/85 text-[15px] leading-relaxed">
                      {/* Inline agent activity */}
                      {!isUser && msg.agentActivity && msg.agentActivity.length > 0 && (
                        <InlineAgentActivity items={msg.agentActivity} />
                      )}

                      {!msg.content ? (
                        isStreamingMsg ? (
                          <ThinkingIndicator />
                        ) : msg.agentActivity?.length ? null : (
                          <TypingIndicator />
                        )
                      ) : isUser ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <AssistantContent
                          content={msg.content}
                          isStreaming={isStreamingMsg}
                          onSendMessage={onSendMessage}
                          isGenerating={isGenerating}
                        />
                      )}
                    </div>

                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {msg.actions.map((action, idx) => (
                          <button
                            key={idx}
                            onClick={() => executeAction(action)}
                            title={action.url}
                            className="border-border bg-bg-surface text-accent hover:border-accent/30 hover:bg-accent-muted inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-all"
                          >
                            {action.type === 'open_link' ? (
                              <ExternalLink className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowRight className="h-3.5 w-3.5" />
                            )}
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Renders assistant message body with follow-up suggestion buttons extracted from → lines. */
function AssistantContent({
  content,
  isStreaming,
  onSendMessage,
  isGenerating,
}: {
  content: string;
  isStreaming: boolean;
  onSendMessage: (text: string) => void;
  isGenerating: boolean;
}) {
  const { body, suggestions } = useMemo(
    () => (isStreaming ? { body: content, suggestions: [] } : extractFollowUps(content)),
    [content, isStreaming],
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      if (!isGenerating) onSendMessage(suggestion);
    },
    [isGenerating, onSendMessage],
  );

  return (
    <div className="relative">
      {renderMarkdown(body, isStreaming)}
      {isStreaming && content && <span className="typing-cursor" />}

      {/* Follow-up suggestion buttons */}
      {suggestions.length > 0 && !isStreaming && (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSuggestionClick(s)}
              disabled={isGenerating}
              className="border-accent/15 bg-accent-muted text-accent hover:border-accent/30 hover:bg-accent/15 hover:text-accent-hover inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40"
            >
              <ArrowRight className="h-3 w-3" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Single message row — memoized to prevent re-rendering all messages on every streaming token. */
const MessageItem = memo(function MessageItem({
  msg,
  isStreaming,
  isGenerating,
  onSendMessage,
  onFormSubmit,
  onExpand,
  language,
}: {
  msg: ChatMessage;
  isStreaming: boolean;
  isGenerating: boolean;
  onSendMessage: (text: string) => void;
  onFormSubmit?:
    | ((messageId: string, selectedId: string, value: string, customValue?: string) => void)
    | undefined;
  onExpand: () => void;
  language: Language;
}) {
  const isUser = msg.role === 'user';

  const handleFormOptionSubmit = useCallback(
    (value: string) => {
      if (!msg.form || !onFormSubmit) return;
      // Find the option that matches this value, or treat it as custom "other"
      const matchedOption = msg.form.options.find((o) => o.value === value);
      if (matchedOption) {
        onFormSubmit(msg.id, matchedOption.id, value);
      } else {
        onFormSubmit(msg.id, '__other__', value, value);
      }
    },
    [msg.id, msg.form, onFormSubmit],
  );

  return (
    <div
      className={cn(
        'group px-3 py-4 sm:px-4 sm:py-6 md:px-8 lg:px-12',
        isUser ? 'bg-bg-surface/30' : '',
      )}
    >
      <div className="mx-auto flex max-w-2xl gap-4">
        {/* Avatar */}
        <div className="relative shrink-0 pt-0.5">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              isUser
                ? 'bg-bg-elevated ring-border ring-1'
                : 'bg-accent-muted ring-accent/20 ring-1',
            )}
          >
            {isUser ? (
              <svg
                className="text-text-secondary h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d={USER_AVATAR_PATH} />
              </svg>
            ) : (
              <Sparkles className="text-accent h-3.5 w-3.5" />
            )}
          </div>
          {isStreaming && (
            <div className="ring-accent/30 absolute -inset-1 animate-pulse rounded-lg ring-1" />
          )}
        </div>

        {/* Message body */}
        <div className="min-w-0 flex-1">
          {/* Role label */}
          <p
            className={cn(
              'mb-2 text-xs font-semibold tracking-wide',
              isUser ? 'text-text-secondary' : 'text-accent',
            )}
          >
            {isUser ? (
              'You'
            ) : (
              <span className="flex items-center gap-2">
                Cybernus
                {msg.content && !isStreaming && (
                  <TTSButton text={msg.content} language={language} />
                )}
              </span>
            )}
          </p>

          {/* Content */}
          <div className="text-text-primary/85 text-sm leading-relaxed">
            {/* Inline agent activity — shown above content */}
            {!isUser && msg.agentActivity && msg.agentActivity.length > 0 && (
              <InlineAgentActivity items={msg.agentActivity} />
            )}

            {!msg.content ? (
              isStreaming ? (
                <ThinkingIndicator />
              ) : msg.agentActivity?.length ? null : (
                <TypingIndicator />
              )
            ) : !isUser ? (
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('a, button')) return;
                  onExpand();
                }}
                onKeyDown={(e) => {
                  if ((e.target as HTMLElement).closest('a, button')) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onExpand();
                  }
                }}
                className="group/zoom hover:bg-bg-surface/50 relative cursor-zoom-in rounded-lg transition-colors"
                title="Click to expand"
              >
                <div className="bg-bg-elevated group-hover/zoom:text-text-muted pointer-events-none absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-md text-transparent opacity-0 backdrop-blur-sm transition-all group-hover/zoom:opacity-100">
                  <Maximize2 className="h-3 w-3" />
                </div>
                <AssistantContent
                  content={msg.content}
                  isStreaming={isStreaming}
                  onSendMessage={onSendMessage}
                  isGenerating={isGenerating}
                />
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{msg.content}</p>
            )}
          </div>

          {/* Tool action buttons */}
          {msg.actions && msg.actions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {msg.actions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => executeAction(action)}
                  title={action.url}
                  className="border-border bg-bg-surface text-accent hover:border-accent/30 hover:bg-accent-muted inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all"
                >
                  {action.type === 'open_link' ? (
                    <ExternalLink className="h-3 w-3" />
                  ) : (
                    <ArrowRight className="h-3 w-3" />
                  )}
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Dynamic in-chat form (ask_user tool) */}
          {!isUser && msg.form && (
            <InlineChatForm
              form={msg.form}
              onSubmit={handleFormOptionSubmit}
              disabled={isGenerating}
            />
          )}
        </div>
      </div>
    </div>
  );
});

/** Renders the scrollable message list — ChatGPT-style full-width layout. */
export function ChatMessages({
  messages,
  isGenerating,
  messagesEndRef,
  onSendMessage,
  onFormSubmit,
  language,
  onExpandClose,
}: ChatMessagesProps) {
  const dir = language === 'he' ? 'rtl' : 'ltr';

  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleZoomIn = useCallback(
    () => setZoomLevel((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM)),
    [],
  );
  const handleZoomOut = useCallback(
    () => setZoomLevel((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM)),
    [],
  );
  const handleZoomReset = useCallback(() => setZoomLevel(DEFAULT_ZOOM), []);
  const handleExpand = useCallback(() => setIsExpanded(true), []);
  const handleCollapse = useCallback(() => {
    setIsExpanded(false);
    onExpandClose?.();
  }, [onExpandClose]);

  const isWelcomeOnly = useMemo(
    () =>
      messages.length === 1 &&
      messages[0]?.role === 'assistant' &&
      LANGUAGES.some((l) => t(l.code).welcome === messages[0]?.content),
    [messages],
  );

  const hasAssistantContent = useMemo(
    () => messages.some((m) => m.role === 'assistant' && m.content),
    [messages],
  );

  return (
    <>
      {/* Expanded fullscreen view */}
      {isExpanded && (
        <ExpandedMarkdownView
          messages={messages}
          onClose={handleCollapse}
          onSendMessage={onSendMessage}
          isGenerating={isGenerating}
          language={language}
        />
      )}

      <div className="relative flex-1 overflow-hidden">
        <div
          className="scrollbar-thin h-full overflow-y-auto"
          dir={dir}
          style={zoomLevel !== DEFAULT_ZOOM ? { zoom: zoomLevel } : undefined}
        >
          {messages.map((msg, msgIndex) => {
            const isUser = msg.role === 'user';
            const isLastAssistant = !isUser && msgIndex === messages.length - 1;
            const isStreaming = isGenerating && isLastAssistant;

            return (
              <MessageItem
                key={msg.id}
                msg={msg}
                isStreaming={isStreaming}
                isGenerating={isGenerating}
                onSendMessage={onSendMessage}
                onFormSubmit={onFormSubmit}
                onExpand={handleExpand}
                language={language}
              />
            );
          })}

          {/* Suggested questions — shown after welcome message only */}
          {isWelcomeOnly && (
            <div className="px-3 py-4 sm:px-4 sm:py-6 md:px-8 lg:px-12">
              <div
                className="cybernus-fade-in-up mx-auto grid max-w-3xl gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"
                style={{ animationDelay: '200ms' }}
              >
                {SUGGESTED_QUESTIONS.map((q, idx) => (
                  <button
                    key={q.label}
                    onClick={() => onSendMessage(q.prompt)}
                    disabled={isGenerating}
                    className="group relative overflow-hidden rounded-xl border border-[#00ff41]/10 bg-[#0a0a0a]/80 p-3.5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-[#00ff41]/30 hover:shadow-lg hover:shadow-[#00ff41]/5 disabled:opacity-50"
                    style={{ animationDelay: `${(idx + 1) * 60}ms` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-[#00ff41]/[0.03] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="relative">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="text-base leading-none">{q.icon}</span>
                        <span className="text-[13px] font-semibold text-[#00ff41]/90 transition-colors group-hover:text-[#00ff41]">
                          {q.label}
                        </span>
                      </div>
                      <p className="text-text-muted line-clamp-2 text-[11px] leading-relaxed transition-colors group-hover:text-gray-400">
                        {q.prompt}
                      </p>
                    </div>
                    <ArrowRight className="absolute right-2.5 bottom-2.5 h-3 w-3 text-[#00ff41]/0 transition-all duration-300 group-hover:text-[#00ff41]/40" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} className="h-6" />
        </div>

        {/* Zoom controls — shown when there's assistant content */}
        {hasAssistantContent && (
          <ZoomControls
            zoomLevel={zoomLevel}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
            onExpand={handleExpand}
          />
        )}
      </div>
    </>
  );
}
