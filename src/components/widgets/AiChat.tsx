/**
 * Cybernus AI Chat — cloud-only orchestrator.
 *
 * Manages: cloud streaming via xAI Grok, session memory, personality,
 * language, voice, debug panel, and the professional chat UI.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
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
import { DebugPanel, createLogEntry } from '@components/ai/DebugPanel';
import type { DebugLogEntry, DebugState } from '@components/ai/DebugPanel';
import { getPersonalityLevel, setPersonalityLevel, PERSONALITY_LEVELS } from '@lib/ai/personality';
import type { PersonalityLevel } from '@lib/ai/personality';
import { getLanguage, setLanguage as setStoredLanguage, LANGUAGES, t } from '@lib/ai/i18n';
import type { Language } from '@lib/ai/i18n';
import { VoiceSession } from '@lib/ai/voice';
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
  const roastHandoffRef = useRef(false);

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
        roastHandoffRef.current = true;
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
        const restored = loadMessages();
        if (restored.length > 0) {
          setMessages(restored);
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

      setInput('');
      addLog('info', 'ui', 'User message sent', { length: trimmed.length });

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
        let tokenCount = 0;
        const result = await cloudChatStream(
          fullHistory,
          selectedCloudModelId,
          (_token, accumulated) => {
            tokenCount++;
            setStreamTokenCount(tokenCount);
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === 'assistant') {
                const updated = { ...last, content: accumulated };
                delete updated.searchStatus;
                copy[copy.length - 1] = updated;
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

        // Final update — compute final messages, then persist outside the updater
        let finalMessages: ChatMessage[] = [];
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === 'assistant') {
            const finalMsg = {
              ...last,
              content: result.content,
            };
            if (actions.length > 0) finalMsg.actions = actions;
            else delete finalMsg.actions;
            delete finalMsg.searchStatus;
            copy[copy.length - 1] = finalMsg;
          }
          finalMessages = copy;
          return copy;
        });

        // Side effects outside the updater (localStorage writes, state updates)
        const sid = saveMessages(finalMessages, activeSessionId ?? undefined);
        setActiveSession(sid);
        setSessions(loadSessions());
      } catch (err) {
        if (controller.signal.aborted) {
          addLog('warn', 'stream', 'Stream aborted by user');
          // Remove empty assistant placeholder if no tokens were streamed,
          // otherwise save the partial response so it survives page refresh
          let abortMessages: ChatMessage[] = [];
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant' && !last.content) {
              abortMessages = prev.slice(0, -1);
              return abortMessages;
            }
            abortMessages = prev;
            return prev;
          });
          if (abortMessages.length > 0 && abortMessages[abortMessages.length - 1]?.content) {
            const sid = saveMessages(abortMessages, activeSessionId ?? undefined);
            setActiveSession(sid);
            setSessions(loadSessions());
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
        abortRef.current = null;
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
    abortRef.current?.abort();
    setIsGenerating(false);
    clearMessages();
    setMessages([]);
    setActiveSession(null);
    setSessions(loadSessions());
    setEngineState('idle');
    addLog('info', 'session', 'Chat cleared');
  }, [addLog]);

  const switchSession = useCallback(
    (session: ChatSession) => {
      abortRef.current?.abort();
      setIsGenerating(false);
      setActiveSessionId(session.id);
      setActiveSession(session.id);
      setMessages(session.messages);
      setShowSidebar(false);
      addLog('info', 'session', 'Switched session', { id: session.id });
    },
    [addLog],
  );

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      deleteSession(sessionId);
      setSessions(loadSessions());
      if (activeSessionId === sessionId) {
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
  const voiceSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const handleVoiceToggle = useCallback(() => {
    if (voiceState === 'idle' || voiceState === 'error') {
      // Start recording
      const session = new VoiceSession({
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
      });
      voiceSessionRef.current = session;
      session.start();
    } else {
      // Stop recording
      voiceSessionRef.current?.stop();
      voiceSessionRef.current = null;
      setVoiceState('idle');
      setAudioLevel(0);
      setTranscriptPreview('');
    }
  }, [voiceState, addLog]);

  /* ─── Idle screen ─── */
  if (engineState === 'idle') {
    return (
      <div className="bg-bg-base flex h-full flex-col">
        <ModelPicker
          selectedCloudModelId={selectedCloudModelId}
          setSelectedCloudModelId={setSelectedCloudModelId}
          hasSavedChat={loadMessages().length > 0}
          onContinue={() => initEngine(true)}
          onNewChat={() => initEngine(false)}
          language={language}
        />
        <DebugPanel state={debugState} onClearLogs={() => setDebugLogs([])} />
      </div>
    );
  }

  /* ─── Chat UI ─── */
  const activeCloudModel = CLOUD_MODELS.find((m) => m.id === selectedCloudModelId);
  const statusLabel = `${activeCloudModel?.name ?? 'Grok'} · Cloud`;
  const userMsgCount = messages.filter((m) => m.role === 'user').length;
  const isAtLimit = userMsgCount >= MAX_USER_MESSAGES;
  const currentPersonality = PERSONALITY_LEVELS[personality];
  const strings = t(language);
  const isRecording =
    voiceState === 'requesting-mic' ||
    voiceState === 'recording' ||
    voiceState === 'connecting' ||
    voiceState === 'transcribing';

  return (
    <div className="bg-bg-base relative flex h-full">
      {/* Sidebar — session history (desktop: persistent, mobile: overlay) */}
      {showSidebar && (
        <>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop overlay dismisses sidebar on tap */}
          <div
            className="fixed inset-0 z-20 bg-black/50 md:hidden"
            onClick={() => setShowSidebar(false)}
          />
          <aside className="border-border bg-bg-base absolute inset-y-0 left-0 z-30 w-72 border-r md:relative md:z-auto">
            <SessionHistory
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSwitchSession={switchSession}
              onDeleteSession={handleDeleteSession}
              onClearAll={handleClearAll}
              onClose={() => setShowSidebar(false)}
            />
          </aside>
        </>
      )}

      {/* Main chat column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="border-border flex items-center justify-between border-b px-4 py-2 md:px-6">
          <div className="flex items-center gap-3">
            {/* Sidebar toggle */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className={`rounded-lg p-1.5 transition-colors ${
                showSidebar
                  ? 'bg-bg-elevated text-text-primary'
                  : 'text-text-muted hover:bg-bg-elevated hover:text-text-secondary'
              }`}
              aria-label="Toggle session history"
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
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
              </svg>
            </button>

            {/* New chat button */}
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="text-text-muted hover:bg-bg-elevated hover:text-text-secondary flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors"
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
                <span className="hidden sm:inline">{strings.newChat}</span>
              </button>
            )}

            <div className="bg-border hidden h-4 w-px sm:block" />

            {/* Status */}
            <div className="hidden items-center gap-2 sm:flex">
              <div className="relative">
                <span
                  className="block h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: currentPersonality?.color ?? 'var(--color-accent)',
                    boxShadow: `0 0 6px ${currentPersonality?.glowColor ?? 'var(--color-accent)'}`,
                  }}
                />
              </div>
              <span className="text-text-muted text-xs">{statusLabel}</span>
              {currentPersonality && (
                <span className="text-text-muted text-[10px]">
                  {currentPersonality.emoji} {currentPersonality.name}
                </span>
              )}
            </div>

            {/* Voice state indicator */}
            {isRecording && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                {strings.recording}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Language toggle */}
            <div className="bg-bg-surface flex items-center rounded-lg p-0.5">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => handleLanguageChange(l.code)}
                  className={`rounded-md px-1.5 py-1 text-xs transition-all ${
                    language === l.code
                      ? 'bg-bg-elevated text-text-primary shadow-sm'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                  title={l.nativeName}
                >
                  {l.flag}
                </button>
              ))}
            </div>

            <span className="bg-border hidden h-4 w-px sm:block" />

            {/* Personality slider */}
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-text-muted text-xs">{currentPersonality?.emoji}</span>
              <input
                type="range"
                min={0}
                max={5}
                value={personality}
                onChange={(e) =>
                  handlePersonalityChange(Number(e.target.value) as PersonalityLevel)
                }
                className="bg-border accent-accent [&::-webkit-slider-thumb]:bg-accent h-1 w-20 cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full"
                title={`${strings.personalityLevel}: ${currentPersonality?.name ?? ''}`}
              />
            </div>
          </div>
        </div>

        {/* Messages area */}
        <ChatMessages
          messages={messages}
          isGenerating={isGenerating}
          messagesEndRef={messagesEndRef}
          onSendMessage={sendMessage}
          language={language}
        />

        {/* Input area */}
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
      </div>

      {/* Debug panel */}
      <DebugPanel state={debugState} onClearLogs={() => setDebugLogs([])} />
    </div>
  );
}
