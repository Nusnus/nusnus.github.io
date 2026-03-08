import { type RefObject, useMemo, useCallback, useState } from 'react';
import {
  ArrowRight,
  ExternalLink,
  Globe,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@lib/utils/cn';
import { SUGGESTED_QUESTIONS } from '@lib/ai/config';
import type { ChatMessage } from '@lib/ai/types';
import { renderMarkdown } from '@lib/ai/markdown';
import { executeAction } from '@lib/ai/tools';
import type { Language } from '@lib/ai/i18n';
import { t } from '@lib/ai/i18n';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onSendMessage: (text: string) => void;
  language: Language;
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

/** Skeleton loading shimmer for streaming messages. */
function SkeletonLoader() {
  return (
    <div className="space-y-2.5 py-1">
      <div className="cybernus-shimmer h-3.5 w-4/5 rounded-md bg-white/[0.04]" />
      <div className="cybernus-shimmer h-3.5 w-3/5 rounded-md bg-white/[0.04] [animation-delay:200ms]" />
      <div className="cybernus-shimmer h-3.5 w-2/3 rounded-md bg-white/[0.04] [animation-delay:400ms]" />
    </div>
  );
}

/** Animated typing indicator dots. */
function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 py-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400/60 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400/50 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400/40 [animation-delay:300ms]" />
    </span>
  );
}

/** Web search status indicator. */
function SearchIndicator({
  status,
  strings,
}: {
  status: 'searching' | 'found';
  strings: ReturnType<typeof t>;
}) {
  const isSearching = status === 'searching';
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-medium backdrop-blur-sm',
        isSearching
          ? 'border border-white/[0.06] bg-white/[0.03] text-white/60'
          : 'border border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400',
      )}
    >
      <Globe className={cn('h-3.5 w-3.5', isSearching && 'animate-spin')} />
      <span>{isSearching ? strings.searchingWeb : strings.foundResults}</span>
      {isSearching && (
        <span className="inline-flex gap-0.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="inline-block h-1 w-1 animate-bounce rounded-full bg-white/30"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
      )}
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
    'flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className="bg-bg-base/90 absolute right-4 bottom-4 z-10 flex items-center gap-0.5 rounded-xl border border-white/[0.08] px-1 py-1 shadow-lg backdrop-blur-md">
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
        className="flex h-7 min-w-[3rem] items-center justify-center rounded-md px-1 text-[10px] font-medium text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white/70"
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
      <div className="mx-0.5 h-4 w-px bg-white/10" />
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
  const strings = t(language);
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

  const zoomBtnClass =
    'flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className="bg-bg-base fixed inset-0 z-50 flex flex-col" dir={dir}>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-6 py-3">
        <span className="text-sm font-medium text-white/70">Expanded View</span>
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
          <span className="min-w-[3rem] text-center text-xs text-white/40">
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
          <div className="mx-1 h-5 w-px bg-white/10" />
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/80"
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

            if (!msg.content && !msg.searchStatus && !isStreamingMsg) return null;

            return (
              <div
                key={msg.id}
                className={cn('px-6 py-8 md:px-12 lg:px-20', isUser ? 'bg-white/[0.015]' : '')}
              >
                <div className="mx-auto flex max-w-4xl gap-5">
                  {/* Avatar */}
                  <div className="shrink-0 pt-0.5">
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg',
                        isUser
                          ? 'bg-gradient-to-br from-white/10 to-white/5 ring-1 ring-white/10'
                          : 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/20',
                      )}
                    >
                      {isUser ? (
                        <svg
                          className="h-4 w-4 text-white/70"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      ) : (
                        <Sparkles className="h-4 w-4 text-emerald-400" />
                      )}
                    </div>
                  </div>

                  {/* Message body */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'mb-2.5 text-xs font-semibold tracking-wide',
                        isUser ? 'text-white/50' : 'text-emerald-400/80',
                      )}
                    >
                      {isUser ? 'You' : 'Cybernus'}
                    </p>
                    <div className="text-[15px] leading-relaxed text-white/85">
                      {msg.searchStatus ? (
                        <SearchIndicator status={msg.searchStatus} strings={strings} />
                      ) : !msg.content ? (
                        isStreamingMsg ? (
                          <SkeletonLoader />
                        ) : (
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
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-emerald-400/90 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/[0.06]"
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-1.5 text-xs font-medium text-emerald-400/80 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/[0.08] hover:text-emerald-300 disabled:opacity-40"
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

/** Renders the scrollable message list — ChatGPT-style full-width layout. */
export function ChatMessages({
  messages,
  isGenerating,
  messagesEndRef,
  onSendMessage,
  language,
}: ChatMessagesProps) {
  const strings = t(language);
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
  const handleCollapse = useCallback(() => setIsExpanded(false), []);

  const isWelcomeOnly = useMemo(
    () => messages.length === 1 && messages[0]?.role === 'assistant',
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
              <div
                key={msg.id}
                className={cn('group px-4 py-6 md:px-8 lg:px-12', isUser ? 'bg-white/[0.015]' : '')}
              >
                <div className="mx-auto flex max-w-3xl gap-4">
                  {/* Avatar */}
                  <div className="relative shrink-0 pt-0.5">
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg',
                        isUser
                          ? 'bg-gradient-to-br from-white/10 to-white/5 ring-1 ring-white/10'
                          : 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/20',
                      )}
                    >
                      {isUser ? (
                        <svg
                          className="h-3.5 w-3.5 text-white/70"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                      )}
                    </div>
                    {isStreaming && (
                      <div className="absolute -inset-1 animate-pulse rounded-lg ring-1 ring-emerald-500/30" />
                    )}
                  </div>

                  {/* Message body */}
                  <div className="min-w-0 flex-1">
                    {/* Role label */}
                    <p
                      className={cn(
                        'mb-2 text-xs font-semibold tracking-wide',
                        isUser ? 'text-white/50' : 'text-emerald-400/80',
                      )}
                    >
                      {isUser ? 'You' : 'Cybernus'}
                    </p>

                    {/* Content */}
                    <div className="text-sm leading-relaxed text-white/85">
                      {msg.searchStatus ? (
                        <SearchIndicator status={msg.searchStatus} strings={strings} />
                      ) : !msg.content ? (
                        isStreaming ? (
                          <SkeletonLoader />
                        ) : (
                          <TypingIndicator />
                        )
                      ) : !isUser ? (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={handleExpand}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') handleExpand();
                          }}
                          className="group/zoom relative cursor-zoom-in rounded-lg transition-colors hover:bg-white/[0.02]"
                          title="Click to expand"
                        >
                          <div className="pointer-events-none absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06] text-white/0 opacity-0 backdrop-blur-sm transition-all group-hover/zoom:text-white/50 group-hover/zoom:opacity-100">
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
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-emerald-400/90 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/[0.06]"
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
                  </div>
                </div>
              </div>
            );
          })}

          {/* Suggested questions — shown after welcome message only */}
          {isWelcomeOnly && (
            <div className="px-4 py-4 md:px-8 lg:px-12">
              <div
                className="cybernus-fade-in-up mx-auto grid max-w-3xl gap-2.5 sm:grid-cols-2"
                style={{ animationDelay: '200ms' }}
              >
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => onSendMessage(q)}
                    disabled={isGenerating}
                    className="group rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 text-left text-[13px] leading-relaxed text-white/50 transition-all hover:border-emerald-500/20 hover:bg-emerald-500/[0.03] hover:text-white/70"
                  >
                    <span>{q}</span>
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
