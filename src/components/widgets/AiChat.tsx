import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import { CLOUD_MODELS, DEFAULT_CLOUD_MODEL_ID, WELCOME_MESSAGE } from '@lib/ai/config';
import type { ChatMessage } from '@lib/ai/types';
import { useLanguage } from '@hooks/useLanguage';
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
import { CLOUD_TOOLS, mapToolCallsToActions } from '@lib/ai/tools';
import { getCurrentPageContext } from '@lib/ai/page-context';
import { CenterCard } from '@components/ai/CenterCard';
import { ModelPicker } from '@components/ai/ModelPicker';
import { SessionHistory } from '@components/ai/SessionHistory';
import { ChatMessages } from '@components/ai/ChatMessages';
import { ChatInput } from '@components/ai/ChatInput';
import { getPersonalityLevel } from '@components/ai/PersonalitySlider';

/* ─── Constants ─── */

/** Maximum number of user messages per chat session before prompting new chat. */
const MAX_USER_MESSAGES = 10;

/* ─── Types ─── */

type EngineState = 'idle' | 'ready' | 'error';

interface Props {
  systemPrompt: string;
}

/* ─── Component ─── */

export default function AiChat({ systemPrompt }: Props) {
  const { t } = useLanguage();
  const [engineState, setEngineState] = useState<EngineState>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, _setErrorMsg] = useState('');
  const [selectedCloudModelId, setSelectedCloudModelId] = useState(DEFAULT_CLOUD_MODEL_ID);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);

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

  const initEngine = useCallback(async (startFresh = false) => {
    if (startFresh) {
      clearMessages();
      setActiveSessionIdState(null);
    }

    if (roastHandoffRef.current) {
      setMessages(roastHandoffRef.current);
      roastHandoffRef.current = null;
    } else if (!startFresh) {
      const saved = loadMessages();
      if (saved.length > 0) {
        setMessages(saved);
      } else {
        setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: WELCOME_MESSAGE }]);
      }
    } else {
      setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: WELCOME_MESSAGE }]);
    }
    setEngineState('ready');
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isGenerating) return;

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
        const [{ cloudChatStream }, { buildCloudContext }] = await Promise.all([
          import('@lib/ai/cloud'),
          import('@lib/ai/cloud-context'),
        ]);

        // Inject page context and personality level
        const pageContext = getCurrentPageContext();
        const personalityLevel = getPersonalityLevel();
        const cloudContext = await buildCloudContext(pageContext, personalityLevel);
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

        const full = result.content;
        const actions = result.toolCalls.length > 0 ? mapToolCallsToActions(result.toolCalls) : [];

        if (actions.length > 0 || !full) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsg.id ? { ...m, content: full || '*(used tools only)*', actions } : m,
            ),
          );
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
    [messages, isGenerating, selectedCloudModelId, systemPrompt, activeSessionId],
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

  if (engineState === 'idle') {
    return (
      <ModelPicker
        selectedCloudModelId={selectedCloudModelId}
        setSelectedCloudModelId={setSelectedCloudModelId}
        hasSavedChat={hasSavedChat.current}
        onContinue={() => initEngine(false)}
        onNewChat={() => initEngine(true)}
      />
    );
  }

  if (engineState === 'error') {
    return (
      <CenterCard>
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
          <AlertCircle className="h-7 w-7 text-red-400" />
        </div>
        <h2 className="text-text-primary mb-2 text-lg font-semibold">{t('failedToLoad')}</h2>
        <p className="text-text-secondary mb-4 max-w-sm text-center text-xs leading-relaxed">
          {errorMsg}
        </p>
        <button
          onClick={() => initEngine(true)}
          className="bg-accent text-bg-base hover:bg-accent-hover rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors"
        >
          {t('tryAgain')}
        </button>
      </CenterCard>
    );
  }

  /* ─── Chat UI (engineState === 'ready') ─── */
  const activeCloudModel = CLOUD_MODELS.find((m) => m.id === selectedCloudModelId);
  const statusLabel = `${activeCloudModel?.name ?? 'Grok'} · ${t('cloud')}`;
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
              aria-label={t('toggleChatHistory')}
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
        inputRef={inputRef}
        onSend={sendMessage}
        onStop={handleStop}
        onClearChat={clearChat}
      />
    </div>
  );
}
