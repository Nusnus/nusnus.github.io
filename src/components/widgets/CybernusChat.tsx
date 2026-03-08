/**
 * CybernusChat — Tomer's digital self.
 *
 * Architecture:
 * - Single model (grok-4-1-fast-reasoning), single provider, no picker.
 * - Auto-initializes on mount. No engine states, no WebGPU check.
 * - Context built client-side via buildCybernusContext() and cached.
 * - Groky Spectrum controls tone (prompt injection) + temperature.
 * - Language toggle EN/ES rebuilds the welcome message and UI strings.
 * - Reasoning events from cloud.ts drive the "thinking" indicator.
 * - Sessions persist in localStorage; long chats are auto-summarized.
 * - Roast handoff from RoastWidget preserved exactly (sessionStorage + ?roast=1).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CYBERNUS_MODEL_ID,
  MAX_USER_MESSAGES,
  GROKY_SPECTRUM,
  DEFAULT_SPECTRUM_LEVEL,
  DEFAULT_LANGUAGE,
  SPECTRUM_STORAGE_KEY,
  LANGUAGE_STORAGE_KEY,
  getWelcomeMessage,
  type SpectrumLevel,
  type ChatLanguage,
} from '@lib/ai/config';
import type { ChatMessage } from '@lib/ai/types';
import type { CloudMessage } from '@lib/ai/cloud';
import {
  saveMessages,
  loadMessages,
  clearMessages,
  loadSessions,
  deleteSession,
  clearAllSessions,
  setActiveSessionId,
  getActiveSessionId,
} from '@lib/ai/memory';
import type { ChatSession } from '@lib/ai/memory';
import { CLOUD_TOOLS, mapToolCallsToActions } from '@lib/ai/tools';
import { MatrixRain } from '@components/ai/MatrixRain';
import { CybernusHeader } from '@components/ai/CybernusHeader';
import { GrokySpectrum } from '@components/ai/GrokySpectrum';
import { SessionHistory } from '@components/ai/SessionHistory';
import { ChatMessages } from '@components/ai/ChatMessages';
import { ChatInput } from '@components/ai/ChatInput';

/* ─── Persistence helpers (spectrum + language) ─── */

function loadSpectrum(): SpectrumLevel {
  try {
    const raw = localStorage.getItem(SPECTRUM_STORAGE_KEY);
    if (raw === null) return DEFAULT_SPECTRUM_LEVEL;
    const n = Number(raw);
    if (n >= 0 && n <= 4 && Number.isInteger(n)) return n as SpectrumLevel;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_SPECTRUM_LEVEL;
}

function loadLanguage(): ChatLanguage {
  try {
    const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (raw === 'en' || raw === 'es') return raw;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_LANGUAGE;
}

function persistSpectrum(level: SpectrumLevel): void {
  try {
    localStorage.setItem(SPECTRUM_STORAGE_KEY, String(level));
  } catch {
    /* storage unavailable */
  }
}

function persistLanguage(lang: ChatLanguage): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    /* storage unavailable */
  }
}

/** Create a fresh welcome-message-only state for the given language. */
function freshWelcome(lang: ChatLanguage): ChatMessage[] {
  return [{ id: crypto.randomUUID(), role: 'assistant', content: getWelcomeMessage(lang) }];
}

/** Is this message the welcome message for any supported language? */
function isWelcomeMessage(content: string): boolean {
  return content === getWelcomeMessage('en') || content === getWelcomeMessage('es');
}

/* ─── Component ─── */

