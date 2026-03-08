/**
 * Cybernus AI Chat — cloud-only orchestrator.
 *
 * Manages: cloud streaming via xAI Grok, session memory, personality,
 * language, voice, debug panel, and the professional chat UI.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@lib/utils/cn';
import type { ChatMessage } from '@lib/ai/types';
import {
  CLOUD_MODELS,
  DEFAULT_CLOUD_MODEL_ID,
  MAX_USER_MESSAGES,
  trimHistory,
} from '@lib/ai/config';
import { CLOUD_TOOLS, mapToolCallsToActions } from '@lib/ai/tools';
import {
  saveMessages,
  loadMessages,
  loadSessions,
  getActiveSessionId,
  setActiveSessionId,
  clearMessages,
  deleteSession,
  clearAllSessions,
} from '@lib/ai/memory';
import type { ChatSession } from '@lib/ai/memory';
import { ChatMessages } from '@components/ai/ChatMessages';
import { ChatInput } from '@components/ai/ChatInput';
import { ModelPicker } from '@components/ai/ModelPicker';
import { SessionHistory } from '@components/ai/SessionHistory';
import { ThoughtsPanel } from '@components/ai/ThoughtsPanel';
import { DebugPanel, createLogEntry } from '@components/ai/DebugPanel';
import type { DebugLogEntry, DebugState } from '@components/ai/DebugPanel';
import { getPersonalityLevel, setPersonalityLevel, PERSONALITY_LEVELS } from '@lib/ai/personality';
import type { PersonalityLevel } from '@lib/ai/personality';
import { getLanguage, setLanguage as setStoredLanguage, LANGUAGES, t } from '@lib/ai/i18n';
import type { Language } from '@lib/ai/i18n';
import { VoiceSession, isVoiceSupported } from '@lib/ai/voice';
import type { VoiceState } from '@lib/ai/voice';

interface AiChatProps {
  systemPrompt: string;
}

type EngineState = 'idle' | 'ready';

/** Check if a message is any translated welcome message. */
function isWelcomeMessage(content: string): boolean {
  return LANGUAGES.some((l) => t(l.code).welcome === content);
}

