/**
 * Cybernus — AI Chat main component.
 *
 * Professional chat GUI with sidebar layout, Matrix-inspired green aesthetic.
 * Cloud-only architecture (xAI Grok via Cloudflare Worker proxy).
 *
 * Layout:
 * - Left sidebar (collapsible): branding, new chat, session history, controls
 * - Main panel: messages + input area
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Trash2,
} from 'lucide-react';
import { cn } from '@lib/utils/cn';
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
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);
  const [personality, setPersonality] = useState<PersonalityLevel>(DEFAULT_PERSONALITY);
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const [thinkingStatus, setThinkingStatus] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);

  /* ─── Init ─── */

  const pendingRoast = useRef(false);
  const roastHandoffRef = useRef<ChatMessage[] | null>(null);
  const initDone = useRef(false);

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

    let activeLang: Language = DEFAULT_LANGUAGE;
    const savedLang = localStorage.getItem('cybernus-language') as Language | null;
    if (savedLang && savedLang in LANGUAGES) {
      setLanguage(savedLang);
      activeLang = savedLang;
    }

    const savedPersonality = localStorage.getItem('cybernus-personality');
    if (savedPersonality !== null) {
      const level = parseInt(savedPersonality, 10) as PersonalityLevel;
      if (level >= 0 && level <= 5) setPersonality(level);
    }

    const savedSidebar = localStorage.getItem('cybernus-sidebar');
    if (savedSidebar === 'closed') setSidebarOpen(false);

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

  /* ─── Persistence ─── */

  const handlePersonalityChange = useCallback((level: PersonalityLevel) => {
    setPersonality(level);
    localStorage.setItem('cybernus-personality', String(level));
  }, []);

  const handleLanguageChange = useCallback((lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('cybernus-language', lang);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      localStorage.setItem('cybernus-sidebar', prev ? 'closed' : 'open');
      return !prev;
    });
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
    <div className="relative flex h-full overflow-hidden bg-black" dir={langConfig.dir}>
      {/* ══════ Sidebar ══════ */}
      <aside
        className={cn(
          'flex h-full flex-col border-r border-emerald-500/10 bg-[#0a0a0a] transition-all duration-300',
          sidebarOpen ? 'w-72' : 'w-0 overflow-hidden border-r-0',
        )}
      >
        {/* Sidebar header — branding */}
        <div className="flex items-center justify-between border-b border-emerald-500/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center">
              <div className="absolute inset-0 rounded-lg bg-emerald-500/20 blur-sm" />
              <div className="absolute inset-0.5 rounded-lg border border-emerald-500/30 bg-black" />
              <span className="relative font-mono text-sm font-bold text-emerald-400">C</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-sm font-bold tracking-widest text-emerald-400">
                CYBERNUS
              </span>
              <span className="font-mono text-[9px] tracking-wide text-emerald-600">
                v4.1 // GROK ENGINE
              </span>
            </div>
          </div>
          <button
            onClick={toggleSidebar}
            className="text-emerald-600 transition-colors hover:text-emerald-400"
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* New Chat button */}
        <div className="px-3 pt-3 pb-2">
          <button
            onClick={clearChat}
            className="flex w-full items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 font-mono text-xs font-medium text-emerald-400 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:shadow-lg hover:shadow-emerald-500/5"
          >
            <MessageSquarePlus className="h-4 w-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Session list */}
        <div className="scrollbar-thin flex-1 overflow-y-auto px-2 py-1">
          <div className="mb-1.5 px-2 pt-1">
            <span className="font-mono text-[9px] font-semibold tracking-widest text-emerald-700 uppercase">
              History
            </span>
          </div>
          {sessions.length === 0 ? (
            <p className="px-2 py-4 text-center font-mono text-[10px] text-emerald-800">
              No sessions yet
            </p>
          ) : (
            <div className="space-y-0.5">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    'group flex cursor-pointer items-center justify-between gap-1.5 rounded-lg px-2.5 py-2 transition-all',
                    session.id === activeSessionId
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : 'text-emerald-600 hover:bg-emerald-500/5 hover:text-emerald-400',
                  )}
                  onClick={() => switchSession(session)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') switchSession(session);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs">{session.title}</p>
                    <p className="font-mono text-[9px] text-emerald-800">
                      {session.messages.filter((m) => m.role === 'user').length} msgs ·{' '}
                      {new Date(session.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(session.id);
                    }}
                    className="shrink-0 text-emerald-800 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400"
                    aria-label="Delete session"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {sessions.length > 1 && (
                <button
                  onClick={handleClearAll}
                  className="mt-1 w-full px-2.5 py-1.5 text-left font-mono text-[9px] text-emerald-800 transition-colors hover:text-red-400"
                >
                  Clear all history
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sidebar footer — controls */}
        <div className="space-y-3 border-t border-emerald-500/10 px-4 py-3">
          {/* Settings toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 font-mono text-[10px] transition-all',
              showSettings
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'text-emerald-600 hover:text-emerald-400',
            )}
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>

          {/* Collapsible settings panel */}
          {showSettings && (
            <div className="space-y-3 rounded-lg border border-emerald-500/10 bg-emerald-500/[0.03] p-3">
              <div>
                <span className="mb-1.5 block font-mono text-[9px] font-semibold tracking-widest text-emerald-700 uppercase">
                  Personality
                </span>
                <PersonalitySlider level={personality} onChange={handlePersonalityChange} />
                <span className={`mt-1 block font-mono text-[9px] ${personalityConfig.colorClass}`}>
                  {personalityConfig.label} — {personalityConfig.description}
                </span>
              </div>
              <div>
                <span className="mb-1.5 block font-mono text-[9px] font-semibold tracking-widest text-emerald-700 uppercase">
                  Language
                </span>
                <LanguageToggle language={language} onChange={handleLanguageChange} />
              </div>
            </div>
          )}

          {/* Back to portfolio */}
          <a
            href="/"
            className="flex items-center gap-2 font-mono text-[10px] text-emerald-700 transition-colors hover:text-emerald-400"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Back to Portfolio</span>
          </a>
        </div>
      </aside>

      {/* ══════ Main Chat Panel ══════ */}
      <main className="flex min-w-0 flex-1 flex-col bg-[#050505]">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-emerald-500/10 bg-[#0a0a0a]/80 px-4 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {/* Sidebar toggle (when collapsed) */}
            {!sidebarOpen && (
              <button
                onClick={toggleSidebar}
                className="text-emerald-600 transition-colors hover:text-emerald-400"
                aria-label="Open sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
            {/* Model info */}
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              <span className="font-mono text-xs text-emerald-500">Grok 4.1 Fast</span>
              <span className="font-mono text-[9px] text-emerald-800">// xAI</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Personality indicator */}
            <span className={`font-mono text-[10px] ${personalityConfig.colorClass}`}>
              [{personalityConfig.label.toUpperCase()}]
            </span>
            {/* Language badge */}
            <span className="font-mono text-[10px] text-emerald-700">
              {LANGUAGES[language].flag} {LANGUAGES[language].label}
            </span>
            {/* Message count */}
            {userMsgCount > 0 && (
              <span className="font-mono text-[9px] text-emerald-800">
                {userMsgCount}/{MAX_USER_MESSAGES}
              </span>
            )}
          </div>
        </header>

        {/* Messages area */}
        <ChatMessages
          messages={messages}
          isGenerating={isGenerating}
          thinkingStatus={thinkingStatus}
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
          inputRef={inputRef}
          onSend={sendMessage}
          onStop={handleStop}
          onClearChat={clearChat}
          language={language}
        />

        {/* Error overlay */}
        {messages.length > 0 &&
          messages[messages.length - 1]?.role === 'assistant' &&
          messages[messages.length - 1]?.content.startsWith('Something went wrong') && (
            <div className="animate-in fade-in slide-in-from-bottom-2 absolute bottom-20 left-1/2 z-20 -translate-x-1/2">
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 font-mono text-xs text-red-400 shadow-lg shadow-red-500/5 backdrop-blur-sm">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Error occurred — check console for details</span>
              </div>
            </div>
          )}
      </main>
    </div>
  );
}
