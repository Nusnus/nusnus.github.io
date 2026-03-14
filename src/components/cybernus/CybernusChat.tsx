/**
 * CybernusChat — the main /chat page component.
 *
 * Orchestrates:
 *   - Wide-screen 3-column layout: sessions | conversation | spectrum
 *   - Streaming chat over the xAI Responses API (via Cloudflare Worker)
 *   - Groky Spectrum personality slider
 *   - Live reasoning-token + tool-activity indicators
 *   - Multi-session localStorage persistence
 *   - Roast handoff from the homepage FAB
 *   - Voice dictation (Web Speech API)
 *   - EN / ES language toggle
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { cloudChatStream } from '@lib/ai/cloud';
import type { CloudMessage } from '@lib/ai/cloud';
import { DEFAULT_CLOUD_MODEL_ID, SUGGESTED_QUESTIONS, WELCOME_MESSAGE } from '@lib/ai/config';
import { renderMarkdown } from '@lib/ai/markdown';
import {
  clearAllSessions,
  deleteSession,
  getActiveSessionId,
  loadMessages,
  loadSessions,
  saveMessages,
  setActiveSessionId,
} from '@lib/ai/memory';
import type { ChatSession } from '@lib/ai/memory';
import { CYBERNUS_TOOLS, mapToolCallsToActions } from '@lib/ai/tools';
import type { ChatMessage } from '@lib/ai/types';
import { buildCybernusContext } from '@lib/cybernus/context';
import type { CybernusLanguage } from '@lib/cybernus/context';
import { trimHistoryForRequest } from '@lib/cybernus/history';
import { DEFAULT_SPECTRUM, SPECTRUM_STORAGE_KEY } from '@lib/cybernus/spectrum';
import { useViewport } from '@lib/cybernus/viewport';
import { cn } from '@lib/utils/cn';

import { ChatComposer } from './ChatComposer';
import type { ChatComposerHandle } from './ChatComposer';
import { GrokySpectrum } from './GrokySpectrum';
import { MatrixRain } from './MatrixRain';
import { MessageBubble } from './MessageBubble';
import { ModelBadge } from './ModelBadge';
import { SessionPanel } from './SessionPanel';
import { ThinkingIndicator } from './ThinkingIndicator';

/* ─── Constants ─── */

const ROAST_HANDOFF_KEY = 'grok-roast-handoff';
const LANG_STORAGE_KEY = 'cybernus-lang';

/* ─── Helpers ─── */

function readStoredNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function readStoredLang(): CybernusLanguage {
  try {
    const raw = localStorage.getItem(LANG_STORAGE_KEY);
    return raw === 'es' ? 'es' : 'en';
  } catch {
    return 'en';
  }
}

/* ─── Component ─── */

