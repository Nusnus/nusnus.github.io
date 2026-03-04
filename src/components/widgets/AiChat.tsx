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
  Cloud,
  Monitor,
  Zap,
} from 'lucide-react';
import { cn } from '@lib/utils/cn';
import {
  DEFAULT_MODEL_ID,
  AVAILABLE_MODELS,
  GROUP_INFO,
  CLOUD_MODELS,
  DEFAULT_CLOUD_MODEL_ID,
  GENERATION_CONFIG,
  SUGGESTED_QUESTIONS,
  WELCOME_MESSAGE,
  isWebGPUSupported,
  trimHistory,
} from '@lib/ai/config';
import type { ModelInfo, ModelGroup, ChatProvider } from '@lib/ai/config';
import type { MLCEngineInterface } from '@mlc-ai/web-llm';
import type { ChatMessage, SearchIndex } from '@lib/ai/types';
import { renderMarkdown } from '@lib/ai/markdown';
import {
  saveMessages,
  loadMessages,
  clearMessages,
  loadSessions,
  deleteSession,
  clearAllSessions,
  setActiveSessionId,
} from '@lib/ai/memory';
import type { ChatSession } from '@lib/ai/memory';
import { fetchRuntimeContext } from '@lib/ai/context';
import { searchIndex, formatRetrievedContext } from '@lib/ai/rag';
import {
  CLOUD_TOOLS,
  LOCAL_TOOLS_PROMPT_SECTION,
  mapToolCallsToActions,
  parseActions,
  executeAction,
} from '@lib/ai/tools';
import { maybeSummarize } from '@lib/ai/summarize';

/* ─── Constants ─── */

/** Maximum number of user messages per chat session before prompting new chat. */
const MAX_USER_MESSAGES = 10;

/* ─── Types ─── */

type EngineState = 'checking' | 'unsupported' | 'idle' | 'loading' | 'ready' | 'error';

interface Props {
  systemPrompt: string;
  searchIndex: SearchIndex;
}

/* ─── Component ─── */

