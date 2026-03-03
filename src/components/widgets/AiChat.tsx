import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  Loader2,
  AlertCircle,
  Sparkles,
  Trash2,
  Send,
  Cpu,
  Square,
  ExternalLink,
  ArrowRight,
  Star,
  X,
} from 'lucide-react';
import { cn } from '@lib/utils/cn';
import {
  DEFAULT_MODEL_ID,
  AVAILABLE_MODELS,
  GROUP_INFO,
  GENERATION_CONFIG,
  SUGGESTED_QUESTIONS,
  WELCOME_MESSAGE,
  isWebGPUSupported,
  trimHistory,
} from '@lib/ai/config';
import type { ModelInfo, ModelGroup } from '@lib/ai/config';
import type { MLCEngineInterface } from '@mlc-ai/web-llm';
import type { ChatMessage, SearchIndex } from '@lib/ai/types';
import { renderMarkdown } from '@lib/ai/markdown';
import { saveMessages, loadMessages, clearMessages } from '@lib/ai/memory';
import { fetchRuntimeContext } from '@lib/ai/context';
import { searchIndex, formatRetrievedContext } from '@lib/ai/rag';
import { parseActions, executeAction } from '@lib/ai/tools';
import { maybeSummarize } from '@lib/ai/summarize';

/* ─── Types ─── */

type EngineState = 'checking' | 'unsupported' | 'idle' | 'loading' | 'ready' | 'error';

interface Props {
  systemPrompt: string;
  searchIndex: SearchIndex;
}

/* ─── Component ─── */