export default function CybernusChat() {
  // Spectrum & language — loaded from localStorage on mount (hydrated below).
  const [spectrum, setSpectrum] = useState<SpectrumLevel>(DEFAULT_SPECTRUM_LEVEL);
  const [language, setLanguage] = useState<ChatLanguage>(DEFAULT_LANGUAGE);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // UI state
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  /** Cache the system context — it's ~15K tokens and only changes on spectrum/lang. */
  const contextCacheRef = useRef<{ key: string; value: string } | null>(null);

  /** Detect ?roast=1 query param for 1-click roast from FAB. */
  const pendingRoast = useRef(false);
  /** Roast conversation passed from RoastWidget via sessionStorage. */
  const roastHandoffRef = useRef<ChatMessage[] | null>(null);
  /** Track whether this conversation came from a roast handoff (for context). */
  const fromRoastRef = useRef(false);

  /* ─── Mount: hydrate everything, set up initial messages ─── */

  useEffect(() => {
    // Roast handoff — same semantics as the old AiChat.
    const params = new URLSearchParams(window.location.search);
    if (params.get('roast') === '1') {
      pendingRoast.current = true;
      fromRoastRef.current = true;
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
          fromRoastRef.current = true;
        }
      } catch {
        /* ignore malformed handoff */
      }
    }

    // Hydrate spectrum + language from localStorage.
    const loadedSpectrum = loadSpectrum();
    const loadedLang = loadLanguage();
    setSpectrum(loadedSpectrum);
    setLanguage(loadedLang);

    // Hydrate sessions.
    setSessions(loadSessions());
    setActiveSessionIdState(getActiveSessionId());

    // Initial messages — handoff > ?roast=1 > saved session > fresh welcome.
    // Roast (either flavor) is always a fresh session.
    if (roastHandoffRef.current) {
      clearMessages();
      setActiveSessionIdState(null);
      setMessages(roastHandoffRef.current);
      roastHandoffRef.current = null;
    } else if (pendingRoast.current) {
      // ?roast=1 without sessionStorage handoff — old AiChat called
      // initEngine(true) here. Clear the session so the auto-sent roast
      // doesn't append into a restored conversation.
      clearMessages();
      setActiveSessionIdState(null);
      setMessages(freshWelcome(loadedLang));
    } else {
      const saved = loadMessages();
      if (saved.length > 0) {
        setMessages(saved);
      } else {
        setMessages(freshWelcome(loadedLang));
      }
    }

    setReady(true);
  }, []);

  /* ─── Auto-scroll on new messages ─── */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ─── Focus input when ready ─── */

  useEffect(() => {
    if (ready) inputRef.current?.focus();
  }, [ready]);

  /* ─── Context builder — cached by spectrum+language+fromRoast ─── */

  const getSystemContext = useCallback(async (): Promise<string> => {
    const key = `${spectrum}|${language}|${fromRoastRef.current}`;
    const cached = contextCacheRef.current;
    if (cached && cached.key === key) return cached.value;

    const { buildCybernusContext } = await import('@lib/ai/cybernus-context');
    const ctx = await buildCybernusContext({
      spectrum,
      language,
      fromRoast: fromRoastRef.current,
    });
    contextCacheRef.current = { key, value: ctx };
    return ctx;
  }, [spectrum, language]);

  /* ─── Send ─── */

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

      const controller = new AbortController();
      abortControllerRef.current = controller;

      /** Update the placeholder assistant message safely. */
      const patchAsst = (patch: (m: ChatMessage) => ChatMessage) => {
        if (abortRef.current) return;
        setMessages((prev) => prev.map((m) => (m.id === asstMsg.id ? patch(m) : m)));
      };

      try {
        // Lazy-import the heavy bits so the initial page bundle stays small.
        const [{ cloudChatStream }, systemContext, { maybeSummarizeCloud }] = await Promise.all([
          import('@lib/ai/cloud'),
          getSystemContext(),
          import('@lib/ai/cloud-summarize'),
        ]);

        // Summarize old messages if the conversation is getting long.
        // Done before building history so the summary is sent to the model.
        const summarizedBase = await maybeSummarizeCloud(messages);
        if (summarizedBase !== messages && !controller.signal.aborted) {
          // Keep the summarized base + the new user+asst bubbles in state.
          // Guard is per-invocation: maybeSummarizeCloud is unabortable, and
          // handleStop flips isGenerating synchronously — the user can
          // stop + re-send before this resolves. A newer sendMessage resets
          // the shared abortRef, but nothing can un-abort *this* controller.
          // Covers clearChat/switchSession too (both call .abort()).
          setMessages([...summarizedBase, userMsg, asstMsg]);
        }

        // Build history — filter out welcome + placeholder, keep summary messages.
        const chatHistory: CloudMessage[] = [...summarizedBase, userMsg]
          .filter((m) => {
            if (m.role === 'user') return true;
            // assistant: drop the welcome message and empty placeholders
            return m.content !== '' && !isWelcomeMessage(m.content);
          })
          .map((m) => ({ role: m.role, content: m.content }));

        const spectrumCfg = GROKY_SPECTRUM[spectrum];

        const result = await cloudChatStream(
          [{ role: 'system', content: systemContext }, ...chatHistory],
          CYBERNUS_MODEL_ID,
          (_token, accumulated) => {
            patchAsst((m) => {
              // First content delta — drop thinking + searchStatus flags.
              const { thinking: _t, searchStatus: _s, ...rest } = m;
              return { ...rest, content: accumulated };
            });
          },
          controller.signal,
          {
            tools: CLOUD_TOOLS,
            tool_choice: 'auto',
            temperature: spectrumCfg.temperature,
            onReasoningStart: () => {
              patchAsst((m) => ({ ...m, thinking: true }));
            },
            onReasoningDone: () => {
              patchAsst((m) => {
                const { thinking: _t, ...rest } = m;
                return rest;
              });
            },
            onWebSearch: () => {
              patchAsst((m) => {
                const { thinking: _t, ...rest } = m;
                return { ...rest, searchStatus: 'searching' };
              });
            },
            onWebSearchFound: () => {
              patchAsst((m) => ({ ...m, searchStatus: 'found' }));
            },
          },
        );

        const full = result.content;
        const actions = result.toolCalls.length > 0 ? mapToolCallsToActions(result.toolCalls) : [];

        if (actions.length > 0 || !full) {
          patchAsst((m) => {
            const { thinking: _t, searchStatus: _s, ...rest } = m;
            return { ...rest, content: full || '*(used tools only)*', actions };
          });
        }

        // Persist the finished conversation.
        setMessages((prev) => {
          const sid = saveMessages(prev, activeSessionId ?? undefined);
          setActiveSessionIdState(sid);
          setSessions(loadSessions());
          return prev;
        });
      } catch (err) {
        if (controller.signal.aborted) {
          // User hit stop — leave whatever content accumulated.
          // Can't use patchAsst here: handleStop set abortRef.current = true
          // before aborting, so the guard would silently drop this cleanup
          // and leave thinking/searchStatus indicators stuck on screen.
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== asstMsg.id) return m;
              const { thinking: _t, searchStatus: _s, ...rest } = m;
              return rest.content ? rest : { ...rest, content: '*(stopped)*' };
            }),
          );
        } else {
          console.error('[Cybernus] Generation error:', err);
          const errText = err instanceof Error ? err.message : 'Something went wrong';
          const friendlyMsg = errText.includes('429')
            ? 'Rate limited — please wait a moment and try again.'
            : errText.includes('Empty response')
              ? 'Got an empty response. Try rephrasing or starting a new chat.'
              : `Something went wrong: ${errText}`;
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== asstMsg.id) return m;
              const { thinking: _t, searchStatus: _s, ...rest } = m;
              return { ...rest, content: friendlyMsg };
            }),
          );
        }
      } finally {
        // Only clean up if we're still the active generation. If the user
        // stopped and re-sent during summarize, a newer sendMessage owns
        // these refs now — clobbering them would drop that generation's
        // stop button and leak its controller.
        if (abortControllerRef.current === controller) {
          setIsGenerating(false);
          abortControllerRef.current = null;
        }
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [messages, isGenerating, spectrum, getSystemContext, activeSessionId],
  );

  /* ─── Auto-send roast when triggered via ?roast=1 FAB ─── */

  const roastSentRef = useRef(false);
  useEffect(() => {
    if (ready && pendingRoast.current && !roastSentRef.current) {
      roastSentRef.current = true;
      pendingRoast.current = false;
      void sendMessage('Roast Tomer Nosrati 🔥');
    }
  }, [ready, sendMessage]);

  /* ─── Actions ─── */

  const handleStop = useCallback(() => {
    abortRef.current = true;
    abortControllerRef.current?.abort();
    setIsGenerating(false);
  }, []);

  const clearChat = useCallback(() => {
    abortRef.current = true;
    abortControllerRef.current?.abort();
    setIsGenerating(false);
    clearMessages();
    setActiveSessionIdState(null);
    fromRoastRef.current = false;
    contextCacheRef.current = null; // fromRoast changed
    setMessages(freshWelcome(language));
  }, [language]);

  const switchSession = useCallback((session: ChatSession) => {
    abortRef.current = true;
    abortControllerRef.current?.abort();
    setIsGenerating(false);
    setActiveSessionId(session.id);
    setActiveSessionIdState(session.id);
    fromRoastRef.current = false;
    contextCacheRef.current = null;
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

  const handleSpectrumChange = useCallback((level: SpectrumLevel) => {
    setSpectrum(level);
    persistSpectrum(level);
    contextCacheRef.current = null;
  }, []);

  const handleToggleLanguage = useCallback(() => {
    setLanguage((prev) => {
      const next: ChatLanguage = prev === 'en' ? 'es' : 'en';
      persistLanguage(next);
      contextCacheRef.current = null;
      // If the only message is the welcome, swap it to the new language.
      setMessages((msgs) => {
        if (
          msgs.length === 1 &&
          msgs[0]?.role === 'assistant' &&
          isWelcomeMessage(msgs[0].content)
        ) {
          return freshWelcome(next);
        }
        return msgs;
      });
      return next;
    });
  }, []);

  /* ─── Render ─── */

  const userMsgCount = messages.filter((m) => m.role === 'user').length;
  const isAtLimit = userMsgCount >= MAX_USER_MESSAGES;

  return (
    <div className="relative flex h-full flex-col">
      <MatrixRain />

      <CybernusHeader
        language={language}
        onToggleLanguage={handleToggleLanguage}
        onToggleHistory={() => setShowHistory((s) => !s)}
        onNewChat={clearChat}
        disabled={isGenerating}
      />

      {/* Main area — session history overlays this region */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
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

        <ChatMessages
          messages={messages}
          isGenerating={isGenerating}
          language={language}
          messagesEndRef={messagesEndRef}
          onSendMessage={sendMessage}
        />

        {/* Groky Spectrum — sits above the input, constrained to same max width */}
        <div className="relative z-10 px-4 pb-2">
          <div className="mx-auto max-w-4xl">
            <GrokySpectrum
              value={spectrum}
              onChange={handleSpectrumChange}
              disabled={isGenerating}
            />
          </div>
        </div>

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
    </div>
  );
}
