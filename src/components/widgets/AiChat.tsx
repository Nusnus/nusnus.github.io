/**
 * Cybernus — AI Chat main component.
 *
 * Cloud-only architecture (xAI Grok via Cloudflare Worker proxy).
 * Features: personality slider, trilingual support, modern vibrant UI,
 * tool-use visibility, smooth animations, wide-screen layout.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertCircle, ArrowLeft, Clock, Plus } from 'lucide-react';
import {
  DEFAULT_CLOUD_MODEL_ID,
  MAX_USER_MESSAGES,
  PERSONALITY_LEVELS,
  DEFAULT_PERSONALITY,
  LANGUAGES,
  DEFAULT_LANGUAGE,
} from '@lib/ai/config';
import { getTranslations } from '@lib/ai/i18n';
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
  /** Current tool/activity status shown during generation (e.g. "Searching the web…"). */
  const [thinkingStatus, setThinkingStatus] = useState<string | null>(null);

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
    let activeLang: Language = DEFAULT_LANGUAGE;
    const savedLang = localStorage.getItem('cybernus-language') as Language | null;
    if (savedLang && savedLang in LANGUAGES) {
      setLanguage(savedLang);
      activeLang = savedLang;
    }

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
        const t = getTranslations(activeLang);
        setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: t.welcomeMessage }]);
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
      setThinkingStatus('Thinking…');
      abortRef.current = false;

      try {
        const [{ cloudChatStream }, { buildCloudContext }] = await Promise.all([
          import('@lib/ai/cloud'),
          import('@lib/ai/cloud-context'),
        ]);

        setThinkingStatus('Loading context…');

        const personalityConfig = PERSONALITY_LEVELS[personality];
        const langConfig = LANGUAGES[language];

        const cloudContext = await buildCloudContext();
        const personalityPrompt = personalityConfig.promptModifier;
        const langPrompt = langConfig.promptInstruction;
        const augmentedPrompt = `${langPrompt}\n\n${personalityPrompt}\n\n${cloudContext}\n\n${systemPrompt}\n\n---\nREMINDER: ${langPrompt}`;

        // Filter out welcome messages in ALL languages (not just current) so a
        // language switch doesn't leak the old welcome into chat history.
        const allWelcomeMessages = new Set(
          (['en', 'es', 'he'] as const).map((l) => getTranslations(l).welcomeMessage),
        );
        const chatHistory = [...messages, userMsg]
          .filter(
            (m) =>
              m.role === 'user' || (m.role === 'assistant' && !allWelcomeMessages.has(m.content)),
          )
          .map((m) => ({
            role: m.role as 'system' | 'user' | 'assistant',
            content: m.content,
          }));

        setThinkingStatus('Generating response…');

        const result = await cloudChatStream(
          [{ role: 'system', content: augmentedPrompt }, ...chatHistory],
          DEFAULT_CLOUD_MODEL_ID,
          (_token, accumulated) => {
            if (abortRef.current) return;
            // Clear thinking status once content starts streaming
            setThinkingStatus(null);
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
                setThinkingStatus('Searching the web…');
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === asstMsg.id ? { ...m, searchStatus: 'searching' as const } : m,
                  ),
                );
              }
            },
            onWebSearchFound: () => {
              if (!abortRef.current) {
                setThinkingStatus('Synthesizing results…');
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
        setThinkingStatus(null);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [messages, isGenerating, personality, language, systemPrompt, activeSessionId],
  );

  /* ─── Chat actions ─── */

  const clearChat = useCallback(() => {
    abortRef.current = true;
    setIsGenerating(false);
    setThinkingStatus(null);
    clearMessages();
    setActiveSessionIdState(null);
    const t = getTranslations(language);
    setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: t.welcomeMessage }]);
  }, [language]);

  const switchSession = useCallback((session: ChatSession) => {
    abortRef.current = true;
    setIsGenerating(false);
    setThinkingStatus(null);
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
    setThinkingStatus(null);
  }, []);

  /* ─── Derived state ─── */
  const userMsgCount = messages.filter((m) => m.role === 'user').length;
  const isAtLimit = userMsgCount >= MAX_USER_MESSAGES;
  const langConfig = LANGUAGES[language];
  const personalityConfig = PERSONALITY_LEVELS[personality];

  /* ─── Render ─── */
  return (
    <div className="relative flex h-full flex-col bg-[#0b0d14]" dir={langConfig.dir}>
      {/* Header bar */}
      <header className="relative z-10 border-b border-white/[0.06] bg-[#0d0f18]/90 px-4 py-2.5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          {/* Left: Back + Branding */}
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-text-muted flex items-center gap-1.5 text-sm transition-colors hover:text-cyan-400"
              aria-label="Back to portfolio"
            >
              <ArrowLeft className="h-4 w-4" />
            </a>
            <div className="h-5 w-px bg-white/10" />
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-7 w-7 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-sm" />
                <div className="absolute inset-0.5 rounded-full bg-gradient-to-br from-cyan-400/30 to-blue-500/20" />
                <span className="relative text-sm">🧠</span>
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-sm font-bold tracking-wide text-cyan-400">
                  CYBERNUS
                </span>
                <span
                  className={`text-[9px] leading-none font-medium ${personalityConfig.colorClass}`}
                >
                  {personalityConfig.label}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            <PersonalitySlider level={personality} onChange={handlePersonalityChange} />
            <div className="h-5 w-px bg-white/10" />
            <LanguageToggle language={language} onChange={handleLanguageChange} />
            {sessions.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                  showHistory
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-text-muted hover:bg-white/[0.06] hover:text-cyan-400'
                }`}
                aria-label="Toggle chat history"
                title="Chat history"
              >
                <Clock className="h-4 w-4" />
              </button>
            )}
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="text-text-muted flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-white/[0.06] hover:text-cyan-400"
                aria-label="New chat"
                title="New chat"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
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
        thinkingStatus={thinkingStatus}
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
      {messages.length > 0 &&
        messages[messages.length - 1]?.role === 'assistant' &&
        messages[messages.length - 1]?.content.startsWith('Something went wrong') && (
          <div className="animate-in fade-in slide-in-from-bottom-2 absolute bottom-20 left-1/2 z-20 -translate-x-1/2">
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-400 shadow-lg shadow-red-500/5 backdrop-blur-sm">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>An error occurred</span>
            </div>
          </div>
        )}
    </div>
  );
}
