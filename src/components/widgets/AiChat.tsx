import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, AlertCircle, Cpu } from 'lucide-react';
import {
  DEFAULT_MODEL_ID,
  AVAILABLE_MODELS,
  CLOUD_MODELS,
  DEFAULT_CLOUD_MODEL_ID,
  GENERATION_CONFIG,
  WELCOME_MESSAGE,
  isWebGPUSupported,
  trimHistory,
} from '@lib/ai/config';
import type { ChatProvider } from '@lib/ai/config';
import type { MLCEngineInterface } from '@mlc-ai/web-llm';
import type { ChatMessage, SearchIndex } from '@lib/ai/types';
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
} from '@lib/ai/tools';
import { maybeSummarize } from '@lib/ai/summarize';
import { CenterCard } from '@components/ai/CenterCard';
import { ModelPicker } from '@components/ai/ModelPicker';
import { SessionHistory } from '@components/ai/SessionHistory';
import { ChatMessages } from '@components/ai/ChatMessages';
import { ChatInput } from '@components/ai/ChatInput';

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
  /** Roast conversation passed from RoastWidget via sessionStorage. */
  const roastHandoffRef = useRef<ChatMessage[] | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('roast') === '1') {
      pendingRoast.current = true;
      window.history.replaceState({}, '', window.location.pathname);
    }
    const handoff = sessionStorage.getItem('grok-roast-handoff');
    if (handoff) {
      sessionStorage.removeItem('grok-roast-handoff');
      try {
        const data = JSON.parse(handoff) as { messages: ChatMessage[] };
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          roastHandoffRef.current = [
            { id: crypto.randomUUID(), role: 'user', content: 'Roast Tomer Nosrati 🔥' },
            ...data.messages,
          ];
        }
      } catch {
        /* ignore malformed handoff */
      }
    }
  }, []);

  /** Check WebGPU support and probe cache status for all models. */
  useEffect(() => {
    isWebGPUSupported().then(async (supported) => {
      setWebGPUSupported(supported);
      if (!supported) {
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

      if (provider === 'cloud') {
        if (roastHandoffRef.current) {
          setMessages(roastHandoffRef.current);
          roastHandoffRef.current = null;
        } else {
          restoreMessages();
        }
        setEngineState('ready');
        return;
      }

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
      if (provider === 'local' && !engineRef.current) return;

      const userMessageCount = messages.filter((m) => m.role === 'user').length;
      if (userMessageCount >= MAX_USER_MESSAGES) return;

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
          const [{ cloudChatStream }, { buildCloudContext }] = await Promise.all([
            import('@lib/ai/cloud'),
            import('@lib/ai/cloud-context'),
          ]);

          const cloudContext = await buildCloudContext();
          const augmentedPrompt = cloudContext + '\n\n' + systemPrompt;

          const chatHistory = [...messages, userMsg]
            .filter(
              (m) => m.role === 'user' || (m.role === 'assistant' && m.content !== WELCOME_MESSAGE),
            )
            .map((m) => ({
              role: m.role as 'system' | 'user' | 'assistant',
              content: m.content,
            }));

          const result = await cloudChatStream(
            [{ role: 'system', content: augmentedPrompt }, ...chatHistory],
            selectedCloudModelId,
            (_token, accumulated) => {
              if (abortRef.current) return;
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== asstMsg.id) return m;
                  const { searchStatus: _removed, ...rest } = m;
                  return { ...rest, content: accumulated };
                }),
              );
            },
            undefined,
            {
              tools: CLOUD_TOOLS,
              tool_choice: 'auto',
              onWebSearch: () => {
                if (!abortRef.current) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === asstMsg.id ? { ...m, searchStatus: 'searching' as const } : m,
                    ),
                  );
                }
              },
              onWebSearchFound: () => {
                if (!abortRef.current) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === asstMsg.id ? { ...m, searchStatus: 'found' as const } : m,
                    ),
                  );
                }
              },
            },
          );

          full = result.content;

          const actions =
            result.toolCalls.length > 0 ? mapToolCallsToActions(result.toolCalls) : [];

          if (actions.length > 0 || !full) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstMsg.id ? { ...m, content: full || '*(used tools only)*', actions } : m,
              ),
            );
          }
        } else {
          const engine = engineRef.current as MLCEngineInterface;

          const ragResults = searchIndex(text.trim(), ragIndex);
          const ragContext = formatRetrievedContext(ragResults);
          const runtimeContext = await fetchRuntimeContext();

          const augmentedPrompt =
            systemPrompt + LOCAL_TOOLS_PROMPT_SECTION + ragContext + runtimeContext;

          const currentMessages = await maybeSummarize(engine, [...messages, userMsg]);

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

          const { text: cleanText, actions } = parseActions(full);
          if (actions.length > 0 || cleanText !== full) {
            setMessages((prev) =>
              prev.map((m) => (m.id === asstMsg.id ? { ...m, content: cleanText, actions } : m)),
            );
          }
        }

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
    if (roastHandoffRef.current && engineState === 'idle' && !roastAutoInitDone.current) {
      roastAutoInitDone.current = true;
      initEngine(true);
      return;
    }
    if (!pendingRoast.current) return;
    if (engineState === 'idle' && !roastAutoInitDone.current) {
      roastAutoInitDone.current = true;
      initEngine(true);
    }
    if (engineState === 'ready' && pendingRoast.current) {
      pendingRoast.current = false;
      sendMessage('Roast Tomer Nosrati 🔥');
    }
  }, [engineState, initEngine, sendMessage]);

  const clearChat = () => {
    abortRef.current = true;
    setIsGenerating(false);
    clearMessages();
    setActiveSessionIdState(null);
    setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: WELCOME_MESSAGE }]);
  };

  const switchSession = (session: ChatSession) => {
    abortRef.current = true;
    setIsGenerating(false);
    setActiveSessionId(session.id);
    setActiveSessionIdState(session.id);
    setMessages(session.messages);
    setShowHistory(false);
  };

  const handleDeleteSession = (sessionId: string) => {
    deleteSession(sessionId);
    setSessions(loadSessions());
    if (sessionId === activeSessionId) {
      clearChat();
    }
  };

  const handleClearAll = () => {
    clearAllSessions();
    setSessions([]);
    clearChat();
  };

  const handleStop = () => {
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

  if (engineState === 'idle') {
    return (
      <ModelPicker
        provider={provider}
        setProvider={setProvider}
        webGPUSupported={webGPUSupported}
        selectedModelId={selectedModelId}
        setSelectedModelId={setSelectedModelId}
        selectedCloudModelId={selectedCloudModelId}
        setSelectedCloudModelId={setSelectedCloudModelId}
        cacheMap={cacheMap}
        isDeletingModel={isDeletingModel}
        deleteModel={deleteModel}
        hasSavedChat={hasSavedChat.current}
        onContinue={() => initEngine(false)}
        onNewChat={() => initEngine(true)}
      />
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
  const activeCloudModel = CLOUD_MODELS.find((m) => m.id === selectedCloudModelId);
  const activeModel = AVAILABLE_MODELS.find((m) => m.id === activeModelRef.current);
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
              className={`flex items-center gap-1 text-xs transition-colors ${
                showHistory ? 'text-accent' : 'text-text-muted hover:text-text-secondary'
              }`}
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

      {/* Chat history panel */}
      {showHistory && (
        <SessionHistory
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSwitchSession={switchSession}
          onDeleteSession={handleDeleteSession}
          onClearAll={handleClearAll}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Messages area */}
      <ChatMessages
        messages={messages}
        isGenerating={isGenerating}
        messagesEndRef={messagesEndRef}
        onSendMessage={sendMessage}
      />

      {/* Input area */}
      <ChatInput
        input={input}
        setInput={setInput}
        isGenerating={isGenerating}
        isAtLimit={isAtLimit}
        userMsgCount={userMsgCount}
        maxMessages={MAX_USER_MESSAGES}
        provider={provider}
        inputRef={inputRef}
        onSend={sendMessage}
        onStop={handleStop}
        onClearChat={clearChat}
      />
    </div>
  );
}
