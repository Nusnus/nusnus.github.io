import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Bot,
  Loader2,
  AlertCircle,
  Sparkles,
  Trash2,
  Download,
} from 'lucide-react';
import { cn } from '@lib/utils/cn';
import {
  DEFAULT_MODEL_ID,
  MODEL_DOWNLOAD_SIZE_LABEL,
  GENERATION_CONFIG,
  SUGGESTED_QUESTIONS,
  isWebGPUSupported,
} from '@lib/ai/config';
import type { MLCEngineInterface } from '@mlc-ai/web-llm';

/* ─── Types ─── */

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

type EngineState = 'idle' | 'loading' | 'ready' | 'error';

interface Props {
  /** System prompt built at build time from site data. */
  systemPrompt: string;
}

/* ─── Component ─── */

export default function AiChat({ systemPrompt }: Props) {
  /* State */
  const [supported, setSupported] = useState<boolean | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [engineState, setEngineState] = useState<EngineState>('idle');
  const [loadProgress, setLoadProgress] = useState({ text: '', progress: 0 });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isCached, setIsCached] = useState(false);

  /* Refs */
  const engineRef = useRef<MLCEngineInterface | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);

  /* ─── Effects ─── */

  // Check WebGPU support on mount
  useEffect(() => {
    isWebGPUSupported().then(setSupported);
  }, []);

  // Check if model is cached
  useEffect(() => {
    if (supported) {
      import('@mlc-ai/web-llm').then(({ hasModelInCache }) => {
        hasModelInCache(DEFAULT_MODEL_ID).then(setIsCached);
      });
    }
  }, [supported]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat becomes ready
  useEffect(() => {
    if (engineState === 'ready' && panelOpen) {
      inputRef.current?.focus();
    }
  }, [engineState, panelOpen]);

  // Keyboard: Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && panelOpen) setPanelOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [panelOpen]);

  /* ─── Engine lifecycle ─── */

  const initEngine = useCallback(async () => {
    setEngineState('loading');
    setErrorMsg('');
    setLoadProgress({ text: 'Initializing…', progress: 0 });

    try {
      const webllm = await import('@mlc-ai/web-llm');

      const engine = await webllm.CreateWebWorkerMLCEngine(
        new Worker(new URL('../../lib/ai/worker.ts', import.meta.url), { type: 'module' }),
        DEFAULT_MODEL_ID,
        {
          initProgressCallback: (report) => {
            setLoadProgress({ text: report.text, progress: report.progress });
          },
        },
      );

      engineRef.current = engine;
      setEngineState('ready');
      setIsCached(true);
    } catch (err) {
      console.error('[AiChat] Engine init failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load AI model');
      setEngineState('error');
    }
  }, []);

  /* ─── Chat logic ─── */

  const sendMessage = useCallback(
    async (text: string) => {
      const engine = engineRef.current;
      if (!engine || !text.trim() || isGenerating) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text.trim(),
      };

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      setIsGenerating(true);
      abortRef.current = false;

      try {
        const history = [...messages, userMsg].map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        const chunks = await engine.chat.completions.create({
          messages: [{ role: 'system', content: systemPrompt }, ...history],
          stream: true,
          ...GENERATION_CONFIG,
        });

        let fullContent = '';
        for await (const chunk of chunks) {
          if (abortRef.current) break;
          const delta = chunk.choices[0]?.delta?.content ?? '';
          fullContent += delta;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: fullContent } : m)),
          );
        }
      } catch (err) {
        console.error('[AiChat] Generation error:', err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: 'Sorry, something went wrong. Please try again.' }
              : m,
          ),
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [messages, isGenerating, systemPrompt],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    abortRef.current = true;
    setIsGenerating(false);
  };

  /* ─── Unsupported browser: show subtle hint ─── */

  if (supported === null) return null;

  if (supported === false) {
    return (
      <div className="fixed right-6 bottom-6 z-50">
        <div className="bg-bg-surface/90 border-border flex items-center gap-2 rounded-full border px-3 py-2 shadow-lg backdrop-blur-sm">
          <MessageCircle className="text-text-muted h-4 w-4" />
          <span className="text-text-muted text-[11px]">AI Chat available on Chrome / Edge</span>
        </div>
      </div>
    );
  }

  /* ─── FAB (Floating Action Button) ─── */

  return (
    <>
      {/* Backdrop */}
      {panelOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity md:hidden"
          onClick={() => setPanelOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* FAB */}
      <button
        onClick={() => setPanelOpen((o) => !o)}
        className={cn(
          'fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center',
          'rounded-full shadow-lg transition-all duration-300',
          'bg-accent text-bg-base hover:bg-accent-hover',
          'focus-visible:ring-accent focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          panelOpen && 'scale-0 opacity-0',
        )}
        aria-label={panelOpen ? 'Close AI chat' : 'Open AI chat'}
        aria-expanded={panelOpen}
      >
        <MessageCircle className="h-6 w-6" />
        {isCached && engineState === 'idle' && (
          <span className="bg-status-active absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white" />
        )}
      </button>

      {/* Chat Panel */}
      <div
        className={cn(
          'fixed z-50 flex flex-col overflow-hidden',
          'bg-bg-base/95 border-border border backdrop-blur-xl',
          'shadow-2xl transition-all duration-300 ease-out',
          // Desktop: bottom-right floating panel
          'right-6 bottom-6 max-h-[min(600px,calc(100vh-3rem))] w-[400px] rounded-2xl',
          // Mobile: full-screen
          'max-md:inset-0 max-md:right-0 max-md:bottom-0 max-md:max-h-full max-md:w-full max-md:rounded-none',
          panelOpen
            ? 'pointer-events-auto scale-100 opacity-100'
            : 'pointer-events-none scale-95 opacity-0',
        )}
        role="dialog"
        aria-label="AI Chat"
        aria-hidden={!panelOpen}
      >
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="text-accent h-5 w-5" />
            <span className="text-text-primary text-sm font-semibold">Ask AI about Tomer</span>
            {engineState === 'ready' && (
              <span className="bg-status-active/20 text-status-active rounded-full px-2 py-0.5 text-[10px] font-medium">
                Online
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {engineState === 'ready' && messages.length > 0 && (
              <button
                onClick={clearChat}
                className="text-text-muted hover:text-text-secondary rounded-lg p-1.5 transition-colors"
                aria-label="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setPanelOpen(false)}
              className="text-text-muted hover:text-text-secondary rounded-lg p-1.5 transition-colors"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {engineState === 'idle' && <WelcomeScreen onStart={initEngine} isCached={isCached} />}
          {engineState === 'loading' && <LoadingScreen progress={loadProgress} />}
          {engineState === 'error' && <ErrorScreen message={errorMsg} onRetry={initEngine} />}
          {engineState === 'ready' && (
            <ChatView
              messages={messages}
              isGenerating={isGenerating}
              onSuggestedClick={(q) => sendMessage(q)}
              messagesEndRef={messagesEndRef}
            />
          )}
        </div>

        {/* Input */}
        {engineState === 'ready' && (
          <div className="border-border border-t p-3">
            <div className="bg-bg-surface border-border flex items-end gap-2 rounded-xl border px-3 py-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about Tomer…"
                rows={1}
                className="text-text-primary placeholder:text-text-muted max-h-24 flex-1 resize-none bg-transparent text-sm outline-none"
                disabled={isGenerating}
                aria-label="Chat message input"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isGenerating}
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                  input.trim() && !isGenerating
                    ? 'bg-accent text-bg-base hover:bg-accent-hover'
                    : 'text-text-muted cursor-not-allowed',
                )}
                aria-label="Send message"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-text-muted mt-1.5 px-1 text-[10px]">
              AI runs in your browser via WebGPU · Responses may be inaccurate
            </p>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Sub-components ─── */

function WelcomeScreen({ onStart, isCached }: { onStart: () => void; isCached: boolean }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="bg-accent-muted mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
        <Sparkles className="text-accent h-7 w-7" />
      </div>
      <h3 className="text-text-primary mb-2 text-lg font-semibold">AI Chat</h3>
      <p className="text-text-secondary mb-6 text-sm leading-relaxed">
        Chat with an AI assistant that knows about Tomer's work, open source contributions, and
        projects. Powered by a language model running entirely in your browser.
      </p>

      {!isCached && (
        <div className="bg-bg-surface border-border mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
          <Download className="text-text-muted h-3.5 w-3.5 shrink-0" />
          <span className="text-text-secondary">
            First use requires a one-time download of {MODEL_DOWNLOAD_SIZE_LABEL}
          </span>
        </div>
      )}

      {isCached && (
        <div className="bg-status-active/10 mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs">
          <span className="bg-status-active h-2 w-2 rounded-full" />
          <span className="text-status-active">Model cached — instant start</span>
        </div>
      )}

      <button
        onClick={onStart}
        className="bg-accent text-bg-base hover:bg-accent-hover w-full rounded-xl px-6 py-3 text-sm font-semibold transition-colors"
      >
        {isCached ? 'Start Chat' : 'Download & Start'}
      </button>

      <p className="text-text-muted mt-4 text-[10px] leading-relaxed">
        No data is sent to any server. The AI model runs locally via WebGPU.
      </p>
    </div>
  );
}

function LoadingScreen({ progress }: { progress: { text: string; progress: number } }) {
  const pct = Math.round(progress.progress * 100);
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <Loader2 className="text-accent mb-4 h-10 w-10 animate-spin" />
      <h3 className="text-text-primary mb-2 text-sm font-semibold">Loading AI Model</h3>

      {/* Progress bar */}
      <div className="bg-bg-elevated mb-3 h-2 w-full overflow-hidden rounded-full">
        <div
          className="bg-accent h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-text-muted text-xs">
        {pct}% — {progress.text}
      </p>
      <p className="text-text-muted mt-4 text-[10px]">
        This may take a moment on first load. The model will be cached for future visits.
      </p>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
        <AlertCircle className="h-7 w-7 text-red-400" />
      </div>
      <h3 className="text-text-primary mb-2 text-sm font-semibold">Failed to Load</h3>
      <p className="text-text-secondary mb-4 text-xs leading-relaxed">{message}</p>
      <button
        onClick={onRetry}
        className="bg-accent text-bg-base hover:bg-accent-hover rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

function ChatView({
  messages,
  isGenerating,
  onSuggestedClick,
  messagesEndRef,
}: {
  messages: ChatMessage[];
  isGenerating: boolean;
  onSuggestedClick: (q: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {/* Empty state: suggested questions */}
      {messages.length === 0 && (
        <div className="py-4">
          <p className="text-text-muted mb-3 text-center text-xs">Try asking:</p>
          <div className="flex flex-col gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => onSuggestedClick(q)}
                disabled={isGenerating}
                className="bg-bg-surface hover:bg-bg-elevated border-border text-text-secondary hover:text-text-primary rounded-xl border px-3 py-2.5 text-left text-xs transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={cn('flex gap-2.5', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
        >
          {/* Avatar */}
          <div
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs',
              msg.role === 'user'
                ? 'bg-accent/20 text-accent'
                : 'bg-bg-elevated text-text-secondary',
            )}
          >
            {msg.role === 'user' ? 'You' : <Bot className="h-3.5 w-3.5" />}
          </div>

          {/* Bubble */}
          <div
            className={cn(
              'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
              msg.role === 'user'
                ? 'bg-accent text-bg-base rounded-br-md'
                : 'bg-bg-surface text-text-primary rounded-bl-md',
            )}
          >
            {msg.content || (
              <span className="inline-flex items-center gap-1">
                <span className="bg-text-muted inline-block h-1.5 w-1.5 animate-pulse rounded-full" />
                <span className="bg-text-muted inline-block h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:150ms]" />
                <span className="bg-text-muted inline-block h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:300ms]" />
              </span>
            )}
          </div>
        </div>
      ))}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  );
}
