/**
 * Cybernus — AI Chat main component.
 *
 * Cloud-only architecture (xAI Grok via Cloudflare Worker proxy).
 * Features: personality slider, trilingual support, Matrix-inspired UI.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  DEFAULT_CLOUD_MODEL_ID,
  WELCOME_MESSAGE,
  MAX_USER_MESSAGES,
  PERSONALITY_LEVELS,
  DEFAULT_PERSONALITY,
  LANGUAGES,
  DEFAULT_LANGUAGE,
} from '@lib/ai/config';
import type { PersonalityLevel, Language } from '@lib/ai/config';
import type { ChatMessage } from '@lib/ai/types';
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
import { SessionHistory } from '@components/ai/SessionHistory';
import { ChatMessages } from '@components/ai/ChatMessages';
import { ChatInput } from '@components/ai/ChatInput';
import { PersonalitySlider } from '@components/ai/PersonalitySlider';
import { LanguageToggle } from '@components/ai/LanguageToggle';

/* ─── Types ─── */

interface Props {
  systemPrompt: string;
}

/* ─── Component ─── */

export default function AiChat({ systemPrompt }: Props) {
  /* ─── State ─── */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);
  const [personality, setPersonality] = useState<PersonalityLevel>(DEFAULT_PERSONALITY);
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);

  /* ─── Init ─── */

  /** Roast handoff from RoastWidget. */
  const pendingRoast = useRef(false);
  const roastHandoffRef = useRef<ChatMessage[] | null>(null);
  const initDone = useRef(false);

  useEffect(() => {
    // Detect ?roast=1 query param
    const params = new URLSearchParams(window.location.search);
    if (params.get('roast') === '1') {
      pendingRoast.current = true;
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Detect roast handoff via sessionStorage
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

    // Load saved language preference
    const savedLang = localStorage.getItem('cybernus-language') as Language | null;
    if (savedLang && savedLang in LANGUAGES) setLanguage(savedLang);

    // Load saved personality
    const savedPersonality = localStorage.getItem('cybernus-personality');
    if (savedPersonality !== null) {
      const level = parseInt(savedPersonality, 10) as PersonalityLevel;
      if (level >= 0 && level <= 5) setPersonality(level);
    }

    // Initialize messages
    if (roastHandoffRef.current) {
      setMessages(roastHandoffRef.current);
      roastHandoffRef.current = null;
    } else {
      const saved = loadMessages();
      if (saved.length > 0) {
        setMessages(saved);
      } else {
        setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: WELCOME_MESSAGE }]);
      }
    }

    setSessions(loadSessions());
    initDone.current = true;
  }, []);

  /** Auto-send roast if triggered via FAB. */
  useEffect(() => {
    if (!initDone.current) return;
    if (pendingRoast.current && messages.length > 0) {
      pendingRoast.current = false;
      sendMessage('Roast Tomer Nosrati 🔥');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* ─── Personality & Language persistence ─── */

  const handlePersonalityChange = useCallback((level: PersonalityLevel) => {
    setPersonality(level);
    localStorage.setItem('cybernus-personality', String(level));
  }, []);

  const handleLanguageChange = useCallback((lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('cybernus-language', lang);
  }, []);

  /* ─── Send message ─── */

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

        const personalityConfig = PERSONALITY_LEVELS[personality];
        const langConfig = LANGUAGES[language];

        const cloudContext = await buildCloudContext();
        const personalityPrompt = personalityConfig.promptModifier;
        const langPrompt = langConfig.promptInstruction;
        const augmentedPrompt = `${personalityPrompt}\n\n${langPrompt}\n\n${cloudContext}\n\n${systemPrompt}`;

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
          DEFAULT_CLOUD_MODEL_ID,
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
            temperature: personalityConfig.temperature,
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
        console.error('[Cybernus] Generation error:', err);
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
    [messages, isGenerating, personality, language, systemPrompt, activeSessionId],
  );

  /* ─── Chat actions ─── */

  const clearChat = useCallback(() => {
    abortRef.current = true;
    setIsGenerating(false);
    clearMessages();
    setActiveSessionIdState(null);
    setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: WELCOME_MESSAGE }]);
  }, []);

  const switchSession = useCallback((session: ChatSession) => {
    abortRef.current = true;
    setIsGenerating(false);
    setActiveSessionId(session.id);
    setActiveSessionIdState(session.id);
    setMessages(session.messages);
    setShowHistory(false);
  }, []);

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      deleteSession(sessionId);
      setSessions(loadSessions());
      if (sessionId === activeSessionId) {
        clearChat();
      }
    },
    [activeSessionId, clearChat],
  );

  const handleClearAll = useCallback(() => {
    clearAllSessions();
    setSessions([]);
    clearChat();
  }, [clearChat]);

  const handleStop = useCallback(() => {
    abortRef.current = true;
    setIsGenerating(false);
  }, []);

  /* ─── Derived state ─── */
  const userMsgCount = messages.filter((m) => m.role === 'user').length;
  const isAtLimit = userMsgCount >= MAX_USER_MESSAGES;
  const langConfig = LANGUAGES[language];
  const personalityConfig = PERSONALITY_LEVELS[personality];

  /* ─── Render ─── */
  return (
    <div className="relative flex h-full flex-col" dir={langConfig.dir}>
      {/* Header bar */}
      <header className="cybernus-header border-b border-green-500/20 bg-gradient-to-r from-[#0a0f0a] to-[#0f1a0f] px-4 py-2.5">
        <div className="flex items-center justify-between">
          {/* Left: Back + Branding */}
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-text-muted flex items-center gap-1.5 text-sm transition-colors hover:text-green-400"
              aria-label="Back to portfolio"
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
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
            </a>
            <div className="h-5 w-px bg-green-500/20" />
            <div className="flex items-center gap-2">
              <div className="relative flex h-6 w-6 items-center justify-center">
                <div className="absolute inset-0 animate-pulse rounded-full bg-green-500/20" />
                <span className="relative text-sm">🧠</span>
              </div>
              <span className="font-mono text-sm font-bold text-green-400">CYBERNUS</span>
              <span className={`text-[10px] font-medium ${personalityConfig.colorClass}`}>
                {personalityConfig.label}
              </span>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            <LanguageToggle language={language} onChange={handleLanguageChange} />
            {sessions.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                  showHistory
                    ? 'bg-green-500/20 text-green-400'
                    : 'text-text-muted hover:bg-green-500/10 hover:text-green-400'
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
              </button>
            )}
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="text-text-muted flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors hover:bg-green-500/10 hover:text-green-400"
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
              </button>
            )}
          </div>
        </div>

        {/* Personality slider */}
        <PersonalitySlider level={personality} onChange={handlePersonalityChange} />
      </header>

      {/* Session history overlay */}
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
        inputRef={inputRef}
        onSend={sendMessage}
        onStop={handleStop}
        onClearChat={clearChat}
        language={language}
      />

      {/* Error recovery overlay */}
      {messages.some(
        (m) => m.role === 'assistant' && m.content.startsWith('Something went wrong'),
      ) && (
        <div className="absolute bottom-20 left-1/2 z-20 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>An error occurred</span>
          </div>
        </div>
      )}
    </div>
  );
}
