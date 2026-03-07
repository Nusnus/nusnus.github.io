/**
 * Cybernus AI Chat — cloud-only orchestrator.
 *
 * Manages: cloud streaming via xAI Grok, session memory, personality,
 * language, and the Matrix-inspired UI shell. No local WebLLM.
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
import { getPersonalityLevel, setPersonalityLevel, PERSONALITY_LEVELS } from '@lib/ai/personality';
import type { PersonalityLevel } from '@lib/ai/personality';
import { getLanguage, setLanguage as setStoredLanguage, LANGUAGES, t } from '@lib/ai/i18n';
import type { Language } from '@lib/ai/i18n';

interface AiChatProps {
  systemPrompt: string;
}

type EngineState = 'idle' | 'ready';

const WELCOME_MESSAGE =
  "I'm **Cybernus** — the digital construct of Tomer Nosrati. I have access to all of Tomer's GitHub data, projects, and knowledge base.\n\nAsk me anything about his open source work, the **Celery** ecosystem, **pytest-celery**, or his technical journey. I can also search the web for current information.";

/** Main Cybernus chat component — cloud-only architecture. */
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

  /* ─── Refs ─── */
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const roastHandoffRef = useRef(false);

  /* ─── Scroll to bottom on new messages ─── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        return;
      }
    }
  }, []);

  /* ─── Init engine (start new/continue chat) ─── */
  const initEngine = useCallback((resumeExisting: boolean) => {
    if (resumeExisting) {
      const restored = loadMessages();
      if (restored.length > 0) {
        setMessages(restored);
        setEngineState('ready');
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

    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  /* ─── Send message ─── */
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isGenerating) return;

      const userMessageCount = messages.filter((m) => m.role === 'user').length;
      if (userMessageCount >= MAX_USER_MESSAGES) return;

      setInput('');

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

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // Lazy-load cloud modules
        const [{ cloudChatStream }, { buildCloudContext }] = await Promise.all([
          import('@lib/ai/cloud'),
          import('@lib/ai/cloud-context'),
        ]);

        // Build chat history for the API
        const chatHistory = trimHistory(
          updated
            .filter((m) => m.content.length > 0 && m.content !== WELCOME_MESSAGE)
            .map((m) => ({ role: m.role, content: m.content })),
        );

        // Build full context with personality & language
        const context = await buildCloudContext(undefined, personality, language);

        const fullHistory = [
          { role: 'system' as const, content: systemPrompt + context },
          ...chatHistory,
        ];

        // Stream response
        const result = await cloudChatStream(
          fullHistory,
          selectedCloudModelId,
          (_token, accumulated) => {
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
        if (controller.signal.aborted) return;

        const errorMessage =
          err instanceof Error ? err.message : 'Something went wrong. Please try again.';

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
  }, []);

  const switchSession = useCallback((session: ChatSession) => {
    abortRef.current?.abort();
    setIsGenerating(false);
    setActiveSessionId(session.id);
    setActiveSession(session.id);
    setMessages(session.messages);
    setShowHistory(false);
  }, []);

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
    },
    [activeSessionId],
  );

  const handleClearAll = useCallback(() => {
    clearAllSessions();
    setMessages([]);
    setActiveSession(null);
    setSessions([]);
    setShowHistory(false);
    setEngineState('idle');
  }, []);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
  }, []);

  /* ─── Personality & Language handlers ─── */
  const handlePersonalityChange = useCallback((level: PersonalityLevel) => {
    setPersonality(level);
    setPersonalityLevel(level);
  }, []);

  const handleLanguageChange = useCallback((lang: Language) => {
    setLang(lang);
    setStoredLanguage(lang);
  }, []);

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

  return (
    <div className="relative flex h-full flex-col" style={{ background: 'rgba(0, 0, 0, 0.6)' }}>
      {/* Status bar */}
      <div className="flex items-center justify-between border-b border-[#00ff41]/10 px-4 py-2">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full shadow-[0_0_6px]"
            style={{
              backgroundColor: currentPersonality?.color ?? '#00ff41',
              boxShadow: `0 0 6px ${currentPersonality?.glowColor ?? '#00ff41'}`,
            }}
          />
          <span className="text-xs text-[#00ff41]/50">{statusLabel}</span>
          {currentPersonality && (
            <span className="text-[10px] text-[#00ff41]/30">
              {currentPersonality.emoji} {currentPersonality.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <div className="flex items-center gap-1">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => handleLanguageChange(l.code)}
                className={`rounded px-1.5 py-0.5 text-xs transition-all ${
                  language === l.code
                    ? 'bg-[#00ff41]/15 text-[#00ff41]'
                    : 'text-[#00ff41]/30 hover:text-[#00ff41]/60'
                }`}
                title={l.nativeName}
              >
                {l.flag}
              </button>
            ))}
          </div>

          <span className="h-3.5 w-px bg-[#00ff41]/10" />

          {/* Personality slider */}
          <div className="flex items-center gap-1">
            <input
              type="range"
              min={0}
              max={5}
              value={personality}
              onChange={(e) => handlePersonalityChange(Number(e.target.value) as PersonalityLevel)}
              className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-[#00ff41]/20 accent-[#00ff41] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00ff41]"
              title={`${strings.personalityLevel}: ${currentPersonality?.name ?? ''}`}
            />
          </div>

          <span className="h-3.5 w-px bg-[#00ff41]/10" />

          {/* History toggle */}
          {sessions.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-1 text-xs transition-colors ${
                showHistory ? 'text-[#00ff41]' : 'text-[#00ff41]/40 hover:text-[#00ff41]/70'
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
              {strings.history}
            </button>
          )}

          {messages.length > 0 && (
            <>
              <span className="h-3.5 w-px bg-[#00ff41]/10" />
              <button
                onClick={clearChat}
                className="flex items-center gap-1 text-xs text-[#00ff41]/40 transition-colors hover:text-[#00ff41]/70"
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
                {strings.newChat}
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
      />
    </div>
  );
}