export default function AiChat({ systemPrompt, searchIndex: ragIndex }: Props) {
  const [engineState, setEngineState] = useState<EngineState>('checking');
  const [loadProgress, setLoadProgress] = useState({ text: '', progress: 0 });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
  const [cacheMap, setCacheMap] = useState<Record<string, boolean>>({});
  const [isDeletingModel, setIsDeletingModel] = useState<string | null>(null);

  const engineRef = useRef<MLCEngineInterface | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);
  const activeModelRef = useRef<string | null>(null);

  /** Check WebGPU support and probe cache status for all models. */
  useEffect(() => {
    isWebGPUSupported().then(async (supported) => {
      if (!supported) {
        setEngineState('unsupported');
        return;
      }
      const { hasModelInCache } = await import('@mlc-ai/web-llm');
      const entries = await Promise.all(
        AVAILABLE_MODELS.map(async (m) => [m.id, await hasModelInCache(m.id)] as const),
      );
      setCacheMap(Object.fromEntries(entries));
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
        selectedModelId,
        { initProgressCallback: (r) => setLoadProgress({ text: r.text, progress: r.progress }) },
      );
      engineRef.current = engine;
      activeModelRef.current = selectedModelId;

      // Restore persisted chat or show welcome message
      const saved = loadMessages();
      if (saved.length > 0) {
        setMessages(saved);
      } else {
        setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: WELCOME_MESSAGE }]);
      }

      setEngineState('ready');
      setCacheMap((prev) => ({ ...prev, [selectedModelId]: true }));
    } catch (err) {
      console.error('[AiChat] Engine init failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load AI model');
      setEngineState('error');
    }
  }, [selectedModelId]);

  const deleteModel = useCallback(async (modelId: string) => {
    setIsDeletingModel(modelId);
    try {
      const { deleteModelAllInfoInCache } = await import('@mlc-ai/web-llm');
      await deleteModelAllInfoInCache(modelId);
      setCacheMap((prev) => ({ ...prev, [modelId]: false }));
    } catch (err) {
      console.error('[AiChat] Failed to delete model:', err);
    } finally {
      setIsDeletingModel(null);
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
        // 1. Summarize old messages if conversation is long
        const currentMessages = await maybeSummarize(engine, [...messages, userMsg]);

        // 2. Retrieve relevant chunks via RAG
        const ragResults = searchIndex(text.trim(), ragIndex);
        const ragContext = formatRetrievedContext(ragResults);

        // 3. Fetch live runtime context (recent activity)
        const runtimeContext = await fetchRuntimeContext();

        // 4. Build augmented system prompt
        const augmentedPrompt = systemPrompt + ragContext + runtimeContext;

        // 5. Prepare trimmed history
        const fullHistory = currentMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
        const history = trimHistory(fullHistory);

        // 6. Stream the response
        const chunks = await engine.chat.completions.create({
          messages: [{ role: 'system', content: augmentedPrompt }, ...history],
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

        // 7. Parse tool actions from the final response
        const { text: cleanText, actions } = parseActions(full);
        if (actions.length > 0 || cleanText !== full) {
          setMessages((prev) =>
            prev.map((m) => (m.id === asstMsg.id ? { ...m, content: cleanText, actions } : m)),
          );
        }

        // 8. Persist to localStorage
        setMessages((prev) => {
          saveMessages(prev);
          return prev;
        });
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
    [messages, isGenerating, systemPrompt, ragIndex],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };
  const clearChat = () => {
    abortRef.current = true;
    setIsGenerating(false);
    clearMessages();
    setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: WELCOME_MESSAGE }]);
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
    const selectedModel = AVAILABLE_MODELS.find((m) => m.id === selectedModelId);
    const groups: ModelGroup[] = ['top', 'more'];
    return (
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-border shrink-0 border-b px-6 py-5 text-center">
          <div className="bg-accent/10 mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl">
            <Sparkles className="text-accent h-6 w-6" />
          </div>
          <h2 className="text-text-primary mb-1 text-lg font-bold">Choose a Model</h2>
          <p className="text-text-secondary text-xs">
            All models run 100% in your browser via WebGPU — no data leaves your device
          </p>
        </div>

        {/* Model grid grouped: Top Picks first, then More Models */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
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
          </div>
        </div>

        {/* Sticky footer with start button */}
        <div className="border-border shrink-0 border-t px-6 py-4 text-center">
          <button
            onClick={initEngine}
            className="bg-accent text-bg-base hover:bg-accent-hover rounded-xl px-8 py-3 text-sm font-semibold transition-colors"
          >
            {cacheMap[selectedModelId] ? 'Start Chat' : 'Download & Start'}
            {selectedModel && !cacheMap[selectedModelId] && (
              <span className="ml-1.5 opacity-70">({selectedModel.downloadSize})</span>
            )}
          </button>
          <p className="text-text-muted mt-2 text-[10px]">Powered by WebLLM · No server required</p>
        </div>
      </div>
    );
  }

  if (engineState === 'loading') {
    const loadingModel = AVAILABLE_MODELS.find((m) => m.id === selectedModelId);
    return (
      <CenterCard>
        <Cpu className="text-accent mb-4 h-10 w-10 animate-pulse" />
        <h2 className="text-text-primary mb-1 text-lg font-semibold">
          Loading {loadingModel?.name ?? 'AI Model'}
        </h2>
        <p className="text-text-muted mb-4 text-xs">
          {cacheMap[selectedModelId] ? 'Initializing from cache…' : 'Downloading and compiling…'}
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
  const activeModel = AVAILABLE_MODELS.find((m) => m.id === activeModelRef.current);
  return (
    <div className="flex h-full flex-col">
      {/* Status bar */}
      <div className="border-border flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="bg-status-active h-2 w-2 rounded-full" />
          <span className="text-text-muted text-xs">
            {activeModel?.name ?? 'AI'} · Running in browser
          </span>
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

                {/* Tool action buttons */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
                    {msg.actions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => executeAction(action)}
                        className="bg-bg-base/30 hover:bg-bg-base/50 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs transition-colors"
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

/* ─── Layout helpers ─── */

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-lg flex-col items-center text-center">{children}</div>
    </div>
  );
}

const QUALITY_COLORS: Record<ModelInfo['quality'], string> = {
  basic: 'text-text-muted',
  good: 'text-blue-400',
  great: 'text-purple-400',
  best: 'text-amber-400',
};

function ModelCard({
  model,
  isSelected,
  isCached,
  isDeleting,
  onSelect,
  onDelete,
}: {
  model: ModelInfo;
  isSelected: boolean;
  isCached: boolean;
  isDeleting: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
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