/** Main Cybernus chat component — cloud-only architecture with professional UI. */
export default function AiChat({ systemPrompt }: AiChatProps) {
  /* ─── Core state ─── */
  const [engineState, setEngineState] = useState<EngineState>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  /* ─── Cloud model ─── */
  const [selectedCloudModelId, setSelectedCloudModelId] = useState(DEFAULT_CLOUD_MODEL_ID);

  /* ─── Personality & Language ─── */
  const [personality, setPersonality] = useState<PersonalityLevel>(getPersonalityLevel);
  const [language, setLang] = useState<Language>(getLanguage);

  /* ─── Session history ─── */
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSession] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);

  /* ─── Voice state ─── */
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcriptPreview, setTranscriptPreview] = useState('');
  const voiceSessionRef = useRef<VoiceSession | null>(null);

  /* ─── Debug state ─── */
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
  const [streamTokenCount, setStreamTokenCount] = useState(0);
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null);
  const [streamEndTime, setStreamEndTime] = useState<number | null>(null);
  const [apiRequestCount, setApiRequestCount] = useState(0);
  const [lastApiLatency, setLastApiLatency] = useState<number | null>(null);

  /* ─── Refs ─── */
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeSessionIdRef = useRef(activeSessionId);
  activeSessionIdRef.current = activeSessionId;
  /** Incremented on every session-changing operation (clear, switch, delete, clearAll)
   *  so the sendMessage abort handler can detect stale contexts even when
   *  activeSessionId is null on both sides (null === null). */
  const sessionGenRef = useRef(0);

  /* ─── Debug logging helper ─── */
  const addLog = useCallback(
    (
      level: DebugLogEntry['level'],
      category: DebugLogEntry['category'],
      message: string,
      data?: Record<string, unknown>,
    ) => {
      setDebugLogs((prev) => {
        const entry = createLogEntry(level, category, message, data);
        const updated = [...prev, entry];
        // Keep last 200 logs
        return updated.length > 200 ? updated.slice(-200) : updated;
      });
    },
    [],
  );

  /* ─── Debug state object ─── */
  const debugState: DebugState = {
    logs: debugLogs,
    streamTokenCount,
    streamStartTime,
    streamEndTime,
    apiRequestCount,
    lastApiLatency,
    activeSessionId,
    messageCount: messages.length,
    personalityLevel: personality,
    language,
    isGenerating,
    engineState,
  };

  /* ─── Scroll to bottom on new messages ─── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ─── Voice session setup ─── */
  useEffect(() => {
    return () => {
      voiceSessionRef.current?.destroy();
    };
  }, []);

  /* ─── Check for roast widget handoff ─── */
  useEffect(() => {
    try {
      const handoff = sessionStorage.getItem('grok-roast-handoff');
      if (handoff) {
        sessionStorage.removeItem('grok-roast-handoff');
        const parsed = JSON.parse(handoff) as { messages?: ChatMessage[] } | ChatMessage[];
        const msgs = Array.isArray(parsed) ? parsed : parsed.messages;
        if (Array.isArray(msgs) && msgs.length > 0) {
          setMessages(msgs);
          setEngineState('ready');
          addLog('info', 'session', 'Roast handoff loaded', { messageCount: msgs.length });
          return;
        }
      }
    } catch {
      // Ignore invalid handoff data
    }

    // Load session on mount
    const allSessions = loadSessions();
    setSessions(allSessions);
    const activeId = getActiveSessionId();
    if (activeId) {
      setActiveSession(activeId);
      const restored = loadMessages();
      if (restored.length > 0) {
        setMessages(restored);
        setEngineState('ready');
        addLog('info', 'session', 'Session restored', { id: activeId, messages: restored.length });
        return;
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Init engine (start new/continue chat) ─── */
  const initEngine = useCallback(
    (resumeExisting: boolean) => {
      if (resumeExisting) {
        const activeId = getActiveSessionId();
        const restored = loadMessages();
        if (restored.length > 0) {
          setMessages(restored);
          if (activeId) setActiveSession(activeId);
          setEngineState('ready');
          addLog('info', 'session', 'Resumed existing chat', { messages: restored.length });
          inputRef.current?.focus();
          return;
        }
      }

      // Start new session with translated welcome
      const welcomeMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: t(language).welcome,
      };
      setMessages([welcomeMsg]);
      setActiveSession(null);
      setActiveSessionId(null);
      setEngineState('ready');
      addLog('info', 'session', 'New chat started');

      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [addLog, language],
  );

  /* ─── Send message ─── */
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isGenerating) return;

      const userMessageCount = messages.filter((m) => m.role === 'user').length;
      if (userMessageCount >= MAX_USER_MESSAGES) return;

      // Capture generation counter so we can detect session-changing operations
      // during streaming (handles the null === null edge case for new sessions)
      const genAtStart = sessionGenRef.current;

      setInput('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
      addLog('info', 'ui', 'User message sent', { length: trimmed.length });

      // Track streaming progress in outer scope so catch block can access them
      let tokenCount = 0;
      let lastAccumulated = '';

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
      };
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
      };

      const updated = [...messages, userMsg, assistantMsg];
      setMessages(updated);
      setIsGenerating(true);
      setStreamTokenCount(0);
      setStreamStartTime(Date.now());
      setStreamEndTime(null);

      const controller = new AbortController();
      abortRef.current = controller;
      const requestStart = Date.now();

      try {
        // Lazy-load cloud modules
        const [{ cloudChatStream }, { buildCloudContext }] = await Promise.all([
          import('@lib/ai/cloud'),
          import('@lib/ai/cloud-context'),
        ]);

        addLog('debug', 'api', 'Cloud modules loaded');
        setApiRequestCount((c) => c + 1);

        // Build chat history for the API
        const chatHistory = trimHistory(
          updated
            .filter((m) => m.content.length > 0 && !isWelcomeMessage(m.content))
            .map((m) => ({ role: m.role, content: m.content })),
        );

        // Build full context with personality & language
        const context = await buildCloudContext(undefined, personality, language);
        addLog('debug', 'api', 'Context built', {
          historyMessages: chatHistory.length,
          contextLength: context.length,
        });

        const fullHistory = [
          { role: 'system' as const, content: systemPrompt + context },
          ...chatHistory,
        ];

        // Stream response
        const result = await cloudChatStream(
          fullHistory,
          selectedCloudModelId,
          (_token, accumulated) => {
            tokenCount++;
            lastAccumulated = accumulated;
            setStreamTokenCount(tokenCount);
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === 'assistant') {
                const patched = { ...last, content: accumulated };
                delete patched.searchStatus;
                copy[copy.length - 1] = patched;
              }
              return copy;
            });
          },
          controller.signal,
          {
            tools: CLOUD_TOOLS,
            tool_choice: 'auto',
            onWebSearch: () => {
              addLog('info', 'api', 'Web search triggered');
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === 'assistant') {
                  copy[copy.length - 1] = { ...last, searchStatus: 'searching' };
                }
                return copy;
              });
            },
            onWebSearchFound: () => {
              addLog('info', 'api', 'Web search results found');
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === 'assistant') {
                  copy[copy.length - 1] = { ...last, searchStatus: 'found' };
                }
                return copy;
              });
            },
          },
        );

        const latency = Date.now() - requestStart;
        setLastApiLatency(latency);
        setStreamEndTime(Date.now());
        addLog('info', 'stream', 'Stream completed', {
          tokens: tokenCount,
          latencyMs: latency,
          toolCalls: result.toolCalls.length,
        });

        // Map tool calls to actions
        const actions = mapToolCallsToActions(result.toolCalls);

        // Build final assistant message
        // If the API returned only tool calls with no text, use a fallback so
        // the empty content doesn't trigger a permanent TypingIndicator.
        const finalAssistant: ChatMessage = {
          ...assistantMsg,
          content: result.content || (result.toolCalls.length > 0 ? '*(used tools only)*' : ''),
        };
        if (actions.length > 0) finalAssistant.actions = actions;

        // Compute final messages directly (don't rely on React state updater
        // timing — in React 18 batched updates, the updater runs during render,
        // not synchronously when setState is called)
        const finalMessages = [...updated.slice(0, -1), finalAssistant];

        // Update UI state
        setMessages(finalMessages);

        // Persist to localStorage
        // Skip save if a session-changing operation occurred during streaming
        if (sessionGenRef.current === genAtStart) {
          const sid = saveMessages(finalMessages, activeSessionIdRef.current ?? undefined);
          setActiveSession(sid);
          setSessions(loadSessions());
        }
      } catch (err) {
        if (controller.signal.aborted) {
          addLog('warn', 'stream', 'Stream aborted by user');
          // Build abort messages directly (same React 18 batching concern)
          // If no tokens were streamed, remove the empty assistant placeholder;
          // otherwise keep the partial response so it survives page refresh.
          const abortMessages =
            tokenCount === 0
              ? updated.slice(0, -1) // Remove empty assistant placeholder
              : [...updated.slice(0, -1), { ...assistantMsg, content: lastAccumulated }];

          // Only update messages/save if no session-changing operation occurred
          if (sessionGenRef.current === genAtStart) {
            setMessages(abortMessages);

            if (tokenCount > 0 && lastAccumulated) {
              const sid = saveMessages(abortMessages, activeSessionIdRef.current ?? undefined);
              setActiveSession(sid);
              setSessions(loadSessions());
            }
          }
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : 'Something went wrong. Please try again.';

        addLog('error', 'api', 'Request failed', { error: errorMessage });

        const friendlyMsg =
          errorMessage.includes('429') || errorMessage.includes('rate')
            ? "I'm getting too many requests right now. Please wait a moment and try again."
            : errorMessage.includes('500') || errorMessage.includes('502')
              ? "The AI service is temporarily unavailable. Let's try again in a moment."
              : `I ran into an issue: ${errorMessage}`;

        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === 'assistant') {
            const errMsg = { ...last, content: friendlyMsg };
            delete errMsg.searchStatus;
            copy[copy.length - 1] = errMsg;
          }
          return copy;
        });
      } finally {
        setIsGenerating(false);
        setStreamEndTime(Date.now());
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [
      messages,
      isGenerating,
      systemPrompt,
      selectedCloudModelId,
      activeSessionId,
      personality,
      language,
      addLog,
    ],
  );

  /* ─── Session management ─── */
  const clearChat = useCallback(() => {
    // Save current messages before clearing so the session persists in history
    if (messages.length > 0 && messages.some((m) => m.role === 'user')) {
      saveMessages(messages, activeSessionId ?? undefined);
    }
    // Increment generation counter so any in-flight sendMessage abort handler
    // detects the session change and skips its re-save logic.
    sessionGenRef.current++;
    activeSessionIdRef.current = null;
    abortRef.current?.abort();
    setIsGenerating(false);
    clearMessages();
    setMessages([]);
    setActiveSession(null);
    setSessions(loadSessions());
    setEngineState('idle');
    addLog('info', 'session', 'Chat cleared');
  }, [addLog, messages, activeSessionId]);

  const switchSession = useCallback(
    (session: ChatSession) => {
      // Increment generation counter and update ref before aborting
      sessionGenRef.current++;
      activeSessionIdRef.current = session.id;
      abortRef.current?.abort();
      setIsGenerating(false);
      setActiveSessionId(session.id);
      setActiveSession(session.id);
      setMessages(session.messages);
      setShowSidebar(false);
      setEngineState('ready');
      addLog('info', 'session', 'Switched session', { id: session.id });
    },
    [addLog],
  );

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      deleteSession(sessionId);
      setSessions(loadSessions());
      if (activeSessionId === sessionId) {
        sessionGenRef.current++;
        activeSessionIdRef.current = null;
        abortRef.current?.abort();
        setIsGenerating(false);
        clearMessages();
        setMessages([]);
        setActiveSession(null);
        setEngineState('idle');
      }
      addLog('info', 'session', 'Session deleted', { id: sessionId });
    },
    [activeSessionId, addLog],
  );

  const handleClearAll = useCallback(() => {
    sessionGenRef.current++;
    activeSessionIdRef.current = null;
    abortRef.current?.abort();
    setIsGenerating(false);
    clearAllSessions();
    setMessages([]);
    setActiveSession(null);
    setSessions([]);
    setShowSidebar(false);
    setEngineState('idle');
    addLog('info', 'session', 'All sessions cleared');
  }, [addLog]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
    addLog('info', 'stream', 'Generation stopped by user');
  }, [addLog]);

  /* ─── Personality & Language handlers ─── */
  const handlePersonalityChange = useCallback(
    (level: PersonalityLevel) => {
      setPersonality(level);
      setPersonalityLevel(level);
      addLog('info', 'ui', 'Personality changed', { level });
    },
    [addLog],
  );

  const handleLanguageChange = useCallback(
    (lang: Language) => {
      setLang(lang);
      setStoredLanguage(lang);
      addLog('info', 'ui', 'Language changed', { language: lang });
    },
    [addLog],
  );

  /* ─── Voice handlers ─── */
  const voiceSupported = isVoiceSupported();

  const handleVoiceToggle = useCallback(() => {
    if (voiceState === 'idle' || voiceState === 'error') {
      // Start recording
      const session = new VoiceSession(
        {
          onStateChange: (state) => {
            setVoiceState(state);
            addLog('info', 'voice', `Voice state: ${state}`);
          },
          onTranscript: (text, isFinal) => {
            setTranscriptPreview(text);
            if (isFinal) {
              setInput((prev) => (prev ? `${prev} ${text}` : text));
              setTranscriptPreview('');
              addLog('info', 'voice', 'Transcript received', { text, isFinal });
            }
          },
          onDiagnosticsUpdate: (diag) => {
            addLog(
              'debug',
              'voice',
              'Diagnostics update',
              diag as unknown as Record<string, unknown>,
            );
          },
          onError: (error) => {
            addLog('error', 'voice', error);
          },
          onAudioLevel: (level) => {
            setAudioLevel(level);
          },
        },
        language,
      );
      voiceSessionRef.current = session;
      session.start().catch(() => {
        /* handled via onError callback */
      });
    } else {
      // Stop recording
      voiceSessionRef.current?.stop();
      voiceSessionRef.current = null;
      setVoiceState('idle');
      setAudioLevel(0);
      setTranscriptPreview('');
    }
  }, [voiceState, addLog, language]);

  /* ─── Derived values ─── */
  const activeCloudModel = CLOUD_MODELS.find((m) => m.id === selectedCloudModelId);
  const userMsgCount = messages.filter((m) => m.role === 'user').length;
  const isAtLimit = userMsgCount >= MAX_USER_MESSAGES;
  const currentPersonality = PERSONALITY_LEVELS[personality];
  const strings = t(language);
  const isRecording =
    voiceState === 'requesting-mic' ||
    voiceState === 'recording' ||
    voiceState === 'connecting' ||
    voiceState === 'transcribing';

  /* ─── Sidebar content (shared between desktop persistent & mobile overlay) ─── */
  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand header */}
      <div className="border-border flex shrink-0 items-center gap-3 border-b px-4 py-4">
        <div className="bg-accent-muted ring-accent/20 relative flex h-8 w-8 items-center justify-center rounded-lg ring-1">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: currentPersonality?.color ?? 'var(--color-accent)',
              boxShadow: `0 0 10px ${currentPersonality?.glowColor ?? 'var(--color-accent)'}`,
            }}
          />
        </div>
        <span className="text-text-primary text-sm font-bold tracking-[0.15em]">CYBERNUS</span>
      </div>

      {/* New Chat button */}
      <div className="shrink-0 px-3 pt-3 pb-1">
        <button
          onClick={clearChat}
          className="border-border text-text-secondary hover:border-accent/30 hover:bg-accent-muted hover:text-text-primary flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] transition-all"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {strings.newChat}
        </button>
      </div>

      {/* Session list */}
      <div className="min-h-0 flex-1">
        <SessionHistory
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSwitchSession={switchSession}
          onDeleteSession={handleDeleteSession}
          onClearAll={handleClearAll}
          onClose={() => setShowSidebar(false)}
          language={language}
        />
      </div>

      {/* Settings section */}
      <div className="border-border shrink-0 space-y-4 border-t px-4 py-4">
        {/* Language toggle */}
        <div>
          <p className="text-text-muted mb-2 text-[10px] font-medium tracking-wider uppercase">
            {strings.language}
          </p>
          <div className="bg-bg-elevated flex items-center gap-0.5 rounded-lg p-0.5">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => handleLanguageChange(l.code)}
                className={cn(
                  'flex-1 rounded-md px-1.5 py-1.5 text-center text-xs transition-all',
                  language === l.code
                    ? 'bg-bg-surface text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-secondary',
                )}
                title={l.nativeName}
              >
                {l.flag}
              </button>
            ))}
          </div>
        </div>

        {/* Personality slider */}
        <div>
          <p className="text-text-muted mb-2 text-[10px] font-medium tracking-wider uppercase">
            {strings.personality}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm">{currentPersonality?.emoji}</span>
            <input
              type="range"
              min={0}
              max={5}
              value={personality}
              onChange={(e) => handlePersonalityChange(Number(e.target.value) as PersonalityLevel)}
              className="bg-bg-elevated accent-accent [&::-webkit-slider-thumb]:bg-accent h-1 flex-1 cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full"
              title={`${strings.personalityLevel}: ${currentPersonality?.name ?? ''}`}
            />
            <span className="text-text-muted w-16 text-[10px]">{currentPersonality?.name}</span>
          </div>
        </div>
      </div>

      {/* Back to portfolio */}
      <div className="border-border shrink-0 border-t px-4 py-3">
        <a
          href="/"
          className="text-text-muted hover:text-text-secondary flex items-center gap-2 text-xs transition-colors"
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
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          Back to portfolio
        </a>
      </div>
    </div>
  );

  return (
    <div className="bg-bg-base flex h-full">
      {/* Mobile sidebar backdrop */}
      {showSidebar && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop overlay
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar — persistent on desktop, overlay on mobile */}
      <aside
        className={cn(
          'bg-bg-base border-accent/30 flex h-full shrink-0 flex-col border-r',
          'md:relative md:flex md:w-[260px]',
          showSidebar ? 'fixed inset-y-0 left-0 z-30 w-72' : 'hidden md:flex',
        )}
      >
        {sidebarContent}
      </aside>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {engineState === 'idle' ? (
          /* ─── Idle screen ─── */
          <>
            {/* Mobile header for idle */}
            <div className="border-border flex items-center justify-between border-b px-4 py-3 md:hidden">
              <button
                onClick={() => setShowSidebar(true)}
                className="text-text-muted hover:bg-bg-surface rounded-lg p-1.5 transition-colors"
                aria-label="Open menu"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 12h18M3 6h18M3 18h18" />
                </svg>
              </button>
              <span className="text-text-primary text-sm font-bold tracking-wider">CYBERNUS</span>
              <div className="w-8" />
            </div>
            <ModelPicker
              selectedCloudModelId={selectedCloudModelId}
              setSelectedCloudModelId={setSelectedCloudModelId}
              hasSavedChat={getActiveSessionId() !== null}
              onContinue={() => initEngine(true)}
              onNewChat={() => initEngine(false)}
              language={language}
            />
          </>
        ) : (
          /* ─── Chat UI ─── */
          <>
            {/* Minimal chat header */}
            <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Mobile hamburger */}
                <button
                  onClick={() => setShowSidebar(true)}
                  className="text-text-muted hover:bg-bg-surface rounded-lg p-1.5 transition-colors md:hidden"
                  aria-label="Open menu"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 12h18M3 6h18M3 18h18" />
                  </svg>
                </button>

                {/* Model status */}
                <div className="flex items-center gap-2">
                  <span
                    className="block h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: currentPersonality?.color ?? 'var(--color-accent)',
                      boxShadow: `0 0 8px ${currentPersonality?.glowColor ?? 'var(--color-accent)'}`,
                    }}
                  />
                  <span className="text-text-secondary text-xs">
                    {activeCloudModel?.name ?? 'Grok'}
                  </span>
                  <span className="text-text-muted hidden text-[10px] sm:inline">
                    {currentPersonality?.emoji} {currentPersonality?.name}
                  </span>
                </div>
              </div>

              {/* Recording indicator in header */}
              {isRecording && (
                <span className="flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/[0.06] px-2.5 py-1 text-[10px] font-medium text-red-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-40" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-400" />
                  </span>
                  {strings.recording}
                </span>
              )}
            </div>

            {/* Messages */}
            <ChatMessages
              messages={messages}
              isGenerating={isGenerating}
              messagesEndRef={messagesEndRef}
              onSendMessage={sendMessage}
              language={language}
            />

            {/* Input */}
            <ChatInput
              input={input}
              setInput={setInput}
              isGenerating={isGenerating}
              isAtLimit={isAtLimit}
              userMsgCount={userMsgCount}
              maxMessages={MAX_USER_MESSAGES}
              language={language}
              inputRef={inputRef}
              onSend={sendMessage}
              onStop={handleStop}
              onClearChat={clearChat}
              isRecording={isRecording}
              onVoiceToggle={handleVoiceToggle}
              voiceSupported={voiceSupported}
              audioLevel={audioLevel}
              transcriptPreview={transcriptPreview}
            />
          </>
        )}
      </div>

      {/* Floating thoughts panel — visible on xl+ screens */}
      <ThoughtsPanel />

      {/* Debug panel — only in development */}
      {import.meta.env.DEV && (
        <DebugPanel state={debugState} onClearLogs={() => setDebugLogs([])} />
      )}
    </div>
  );
}