export default function CybernusChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);
  const [spectrum, setSpectrum] = useState(DEFAULT_SPECTRUM);
  const [language, setLanguage] = useState<CybernusLanguage>('en');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [reasoningTokens, setReasoningTokens] = useState<number | undefined>();
  const [toolActivity, setToolActivity] = useState<string[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const viewport = useViewport();

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ChatComposerHandle>(null);
  const spectrumRef = useRef(spectrum);
  const languageRef = useRef(language);
  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(() => {
    spectrumRef.current = spectrum;
  }, [spectrum]);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /* ── Boot ── */
  useEffect(() => {
    setSpectrum(readStoredNumber(SPECTRUM_STORAGE_KEY, DEFAULT_SPECTRUM));
    setLanguage(readStoredLang());

    let roastMessages: ChatMessage[] | null = null;
    try {
      const raw = sessionStorage.getItem(ROAST_HANDOFF_KEY);
      if (raw) {
        sessionStorage.removeItem(ROAST_HANDOFF_KEY);
        const data = JSON.parse(raw) as { messages?: ChatMessage[] };
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          roastMessages = [
            { id: crypto.randomUUID(), role: 'user', content: 'Roast Tomer Nosrati \u{1F525}' },
            ...data.messages,
          ];
        }
      }
    } catch {
      /* malformed handoff */
    }

    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('roast') === '1') {
        window.history.replaceState({}, '', window.location.pathname);
        queueMicrotask(() => composerRef.current?.seed('Roast yourself \u{1F525}'));
      }
    } catch {
      /* SSR / no URL */
    }

    if (roastMessages) {
      setActiveSessionId(null);
      setActiveSessionIdState(null);
      setMessages(roastMessages);
      const id = saveMessages(roastMessages);
      setActiveSessionId(id);
      setActiveSessionIdState(id);
    } else {
      const restored = loadMessages();
      setMessages(restored);
      setActiveSessionIdState(getActiveSessionId());
    }

    setSessions(loadSessions());
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  /* ── Persist spectrum + language ── */
  useEffect(() => {
    try {
      localStorage.setItem(SPECTRUM_STORAGE_KEY, String(spectrum));
    } catch {
      /* storage full */
    }
  }, [spectrum]);

  useEffect(() => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, language);
    } catch {
      /* ignore */
    }
  }, [language]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (near) el.scrollTop = el.scrollHeight;
  }, [messages, isThinking]);

  /* ── Persist messages ── */
  const persistTimer = useRef<number | null>(null);
  useEffect(() => {
    if (messages.length === 0) return;
    if (persistTimer.current !== null) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      const id = saveMessages(messages, activeSessionId ?? undefined);
      if (id !== activeSessionId) {
        setActiveSessionId(id);
        setActiveSessionIdState(id);
      }
      setSessions(loadSessions());
    }, 300);
    return () => {
      if (persistTimer.current !== null) window.clearTimeout(persistTimer.current);
    };
  }, [messages, activeSessionId]);

  /* ── Send ── */
  const send = useCallback(
    async (userText: string) => {
      if (streaming) return;

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: userText };
      const assistantId = crypto.randomUUID();
      const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '' };

      const snapshot = [...messagesRef.current, userMsg];
      setMessages([...snapshot, assistantMsg]);

      setStreaming(true);
      setIsThinking(true);
      setReasoningTokens(undefined);
      setToolActivity([]);
      setError('');

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const systemContext = await buildCybernusContext({
          spectrum: spectrumRef.current,
          pathname: window.location.pathname,
          viewport,
          surface: 'chat-page',
          language: languageRef.current,
        });

        const history: CloudMessage[] = [
          { role: 'system', content: systemContext },
          ...trimHistoryForRequest(snapshot).map((m) => ({ role: m.role, content: m.content })),
        ];

        const result = await cloudChatStream(
          history,
          DEFAULT_CLOUD_MODEL_ID,
          (_token, accumulated) => {
            setIsThinking(false);
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)),
            );
          },
          controller.signal,
          {
            tools: CYBERNUS_TOOLS,
            tool_choice: 'auto',
            onReasoning: (tokens) => setReasoningTokens(tokens),
            onToolActivity: (label, phase) => {
              if (phase === 'start') setIsThinking(true);
              setToolActivity((prev) => {
                if (phase === 'start') return [...prev, label];
                const idx = prev.indexOf(label);
                return idx === -1 ? prev : prev.filter((_l, i) => i !== idx);
              });
            },
          },
        );

        const actions = mapToolCallsToActions(result.toolCalls);
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            const finalised: ChatMessage = { ...m, content: result.content };
            if (actions.length > 0) finalised.actions = actions;
            if (result.reasoningTokens !== undefined) {
              finalised.reasoningTokens = result.reasoningTokens;
            }
            return finalised;
          }),
        );
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            return last && last.id === assistantId && !last.content ? prev.slice(0, -1) : prev;
          });
        } else {
          const msg = (err as Error).message || 'Request failed';
          setError(msg);
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: `*Error: ${msg}*` } : m)),
          );
        }
      } finally {
        setStreaming(false);
        setIsThinking(false);
        setToolActivity([]);
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [streaming, viewport],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /* ── Session management ── */
  const abortAndReset = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    setIsThinking(false);
    setToolActivity([]);
  }, []);

  const selectSession = useCallback(
    (id: string) => {
      abortAndReset();
      setActiveSessionId(id);
      setActiveSessionIdState(id);
      const all = loadSessions();
      const s = all.find((x) => x.id === id);
      setMessages(s?.messages ?? []);
      setSidebarOpen(false);
    },
    [abortAndReset],
  );

  const removeSession = useCallback(
    (id: string) => {
      deleteSession(id);
      setSessions(loadSessions());
      if (id === activeSessionId) {
        abortAndReset();
        setMessages([]);
        setActiveSessionId(null);
        setActiveSessionIdState(null);
      }
    },
    [activeSessionId, abortAndReset],
  );

  const newSession = useCallback(() => {
    abortAndReset();
    setActiveSessionId(null);
    setActiveSessionIdState(null);
    setMessages([]);
    setError('');
    setSidebarOpen(false);
  }, [abortAndReset]);

  const clearAll = useCallback(() => {
    abortAndReset();
    clearAllSessions();
    setSessions([]);
    setMessages([]);
    setActiveSessionId(null);
    setActiveSessionIdState(null);
    setError('');
    setSidebarOpen(false);
  }, [abortAndReset]);

  /* ── Derived ── */
  const isMobile = viewport === 'mobile';
  const showWelcome = messages.length === 0 && !streaming;
  const streamingMessageId = useMemo(
    () => (streaming ? messages[messages.length - 1]?.id : undefined),
    [streaming, messages],
  );

  /* ── Render ── */
  return (
    <div className="relative flex h-full w-full overflow-hidden">
      <MatrixRain columns={isMobile ? 20 : 40} />

      {/* Session sidebar */}
      <aside
        className={cn(
          'border-border bg-bg-surface/80 relative z-10 w-64 shrink-0 border-r backdrop-blur-md transition-transform',
          isMobile && 'absolute inset-y-0 left-0 shadow-2xl',
          isMobile && !sidebarOpen && '-translate-x-full',
        )}
      >
        <SessionPanel
          sessions={sessions}
          activeId={activeSessionId}
          onSelect={selectSession}
          onDelete={removeSession}
          onNew={newSession}
          onClearAll={clearAll}
        />
      </aside>

      {/* Mobile sidebar scrim */}
      {isMobile && sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sessions"
          className="absolute inset-0 z-[5] bg-black/40"
        />
      )}

      {/* Main column */}
      <div className="relative z-[1] flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="border-border/50 bg-bg-base/60 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            {isMobile && (
              <button
                type="button"
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label="Toggle sessions"
                className="text-text-muted hover:text-text-primary p-1"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <line x1="3" x2="21" y1="6" y2="6" />
                  <line x1="3" x2="21" y1="12" y2="12" />
                  <line x1="3" x2="21" y1="18" y2="18" />
                </svg>
              </button>
            )}
            <h1 className="font-mono text-sm">
              <span className="text-accent">Cybernus</span>
              <span className="text-text-muted"> :: digital_self</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLanguage((l) => (l === 'en' ? 'es' : 'en'))}
              aria-label={`Switch to ${language === 'en' ? 'Spanish' : 'English'}`}
              className="border-border hover:border-accent/50 rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors"
            >
              {language === 'en' ? 'EN' : 'ES'}
            </button>
            <ModelBadge />
          </div>
        </header>

        {/* Message scroll area */}
        <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto max-w-4xl space-y-4">
            {showWelcome && (
              <div className="cybernus-msg-in border-border bg-bg-surface/50 rounded-2xl border p-6 backdrop-blur-sm">
                <div className="text-text-primary text-sm">{renderMarkdown(WELCOME_MESSAGE)}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => composerRef.current?.seed(q)}
                      className="border-border hover:border-accent/50 hover:bg-accent/5 rounded-full border px-3 py-1.5 text-xs transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} streaming={m.id === streamingMessageId} />
            ))}

            {isThinking && (
              <div className="pl-4">
                <ThinkingIndicator
                  {...(reasoningTokens !== undefined && { reasoningTokens })}
                  toolActivity={toolActivity}
                />
              </div>
            )}

            {error && !streaming && (
              <div className="border-status-warning/30 bg-status-warning/10 text-status-warning rounded-lg border px-4 py-2 text-xs">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-border/50 bg-bg-base/60 shrink-0 border-t px-4 py-3 backdrop-blur-sm md:px-8">
          <div className="mx-auto max-w-4xl space-y-3">
            {isMobile && (
              <GrokySpectrum value={spectrum} onChange={setSpectrum} disabled={streaming} compact />
            )}
            <ChatComposer
              ref={composerRef}
              onSend={send}
              onStop={stop}
              streaming={streaming}
              language={language}
            />
          </div>
        </div>
      </div>

      {/* Right column: Groky Spectrum (desktop only) */}
      {!isMobile && (
        <aside className="border-border bg-bg-surface/80 relative z-10 w-80 shrink-0 border-l p-5 backdrop-blur-md">
          <div className="sticky top-0">
            <h2 className="text-text-secondary mb-4 font-mono text-xs tracking-wider uppercase">
              Groky Spectrum
            </h2>
            <GrokySpectrum value={spectrum} onChange={setSpectrum} disabled={streaming} />

            <div className="border-border/50 mt-6 border-t pt-4">
              <h3 className="text-text-muted mb-2 font-mono text-[10px] tracking-wider uppercase">
                About
              </h3>
              <p className="text-text-muted text-xs leading-relaxed">
                Drag the slider to tune how I talk. Left: boardroom. Right: bar at 2am. The facts
                stay the same — only the delivery changes.
              </p>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
