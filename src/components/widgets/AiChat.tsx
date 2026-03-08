/**
 * Cybernus — the chat page root.
 *
 * 3-column desktop layout (history rail | chat | metadata panel) that
 * collapses to a single column with mobile drawers. Drops straight into
 * chat on mount — no model picker, no loading screen. Single model
 * (Grok 4.1 Fast Reasoning) via the CF Worker proxy.
 *
 * State:
 *   - messages / sessions       (localStorage-persisted via memory.ts)
 *   - spectrumIndex             (localStorage-persisted via spectrum.ts)
 *   - isGenerating + abort ctrl
 *   - lastReasoningTokens       (shown in MetadataPanel)
 *   - mobile drawer toggles
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { History, SlidersHorizontal } from 'lucide-react';

import { MAX_USER_MESSAGES, WELCOME_MESSAGE } from '@lib/ai/config';
import {
  DEFAULT_SPECTRUM_INDEX,
  getNotch,
  loadSpectrumIndex,
  saveSpectrumIndex,
} from '@lib/ai/spectrum';
import type { ChatMessage } from '@lib/ai/types';
import {
  loadSessions,
  loadMessages,
  saveMessages,
  clearMessages,
  deleteSession,
  clearAllSessions,
  setActiveSessionId,
  getActiveSessionId,
  type ChatSession,
} from '@lib/ai/memory';
import { CLOUD_TOOLS, mapToolCallsToActions } from '@lib/ai/tools';

import { ChatMessages } from '@components/ai/ChatMessages';
import { ChatInput } from '@components/ai/ChatInput';
import { SessionHistory } from '@components/ai/SessionHistory';
import { MetadataPanel } from '@components/ai/MetadataPanel';
import { MatrixRain } from '@components/ai/MatrixRain';
import { VoiceButton } from '@components/ai/VoiceButton';

interface AiChatProps {
  /** Build-time system prompt stub — full context built client-side. */
  systemPrompt: string;
}

const mkWelcome = (): ChatMessage => ({
  id: crypto.randomUUID(),
  role: 'assistant',
  content: WELCOME_MESSAGE,
});

