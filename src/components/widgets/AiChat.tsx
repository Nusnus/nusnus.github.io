/**
 * Cybernus AI Chat — cloud-only orchestrator.
 *
 * Manages: cloud streaming via xAI Grok, session memory, personality,
 * language, voice, debug panel, and the Matrix-inspired UI shell.
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

const WELCOME_MESSAGE =
  "I'm **Cybernus** — the digital construct of Tomer Nosrati. I have access to all of Tomer's GitHub data, projects, and knowledge base.\n\nAsk me anything about his open source work, the **Celery** ecosystem, **pytest-celery**, or his technical journey. I can also search the web for current information.";

/** Main Cybernus chat component — cloud-only architecture with debug panel. */
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
  const [showHistory, setShowHistory] = useState(false);

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
        const parsed = JSON.parse(handoff) as { messages?: ChatMessage[] } | ChatMessage[];
        const msgs = Array.isArray(parsed) ? parsed : parsed.messages;
        if (Array.isArray(msgs) && msgs.length > 0) {
          setMessages(msgs);
          setEngineState('ready');
          sessionStorage.removeItem('grok-roast-handoff');
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

      // Start new session
      const welcomeMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: WELCOME_MESSAGE,
      };
      setMessages([welcomeMsg]);
      setActiveSession(null);
      setActiveSessionId(null);
      setEngineState('ready');
      addLog('info', 'session', 'New chat started');

      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [addLog],
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
            .filter((m) => m.content.length > 0 && m.content !== WELCOME_MESSAGE)
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

        // Final update
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

          // Save to memory
          const sid = saveMessages(copy, activeSessionId ?? undefined);
          setActiveSession(sid);
          setSessions(loadSessions());

          return copy;
        });
      } catch (err) {
        if (controller.signal.aborted) {
          addLog('warn', 'stream', 'Stream aborted by user');
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
      setShowHistory(false);
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
    clearAllSessions();
    setMessages([]);
    setActiveSession(null);
    setSessions([]);
    setShowHistory(false);
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
      <div className="flex h-full flex-col" style={{ background: 'rgba(0, 0, 0, 0.6)' }}>
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
    voiceState === 'recording' || voiceState === 'connecting' || voiceState === 'transcribing';

  return (
    <div className="relative flex h-full flex-col" style={{ background: 'rgba(0, 0, 0, 0.6)' }}>
      {/* Status bar — full-width modern design */}
      <div
        className="flex items-center justify-between border-b border-[#00ff41]/8 px-4 py-2.5 backdrop-blur-sm md:px-8 lg:px-12"
        style={{ background: 'rgba(0, 0, 0, 0.3)' }}
      >
        <div className="flex items-center gap-3">
          {/* Personality indicator dot with glow */}
          <div className="relative">
            <span
              className="cybernus-glow-pulse block h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: currentPersonality?.color ?? '#00ff41',
                boxShadow: `0 0 8px ${currentPersonality?.glowColor ?? '#00ff41'}`,
              }}
            />
          </div>
          <span className="text-xs font-medium text-[#00ff41]/60">{statusLabel}</span>
          {currentPersonality && (
            <span className="hidden text-[10px] text-[#00ff41]/35 sm:inline">
              {currentPersonality.emoji} {currentPersonality.name}
            </span>
          )}
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
          <div className="flex items-center">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => handleLanguageChange(l.code)}
                className={`rounded-lg px-1.5 py-1 text-xs transition-all ${
                  language === l.code
                    ? 'bg-[#00ff41]/12 text-[#00ff41]'
                    : 'text-[#00ff41]/25 hover:text-[#00ff41]/50'
                }`}
                title={l.nativeName}
              >
                {l.flag}
              </button>
            ))}
          </div>

          <span className="hidden h-4 w-px bg-[#00ff41]/8 sm:block" />

          {/* Personality slider */}
          <div className="hidden items-center gap-1.5 sm:flex">
            <span className="text-[10px] text-[#00ff41]/25">{currentPersonality?.emoji}</span>
            <input
              type="range"
              min={0}
              max={5}
              value={personality}
              onChange={(e) => handlePersonalityChange(Number(e.target.value) as PersonalityLevel)}
              className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-[#00ff41]/15 accent-[#00ff41] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00ff41] [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(0,255,65,0.4)]"
              title={`${strings.personalityLevel}: ${currentPersonality?.name ?? ''}`}
            />
          </div>

          <span className="hidden h-4 w-px bg-[#00ff41]/8 sm:block" />

          {/* History toggle */}
          {sessions.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-all ${
                showHistory
                  ? 'bg-[#00ff41]/10 text-[#00ff41]'
                  : 'text-[#00ff41]/35 hover:bg-[#00ff41]/5 hover:text-[#00ff41]/60'
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
              <span className="hidden sm:inline">{strings.history}</span>
            </button>
          )}

          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[#00ff41]/35 transition-all hover:bg-[#00ff41]/5 hover:text-[#00ff41]/60"
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

      {/* Debug panel */}
      <DebugPanel state={debugState} onClearLogs={() => setDebugLogs([])} />
    </div>
  );
}