export default function AiChat({ systemPrompt, searchIndex: ragIndex }: Props) {
  const [provider, setProvider] = useState<ChatProvider>('cloud');
  const [engineState, setEngineState] = useState<EngineState>('checking');
  const [loadProgress, setLoadProgress] = useState({ text: '', progress: 0 });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
  const [selectedCloudModelId, setSelectedCloudModelId] = useState(DEFAULT_CLOUD_MODEL_ID);
  const [cacheMap, setCacheMap] = useState<Record<string, boolean>>({});
  const [isDeletingModel, setIsDeletingModel] = useState<string | null>(null);
  const [webGPUSupported, setWebGPUSupported] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);

  const engineRef = useRef<MLCEngineInterface | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);
  const activeModelRef = useRef<string | null>(null);

  /** Detect ?roast=1 query param for 1-click roast from FAB. */
  const pendingRoast = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('roast') === '1') {
      pendingRoast.current = true;
      // Clean the URL so refresh doesn't re-trigger
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  /** Check WebGPU support and probe cache status for all models. */
  useEffect(() => {
    isWebGPUSupported().then(async (supported) => {
      setWebGPUSupported(supported);
      if (!supported) {
        // No WebGPU — cloud is the only option, go straight to idle
        setEngineState('idle');
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

  /** Whether there's a saved chat in localStorage. */
  const hasSavedChat = useRef(false);
  useEffect(() => {
    hasSavedChat.current = loadMessages().length > 0;
    setSessions(loadSessions());
  }, []);

  const initEngine = useCallback(
    async (startFresh = false) => {
      // If starting fresh, clear active session (don't delete it)
      if (startFresh) {
        clearMessages();
        setActiveSessionIdState(null);
      }

      const restoreMessages = () => {
        if (!startFresh) {
          const saved = loadMessages();
          if (saved.length > 0) {
            setMessages(saved);
            return;
          }
        }
        setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: WELCOME_MESSAGE }]);
      };

      // Cloud provider — no engine loading needed
      if (provider === 'cloud') {
        restoreMessages();
        setEngineState('ready');
        return;
      }

      // Local provider — load WebLLM engine
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

        restoreMessages();

        setEngineState('ready');
        setCacheMap((prev) => ({ ...prev, [selectedModelId]: true }));
      } catch (err) {
        console.error('[AiChat] Engine init failed:', err);
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load AI model');
        setEngineState('error');
      }
    },
    [provider, selectedModelId],
  );

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
      if (!text.trim() || isGenerating) return;

      // Local provider requires a loaded engine
      if (provider === 'local' && !engineRef.current) return;

      // Enforce message limit
      const userMessageCount = messages.filter((m) => m.role === 'user').length;
      if (userMessageCount >= MAX_USER_MESSAGES) return; // UI should prevent this

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text.trim() };
      const asstMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '' };
      setMessages((prev) => [...prev, userMsg, asstMsg]);
      setInput('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
      setIsGenerating(true);
      abortRef.current = false;

      try {
        let full = '';

        if (provider === 'cloud') {
          // ── Cloud path: streaming + native function calling, no RAG needed ──
          const [{ cloudChatStream }, { buildCloudContext }] = await Promise.all([
            import('@lib/ai/cloud'),
            import('@lib/ai/cloud-context'),
          ]);

          // Build comprehensive context from all data sources
          const cloudContext = await buildCloudContext();
          const augmentedPrompt = cloudContext + '\n\n' + systemPrompt;

          // Filter out the welcome message and map to API format
          const chatHistory = [...messages, userMsg]
            .filter(
              (m) => m.role === 'user' || (m.role === 'assistant' && m.content !== WELCOME_MESSAGE),
            )
            .map((m) => ({
              role: m.role as 'system' | 'user' | 'assistant',
              content: m.content,
            }));

          // Cloud has 2M context — stream full history + all data + native tools
          const result = await cloudChatStream(
            [{ role: 'system', content: augmentedPrompt }, ...chatHistory],
            selectedCloudModelId,
            (_token, accumulated) => {
              if (abortRef.current) return;
              const content = accumulated;
              setMessages((prev) => prev.map((m) => (m.id === asstMsg.id ? { ...m, content } : m)));
            },
            undefined,
            { tools: CLOUD_TOOLS, tool_choice: 'auto' },
          );

          full = result.content;

          // Map native tool_calls to UI action buttons
          if (result.toolCalls.length > 0) {
            const actions = mapToolCallsToActions(result.toolCalls);
            if (actions.length > 0) {
              setMessages((prev) =>
                prev.map((m) => (m.id === asstMsg.id ? { ...m, content: full, actions } : m)),
              );
            }
          }
        } else {
          // ── Local path: RAG + trimmed history for 4K context ──
          const engine = engineRef.current as MLCEngineInterface;

          // RAG retrieval (compact — 2 chunks, 600 chars max)
          const ragResults = searchIndex(text.trim(), ragIndex);
          const ragContext = formatRetrievedContext(ragResults);

          // Live runtime context (5 recent events)
          const runtimeContext = await fetchRuntimeContext();

          // Local models use text-marker tool instructions (no native function calling)
          const augmentedPrompt =
            systemPrompt + LOCAL_TOOLS_PROMPT_SECTION + ragContext + runtimeContext;

          // Summarize old messages if conversation is long
          const currentMessages = await maybeSummarize(engine, [...messages, userMsg]);

          // Prepare trimmed history (4K context budget)
          const fullHistory = currentMessages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }));
          const history = trimHistory(fullHistory);

          const chunks = await engine.chat.completions.create({
            messages: [{ role: 'system', content: augmentedPrompt }, ...history],
            stream: true,
            ...GENERATION_CONFIG,
          });

          for await (const chunk of chunks) {
            if (abortRef.current) break;
            full += chunk.choices[0]?.delta?.content ?? '';
            const content = full;
            setMessages((prev) => prev.map((m) => (m.id === asstMsg.id ? { ...m, content } : m)));
          }

          // Local models: parse text-marker actions from the response
          const { text: cleanText, actions } = parseActions(full);
          if (actions.length > 0 || cleanText !== full) {
            setMessages((prev) =>
              prev.map((m) => (m.id === asstMsg.id ? { ...m, content: cleanText, actions } : m)),
            );
          }
        }

        // Persist to localStorage and refresh sessions list
        setMessages((prev) => {
          const sid = saveMessages(prev, activeSessionId ?? undefined);
          setActiveSessionIdState(sid);
          setSessions(loadSessions());
          return prev;
        });
      } catch (err) {
        console.error('[AiChat] Generation error:', err);
        const errText = err instanceof Error ? err.message : 'Something went wrong';
        const friendlyMsg = errText.includes('429')
          ? 'Rate limited — please wait a moment and try again.'
          : errText.includes('Empty response')
            ? 'Got an empty response. Try rephrasing or starting a new chat.'
            : `Something went wrong: ${errText}`;
        setMessages((prev) =>
          prev.map((m) => (m.id === asstMsg.id ? { ...m, content: friendlyMsg } : m)),
        );
      } finally {
        setIsGenerating(false);
        // Auto-focus input after generation completes
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [
      messages,
      isGenerating,
      provider,
      selectedCloudModelId,
      systemPrompt,
      ragIndex,
      activeSessionId,
    ],
  );

  /** Auto-init cloud + auto-send roast when triggered via ?roast=1 FAB. */
  const roastAutoInitDone = useRef(false);
  useEffect(() => {
    if (!pendingRoast.current) return;
    // Step 1: auto-init cloud engine once idle
    if (engineState === 'idle' && !roastAutoInitDone.current) {
      roastAutoInitDone.current = true;
      initEngine(true);
    }
    // Step 2: auto-send roast once engine is ready
    if (engineState === 'ready' && pendingRoast.current) {
      pendingRoast.current = false;
      sendMessage('Roast Tomer Nosrati 🔥');
    }
  }, [engineState, initEngine, sendMessage]);

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
    setActiveSessionIdState(null);
    setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: WELCOME_MESSAGE }]);
  };

  /** Switch to a previous chat session. */
  const switchSession = (session: ChatSession) => {
    abortRef.current = true;
    setIsGenerating(false);
    setActiveSessionId(session.id);
    setActiveSessionIdState(session.id);
    setMessages(session.messages);
    setShowHistory(false);
  };

  /** Delete a session from history. */
  const handleDeleteSession = (sessionId: string) => {
    deleteSession(sessionId);
    setSessions(loadSessions());
    // If deleting the active session, start fresh
    if (sessionId === activeSessionId) {
      clearChat();
    }
  };

  /** Clear all chat history. */
  const handleClearAll = () => {
    clearAllSessions();
    setSessions([]);
    clearChat();
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
            {hasSavedChat.current && (
              <button
                onClick={() => initEngine(false)}
                className="bg-accent text-bg-base hover:bg-accent-hover rounded-xl px-8 py-3 text-sm font-semibold transition-colors"
              >
                Continue Chat
              </button>
            )}
            <button
              onClick={() => initEngine(true)}
              className={cn(
                'rounded-xl px-8 py-3 text-sm font-semibold transition-colors',
                hasSavedChat.current
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
          onClick={() => initEngine(true)}
          className="bg-accent text-bg-base hover:bg-accent-hover rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors"
        >
          Try Again
        </button>
      </CenterCard>
    );
  }

  /* ─── Chat UI (engineState === 'ready') ─── */
  const activeModel = AVAILABLE_MODELS.find((m) => m.id === activeModelRef.current);
  const activeCloudModel = CLOUD_MODELS.find((m) => m.id === selectedCloudModelId);
  const statusLabel =
    provider === 'cloud'
      ? `${activeCloudModel?.name ?? 'Cloud AI'} · Cloud`
      : `${activeModel?.name ?? 'AI'} · Local`;
  const userMsgCount = messages.filter((m) => m.role === 'user').length;
  const isAtLimit = userMsgCount >= MAX_USER_MESSAGES;
  return (
    <div className="relative flex h-full flex-col">
      {/* Status bar */}
      <div className="border-border flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="bg-status-active h-2 w-2 rounded-full" />
          <span className="text-text-muted text-xs">{statusLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {sessions.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                'flex items-center gap-1 text-xs transition-colors',
                showHistory ? 'text-accent' : 'text-text-muted hover:text-text-secondary',
              )}
              aria-label="Toggle chat history"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 8v4l3 3" />
                <circle cx="12" cy="12" r="10" />
              </svg>
              History
            </button>
          )}
          {messages.length > 0 && (
            <>
              <span className="bg-border h-3.5 w-px" />
              <button
                onClick={clearChat}
                className="text-text-muted hover:text-text-secondary flex items-center gap-1 text-xs transition-colors"
                aria-label="New chat"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New
              </button>
            </>
          )}
        </div>
      </div>

      {/* Chat history panel (sliding overlay) */}
      {showHistory && (
        <div className="border-border bg-bg-base absolute inset-0 z-10 flex flex-col overflow-hidden">
          <div className="border-border flex items-center justify-between border-b px-4 py-2.5">
            <h3 className="text-text-primary text-sm font-semibold">Chat History</h3>
            <div className="flex items-center gap-2">
              {sessions.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-text-muted text-xs transition-colors hover:text-red-400"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={() => setShowHistory(false)}
                className="text-text-muted hover:text-text-primary transition-colors"
                aria-label="Close history"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="text-text-muted px-4 py-8 text-center text-sm">No chat history yet.</p>
            ) : (
              <div className="divide-border divide-y">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      'group flex cursor-pointer items-start justify-between gap-2 px-4 py-3 transition-colors',
                      session.id === activeSessionId ? 'bg-accent/10' : 'hover:bg-bg-surface',
                    )}
                    onClick={() => switchSession(session)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') switchSession(session);
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-text-primary truncate text-sm font-medium">
                        {session.title}
                      </p>
                      <p className="text-text-muted text-xs">
                        {session.messages.filter((m) => m.role === 'user').length} messages
                        {' · '}
                        {new Date(session.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(session.id);
                      }}
                      className="text-text-muted shrink-0 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400"
                      aria-label="Delete session"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* Input area or limit banner */}
      <div className="border-border border-t px-4 py-3">
        <div className="mx-auto max-w-2xl">
          {isAtLimit ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <p className="text-text-secondary text-sm">
                You've reached the {MAX_USER_MESSAGES}-message limit for this chat.
              </p>
              <button
                onClick={clearChat}
                className="bg-accent text-bg-base hover:bg-accent-hover rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors"
              >
                Start New Chat
              </button>
            </div>
          ) : (
            <>
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
                {provider === 'cloud'
                  ? 'Powered by xAI Grok · Responses may be inaccurate'
                  : 'AI runs locally in your browser via WebGPU · Responses may be inaccurate'}
                {userMsgCount > 0 && ` · ${userMsgCount}/${MAX_USER_MESSAGES} messages`}
              </p>
            </>
          )}
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
