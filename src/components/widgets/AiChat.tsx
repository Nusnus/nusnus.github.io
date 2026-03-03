import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  Loader2,
  AlertCircle,
  Sparkles,
  Trash2,
  Send,
  Download,
  Cpu,
  Square,
} from 'lucide-react';
import { cn } from '@lib/utils/cn';
import {
  DEFAULT_MODEL_ID,
  MODEL_DOWNLOAD_SIZE_LABEL,
  GENERATION_CONFIG,
  SUGGESTED_QUESTIONS,
  WELCOME_MESSAGE,
  isWebGPUSupported,
  trimHistory,
} from '@lib/ai/config';
import type { MLCEngineInterface } from '@mlc-ai/web-llm';
import { renderMarkdown } from '@lib/ai/markdown';

/* ─── Types ─── */

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

type EngineState = 'checking' | 'unsupported' | 'idle' | 'loading' | 'ready' | 'error';

interface Props {
  systemPrompt: string;
  fullPage?: boolean;
}

/* ─── Component ─── */

export default function AiChat({ systemPrompt }: Props) {
  const [engineState, setEngineState] = useState<EngineState>('checking');
  const [loadProgress, setLoadProgress] = useState({ text: '', progress: 0 });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isCached, setIsCached] = useState(false);

  const engineRef = useRef<MLCEngineInterface | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    isWebGPUSupported().then(async (supported) => {
      if (!supported) {
        setEngineState('unsupported');
        return;
      }
      const { hasModelInCache } = await import('@mlc-ai/web-llm');
      setIsCached(await hasModelInCache(DEFAULT_MODEL_ID));
      setEngineState('idle');
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (engineState === 'ready') inputRef.current?.focus();
  }, [engineState]);

  const initEngine = useCallback(async () => {
    setEngineState('loading');
    setErrorMsg('');
    setLoadProgress({ text: 'Initializing…', progress: 0 });
    try {
      const webllm = await import('@mlc-ai/web-llm');
      const engine = await webllm.CreateWebWorkerMLCEngine(
        new Worker(new URL('../../lib/ai/worker.ts', import.meta.url), { type: 'module' }),
        DEFAULT_MODEL_ID,
        { initProgressCallback: (r) => setLoadProgress({ text: r.text, progress: r.progress }) },
      );
      engineRef.current = engine;
      setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: WELCOME_MESSAGE }]);
      setEngineState('ready');
      setIsCached(true);
    } catch (err) {
      console.error('[AiChat] Engine init failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load AI model');
      setEngineState('error');
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const engine = engineRef.current;
      if (!engine || !text.trim() || isGenerating) return;
      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text.trim() };
      const asstMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '' };
      setMessages((prev) => [...prev, userMsg, asstMsg]);
      setInput('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
      setIsGenerating(true);
      abortRef.current = false;
      try {
        const fullHistory = [...messages, userMsg].map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
        const history = trimHistory(fullHistory);
        const chunks = await engine.chat.completions.create({
          messages: [{ role: 'system', content: systemPrompt }, ...history],
          stream: true,
          ...GENERATION_CONFIG,
        });
        let full = '';
        for await (const chunk of chunks) {
          if (abortRef.current) break;
          full += chunk.choices[0]?.delta?.content ?? '';
          const content = full;
          setMessages((prev) => prev.map((m) => (m.id === asstMsg.id ? { ...m, content } : m)));
        }
      } catch (err) {
        console.error('[AiChat] Generation error:', err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstMsg.id
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

  /* ─── Render ─── */
  const pct = Math.round(loadProgress.progress * 100);

  if (engineState === 'checking') {
    return (
      <CenterCard>
        <Loader2 className="text-accent h-8 w-8 animate-spin" />
      </CenterCard>
    );
  }

  if (engineState === 'unsupported') {
    return (
      <CenterCard>
        <AlertCircle className="text-text-muted mb-3 h-10 w-10" />
        <h2 className="text-text-primary mb-2 text-lg font-semibold">WebGPU Not Available</h2>
        <p className="text-text-secondary text-sm">
          AI Chat requires WebGPU, which is supported in Chrome and Edge.
          <br />
          Please switch to a supported browser to use this feature.
        </p>
      </CenterCard>
    );
  }

  if (engineState === 'idle') {
    return (
      <CenterCard>
        <div className="bg-accent/10 mb-5 flex h-16 w-16 items-center justify-center rounded-2xl">
          <Sparkles className="text-accent h-8 w-8" />
        </div>
        <h2 className="text-text-primary mb-2 text-xl font-bold">Ask AI about Tomer</h2>
        <p className="text-text-secondary mb-6 max-w-md text-sm leading-relaxed">
          Chat with an AI assistant that knows about Tomer&apos;s work, open source contributions,
          and projects. The model runs entirely in your browser — no data leaves your device.
        </p>
        {!isCached && (
          <div className="bg-bg-surface border-border mb-4 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs">
            <Download className="text-text-muted h-4 w-4 shrink-0" />
            <span className="text-text-secondary">
              First use downloads {MODEL_DOWNLOAD_SIZE_LABEL} (cached for future visits)
            </span>
          </div>
        )}
        {isCached && (
          <div className="bg-status-active/10 mb-4 flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs">
            <span className="bg-status-active h-2 w-2 rounded-full" />
            <span className="text-status-active font-medium">Model cached — instant start</span>
          </div>
        )}
        <button
          onClick={initEngine}
          className="bg-accent text-bg-base hover:bg-accent-hover rounded-xl px-8 py-3 text-sm font-semibold transition-colors"
        >
          {isCached ? 'Start Chat' : 'Download & Start'}
        </button>
        <p className="text-text-muted mt-5 max-w-sm text-center text-[10px] leading-relaxed">
          Powered by WebLLM · Qwen2.5-7B running via WebGPU · No server required
        </p>
      </CenterCard>
    );
  }

  if (engineState === 'loading') {
    return (
      <CenterCard>
        <Cpu className="text-accent mb-4 h-10 w-10 animate-pulse" />
        <h2 className="text-text-primary mb-1 text-lg font-semibold">Loading AI Model</h2>
        <p className="text-text-muted mb-4 text-xs">
          {isCached ? 'Initializing from cache…' : 'Downloading and compiling…'}
        </p>
        <div className="bg-bg-elevated mb-2 h-2.5 w-full max-w-xs overflow-hidden rounded-full">
          <div
            className="bg-accent h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-text-muted font-mono text-xs">{pct}%</p>
        <p className="text-text-muted mt-2 max-w-xs text-center text-[10px] leading-relaxed">
          {loadProgress.text}
        </p>
      </CenterCard>
    );
  }

  if (engineState === 'error') {
    return (
      <CenterCard>
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
          <AlertCircle className="h-7 w-7 text-red-400" />
        </div>
        <h2 className="text-text-primary mb-2 text-lg font-semibold">Failed to Load</h2>
        <p className="text-text-secondary mb-4 max-w-sm text-center text-xs leading-relaxed">
          {errorMsg}
        </p>
        <button
          onClick={initEngine}
          className="bg-accent text-bg-base hover:bg-accent-hover rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors"
        >
          Try Again
        </button>
      </CenterCard>
    );
  }

  /* ─── Chat UI (engineState === 'ready') ─── */
  return (
    <div className="flex h-full flex-col">
      {/* Status bar */}
      <div className="border-border flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="bg-status-active h-2 w-2 rounded-full" />
          <span className="text-text-muted text-xs">Qwen2.5-7B · Running in browser</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-text-muted hover:text-text-secondary flex items-center gap-1 text-xs transition-colors"
            aria-label="Clear chat"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                  msg.role === 'user'
                    ? 'bg-accent/20 text-accent'
                    : 'bg-bg-elevated text-text-secondary',
                )}
              >
                {msg.role === 'user' ? 'You' : <Bot className="h-4 w-4" />}
              </div>
              <div
                className={cn(
                  'max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-accent text-bg-base rounded-br-md'
                    : 'bg-bg-surface text-text-primary rounded-bl-md',
                )}
              >
                {!msg.content ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="bg-text-muted inline-block h-1.5 w-1.5 animate-pulse rounded-full" />
                    <span className="bg-text-muted inline-block h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:150ms]" />
                    <span className="bg-text-muted inline-block h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:300ms]" />
                  </span>
                ) : msg.role === 'assistant' ? (
                  renderMarkdown(msg.content)
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {/* Suggested questions — shown after welcome message only */}
          {messages.length === 1 && messages[0]?.role === 'assistant' && (
            <div className="mx-auto grid max-w-lg gap-2 pt-2 sm:grid-cols-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={isGenerating}
                  className="bg-bg-surface hover:bg-bg-elevated border-border text-text-secondary hover:text-text-primary rounded-xl border px-4 py-3 text-left text-xs leading-relaxed transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-border border-t px-4 py-3">
        <div className="mx-auto max-w-2xl">
          <div className="bg-bg-surface border-border flex items-end gap-2 rounded-xl border px-4 py-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-resize
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about Tomer…"
              rows={1}
              className="text-text-primary placeholder:text-text-muted max-h-32 flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none"
              disabled={isGenerating}
              aria-label="Chat message input"
            />
            {isGenerating ? (
              <button
                onClick={() => {
                  abortRef.current = true;
                  setIsGenerating(false);
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20"
                aria-label="Stop generating"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                  input.trim()
                    ? 'bg-accent text-bg-base hover:bg-accent-hover'
                    : 'text-text-muted cursor-not-allowed',
                )}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-text-muted mt-2 px-1 text-[10px]">
            AI runs locally in your browser via WebGPU · Responses may be inaccurate
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Layout helper ─── */

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-lg flex-col items-center text-center">{children}</div>
    </div>
  );
}