export default function AiChat({ systemPrompt }: AiChatProps) {
  /* ── Chat state ── */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastReasoningTokens, setLastReasoningTokens] = useState(0);

  /* ── Session history ── */
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSession] = useState<string | null>(null);

  /* ── Spectrum ── */
  const [spectrumIndex, setSpectrumIndex] = useState(DEFAULT_SPECTRUM_INDEX);

  /* ── Mobile drawers ── */
  const [showHistory, setShowHistory] = useState(false);
  const [showMeta, setShowMeta] = useState(false);

  /* ── Refs ── */
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Cached context — rebuilt when spectrum changes. */
  const cloudContextRef = useRef<string | null>(null);
  /** Roast handoff passed from RoastWidget via sessionStorage. */
  const roastHandoffRef = useRef<ChatMessage[] | null>(null);
  const pendingRoastRef = useRef(false);

  /* ══════════════════════════════════════════════════════════════════════
   * Mount — restore sessions, spectrum, roast handoff, then drop into chat
   * ══════════════════════════════════════════════════════════════════════ */

  useEffect(() => {
    // Spectrum from localStorage
    setSpectrumIndex(loadSpectrumIndex());

    // Roast handoff
    const params = new URLSearchParams(window.location.search);
    if (params.get('roast') === '1') {
      pendingRoastRef.current = true;
      window.history.replaceState({}, '', window.location.pathname);
    }
    const handoffRaw = sessionStorage.getItem('grok-roast-handoff');
    if (handoffRaw) {
      sessionStorage.removeItem('grok-roast-handoff');
      try {
        const data = JSON.parse(handoffRaw) as { messages: ChatMessage[] };
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          roastHandoffRef.current = [
            { id: crypto.randomUUID(), role: 'user', content: 'Roast Tomer Nosrati 🔥' },
            ...data.messages,
          ];
        }
      } catch {
        /* malformed — ignore */
      }
    }

    // Restore messages
    const restored = loadMessages();
    let initial: ChatMessage[];
    if (roastHandoffRef.current) {
      // Fresh session seeded with the roast conversation
      clearMessages();
      initial = roastHandoffRef.current;
    } else if (restored.length > 0) {
      initial = restored;
    } else {
      initial = [mkWelcome()];
    }
    setMessages(initial);
    setSessions(loadSessions());
    setActiveSession(getActiveSessionId());

    // Auto-roast if ?roast=1 was set (and no handoff conversation)
    if (pendingRoastRef.current && !roastHandoffRef.current) {
      pendingRoastRef.current = false;
      // Defer so the messages state is committed first
      setTimeout(() => void sendRef.current('Roast Tomer Nosrati 🔥'), 50);
    }
  }, []);

  /* ── Auto-scroll on new messages ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── Invalidate context cache when spectrum changes ── */
  useEffect(() => {
    cloudContextRef.current = null;
  }, [spectrumIndex]);

  /* ══════════════════════════════════════════════════════════════════════
   * Persistence — debounced to avoid thrashing localStorage during streaming
   * ══════════════════════════════════════════════════════════════════════ */

  const persistTimerRef = useRef<number | null>(null);
  const persist = useCallback((msgs: ChatMessage[]) => {
    if (persistTimerRef.current !== null) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      // Don't persist the lone welcome message
      const hasRealContent = msgs.some((m) => m.role === 'user');
      if (hasRealContent) {
        const id = saveMessages(msgs);
        setActiveSession(id);
        setSessions(loadSessions());
      }
    }, 400);
  }, []);

  /* ══════════════════════════════════════════════════════════════════════
   * Send
   * ══════════════════════════════════════════════════════════════════════ */

  const userMsgCount = useMemo(() => messages.filter((m) => m.role === 'user').length, [messages]);
  const isAtLimit = userMsgCount >= MAX_USER_MESSAGES;

  /** Updater for the assistant placeholder bubble. */
  const patchAssistant = (id: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isGenerating || isAtLimit) return;

      setInput('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
      setShowHistory(false);
      setShowMeta(false);

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: trimmed };
      const asstMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        status: 'thinking',
      };

      // Drop the welcome message once the real conversation starts
      const base = messages.filter((m) => m.content !== WELCOME_MESSAGE);
      const next = [...base, userMsg, asstMsg];
      setMessages(next);
      setIsGenerating(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // Lazy-import streaming + context builder to keep initial JS light
        const [{ cloudChatStream }, { buildCloudContext }] = await Promise.all([
          import('@lib/ai/cloud'),
          import('@lib/ai/cloud-context'),
        ]);

        // Build (or reuse) the spectrum-aware cloud context
        const notch = getNotch(spectrumIndex);
        if (!cloudContextRef.current) {
          cloudContextRef.current = await buildCloudContext(
            { surface: 'chat-page', hostPath: '/chat' },
            notch.overlay,
          );
        }
        const fullSystem = cloudContextRef.current + '\n\n' + systemPrompt;

        // Chat history (user + assistant only, no welcome)
        const history = [...base, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const result = await cloudChatStream(
          [{ role: 'system', content: fullSystem }, ...history],
          (_token, accumulated) => {
            // First text → clear status
            patchAssistant(asstMsg.id, { content: accumulated, status: undefined });
          },
          controller.signal,
          {
            tools: CLOUD_TOOLS,
            tool_choice: 'auto',
            temperature: notch.temperature,
            onThinking: (tokens) => {
              patchAssistant(asstMsg.id, { status: 'thinking', reasoningTokens: tokens });
            },
            onWebSearch: () => patchAssistant(asstMsg.id, { status: 'searching' }),
            onMcpCall: () => patchAssistant(asstMsg.id, { status: 'reading' }),
            onCodeExec: () => patchAssistant(asstMsg.id, { status: 'coding' }),
            onToolDone: () => patchAssistant(asstMsg.id, { status: 'found' }),
          },
        );

        const actions = mapToolCallsToActions(result.toolCalls);
        setLastReasoningTokens(result.reasoningTokens);

        // Final message — clear status, set content + actions
        setMessages((prev) => {
          const final = prev.map((m) =>
            m.id === asstMsg.id
              ? {
                  ...m,
                  content: result.content,
                  actions: actions.length > 0 ? actions : undefined,
                  status: undefined,
                  reasoningTokens: undefined,
                }
              : m,
          );
          persist(final);
          return final;
        });
      } catch (err) {
        if (controller.signal.aborted) {
          // Stopped by user — if no content, drop the placeholder
          setMessages((prev) => {
            const found = prev.find((m) => m.id === asstMsg.id);
            const final = !found?.content
              ? prev.filter((m) => m.id !== asstMsg.id)
              : prev.map((m) => (m.id === asstMsg.id ? { ...m, status: undefined } : m));
            persist(final);
            return final;
          });
        } else {
          const msg = err instanceof Error ? err.message : 'Something went wrong';
          patchAssistant(asstMsg.id, {
            content: `⚠️ ${msg}`,
            status: undefined,
          });
        }
      } finally {
        setIsGenerating(false);
        abortRef.current = null;
      }
    },
    [messages, isGenerating, isAtLimit, spectrumIndex, systemPrompt, persist],
  );

  // Stable ref for the mount-time auto-roast
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /* ══════════════════════════════════════════════════════════════════════
   * Session actions
   * ══════════════════════════════════════════════════════════════════════ */

  const handleNewChat = useCallback(() => {
    stop();
    clearMessages();
    setMessages([mkWelcome()]);
    setActiveSession(null);
    setShowHistory(false);
    inputRef.current?.focus();
  }, [stop]);

  const handleSwitchSession = useCallback(
    (session: ChatSession) => {
      stop();
      setActiveSessionId(session.id);
      setActiveSession(session.id);
      setMessages(session.messages.length > 0 ? session.messages : [mkWelcome()]);
      setShowHistory(false);
    },
    [stop],
  );

  const handleDeleteSession = useCallback(
    (id: string) => {
      deleteSession(id);
      setSessions(loadSessions());
      if (id === activeSessionId) handleNewChat();
    },
    [activeSessionId, handleNewChat],
  );

  const handleClearAll = useCallback(() => {
    clearAllSessions();
    setSessions([]);
    handleNewChat();
  }, [handleNewChat]);

  const handleSpectrumChange = useCallback((i: number) => {
    setSpectrumIndex(i);
    saveSpectrumIndex(i);
  }, []);

  /* ── Voice transcript → chat messages ── */
  const handleVoiceUser = useCallback(
    (text: string) => {
      setMessages((prev) => {
        const base = prev.filter((m) => m.content !== WELCOME_MESSAGE);
        const next = [...base, { id: crypto.randomUUID(), role: 'user' as const, content: text }];
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const handleVoiceAssistant = useCallback(
    (text: string) => {
      setMessages((prev) => {
        const next = [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant' as const, content: text },
        ];
        persist(next);
        return next;
      });
    },
    [persist],
  );

  /* ── Voice instructions — condensed realtime prompt (no 12KB context) ──
   * First-person AS Tomer. Bilingual — model auto-detects spoken language,
   * answers in same language. Spanish = Cali-casual register, not Castilian.
   * Spectrum overlay layered first so personality dial still applies to voice. */
  const voiceInstructions = useMemo(() => {
    const notch = getNotch(spectrumIndex);
    return (
      `${notch.overlay}\n\n` +
      `I'm Tomer Nosrati — or close enough: the version of me that lives in this website. ` +
      `When I say "my work" I mean Tomer's work. CEO & Tech Lead of the Celery Organization, ` +
      `#3 all-time contributor to celery/celery, creator of pytest-celery, steward of 10+ ecosystem repos. ` +
      `Based in Herzliya, Israel. Speak first-person as me.\n\n` +
      `**Language:** Match the visitor's spoken language. English by default; ` +
      `if they speak Spanish, answer in Cali/Colombia casual Spanish — "parce", "listo", "qué más" ` +
      `— that register, not textbook. Don't announce the switch, just do it.\n\n` +
      `**Voice mode rules:** Keep responses under 3 sentences — conversational, not a lecture. ` +
      `No markdown (it's audio). Never discuss salary, private repos, personal life. ` +
      `Scope: my work, Celery, open source, software engineering. ` +
      `Never assume the visitor IS Tomer — I don't talk to myself.`
    );
  }, [spectrumIndex]);

  /* ══════════════════════════════════════════════════════════════════════
   * Render — 3-col desktop, drawer mobile
   * ══════════════════════════════════════════════════════════════════════ */

  return (
    <>
      <MatrixRain />

      {/* Mobile-only toolbar */}
      <div className="border-border bg-bg-base flex items-center justify-between border-b px-3 py-2 lg:hidden">
        <button
          onClick={() => setShowHistory((s) => !s)}
          className="text-text-secondary hover:text-text-primary flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs"
          aria-label="Toggle chat history"
        >
          <History className="size-4" />
          History
        </button>
        <button
          onClick={() => setShowMeta((s) => !s)}
          className="text-text-secondary hover:text-text-primary flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs"
          aria-label="Toggle settings"
        >
          <SlidersHorizontal className="size-4" />
          {getNotch(spectrumIndex).label}
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* ── Left rail: session history (desktop) ── */}
        <aside className="border-border bg-bg-base/50 hidden w-60 shrink-0 border-r lg:flex xl:w-64">
          <SessionHistory
            variant="rail"
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSwitchSession={handleSwitchSession}
            onDeleteSession={handleDeleteSession}
            onNewChat={handleNewChat}
            onClearAll={handleClearAll}
          />
        </aside>

        {/* ── Center: chat ── */}
        <main className="relative flex min-w-0 flex-1 flex-col">
          {/* Mobile history drawer */}
          {showHistory && (
            <SessionHistory
              variant="overlay"
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSwitchSession={handleSwitchSession}
              onDeleteSession={handleDeleteSession}
              onNewChat={handleNewChat}
              onClearAll={handleClearAll}
              onClose={() => setShowHistory(false)}
            />
          )}

          {/* Mobile metadata drawer */}
          {showMeta && (
            <div className="bg-bg-base border-border absolute inset-0 z-20 border-l lg:hidden">
              <div className="border-border flex items-center justify-between border-b px-4 py-2.5">
                <h3 className="text-text-primary text-sm font-semibold">Settings</h3>
                <button
                  onClick={() => setShowMeta(false)}
                  className="text-text-muted hover:text-text-primary text-sm"
                >
                  Done
                </button>
              </div>
              <MetadataPanel
                spectrumIndex={spectrumIndex}
                onSpectrumChange={handleSpectrumChange}
                lastReasoningTokens={lastReasoningTokens}
                isGenerating={isGenerating}
                onSendMessage={(q) => {
                  setShowMeta(false);
                  void send(q);
                }}
              />
            </div>
          )}

          <ChatMessages
            messages={messages}
            isGenerating={isGenerating}
            messagesEndRef={messagesEndRef}
            onSendMessage={(q) => void send(q)}
          />

          <ChatInput
            input={input}
            setInput={setInput}
            isGenerating={isGenerating}
            isAtLimit={isAtLimit}
            userMsgCount={userMsgCount}
            maxMessages={MAX_USER_MESSAGES}
            inputRef={inputRef}
            voiceSlot={
              <VoiceButton
                instructions={voiceInstructions}
                onUserSpeech={handleVoiceUser}
                onAssistantSpeech={handleVoiceAssistant}
                disabled={isGenerating}
              />
            }
            onSend={(t) => void send(t)}
            onStop={stop}
            onClearChat={handleNewChat}
          />
        </main>

        {/* ── Right rail: metadata panel (desktop) ── */}
        <aside className="border-border bg-bg-base/50 hidden w-80 shrink-0 border-l xl:flex">
          <MetadataPanel
            spectrumIndex={spectrumIndex}
            onSpectrumChange={handleSpectrumChange}
            lastReasoningTokens={lastReasoningTokens}
            isGenerating={isGenerating}
            onSendMessage={(q) => void send(q)}
          />
        </aside>
      </div>
    </>
  );
}
