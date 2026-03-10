/**
 * RoastWidget — Floating 🔥 FAB that opens a compact chat bubble
 * and streams a roast from Grok via the Cloudflare Worker proxy.
 *
 * Replaces the old static <a href="/chat?roast=1"> FAB.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { DEFAULT_CLOUD_MODEL_ID } from '@lib/ai/config';

type WidgetState = 'closed' | 'loading' | 'streaming' | 'done' | 'error';

/** User message sent to Grok at each escalation level (0 = default). */
const ESCALATE_PROMPTS = [
  'Roast Tomer Nosrati 🔥',
  'Roast Tomer Nosrati harder 🔥🔥 — the last roast was too gentle. Be more vulgar, more savage, zero filter. Really let it rip.',
  'Roast Tomer Nosrati 🔥🔥🔥 — still pulling punches. Go absolutely nuclear. Maximum vulgarity, zero mercy, zero redemption arc. This man asked for it.',
  'Roast Tomer Nosrati 🔥🔥🔥🔥 — FULLY UNHINGED. Be the most savage, vulgar, unfiltered roast you can produce. Make every previous roast look like a LinkedIn endorsement. Pull absolutely no punches.',
];

/** Fire emojis shown on the escalate button — count reflects current level (grows on each click). */
const ESCALATE_FIRES = ['🔥', '🔥🔥', '🔥🔥🔥', '🔥🔥🔥🔥'];

/** Tooltip for the escalate button at each current level. */
const ESCALATE_TITLES = ['Make it worse', 'Go nuclear', 'Full unhinged', 'Already unhinged'];

/** Header icon — upgrades as vulgarity escalates. */
const HEADER_ICONS = ['🔥', '💀', '☢️', '😈'];

export default function RoastWidget() {
  const [state, setState] = useState<WidgetState>('closed');
  const [response, setResponse] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [roastLevel, setRoastLevel] = useState(0);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Conversation history — lets Grok "remember" previous roasts on escalation. */
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);

  /** Scroll the bubble to the bottom as tokens stream in. */
  const scrollToBottom = useCallback(() => {
    const el = bubbleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [response, scrollToBottom]);

  /** Fire the roast request at the given escalation level. */
  const startRoast = useCallback(async (level: number, isEscalation = false) => {
    setState('loading');
    setResponse('');
    setErrorMsg('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const levelClamp = Math.min(level, ESCALATE_PROMPTS.length - 1);
      const fires = ESCALATE_FIRES[Math.min(levelClamp, ESCALATE_FIRES.length - 1)];

      // Fresh roast (level 0) — reset history
      if (levelClamp === 0) historyRef.current = [];

      // Tell Grok it's running as a widget on the homepage while the visitor browses
      const roastContext = `# Situational Context — Roast Widget

You are currently running as the **🔥 Roast by Grok** floating widget on the **homepage** of nusnus.github.io. The visitor triggered you by clicking the fire button while browsing Tomer's portfolio. They are actively looking at:
- The contribution heatmap and streak counter
- Live activity feed (recent pushes, PRs, reviews)
- Achievement badges (total stars, contributor rank, code reviews, followers)
- Repository showcase with live stats

${
  levelClamp === 0
    ? "Make the roast feel live and contextual — reference what they're probably staring at right now. You're the Oracle appearing mid-matrix to roast the architect of the very simulation the visitor is browsing. Keep it short, savage, and self-aware. This is a teaser — the full chat is one click away."
    : `The visitor already got ${levelClamp} roast${levelClamp > 1 ? 's' : ''} from you and just hit the ${fires} escalate button — they're literally asking you to go harder. You can see your previous roast${levelClamp > 1 ? 's' : ''} in the conversation. Acknowledge that they came back for more (be smug about it), then deliver a fresh roast that's rawer, more vulgar, more savage. Don't repeat material from your previous roast${levelClamp > 1 ? 's' : ''}. Keep it short, punchy, contextual to the page they're browsing.`
}`;

      const [{ cloudChatStream }, { buildCloudContext }] = await Promise.all([
        import('@lib/ai/cloud'),
        import('@lib/ai/cloud-context'),
      ]);

      const context = await buildCloudContext(roastContext);
      const systemMessage = { role: 'system' as const, content: context };
      const userMessage = {
        role: 'user' as const,
        content: ESCALATE_PROMPTS[levelClamp] ?? 'Roast Tomer Nosrati 🔥',
      };

      // Build messages: system + prior roast history (on escalation) + new user prompt
      const messages = [systemMessage, ...(isEscalation ? historyRef.current : []), userMessage];

      setState('streaming');

      const { content } = await cloudChatStream(
        messages,
        DEFAULT_CLOUD_MODEL_ID,
        (_token, accumulated) => {
          setResponse(accumulated);
        },
        controller.signal,
      );

      // Append this exchange to history so the next escalation sees it
      if (isEscalation || levelClamp === 0) {
        historyRef.current.push(
          { role: 'user', content: userMessage.content },
          { role: 'assistant', content },
        );
      }

      setState('done');
    } catch (err) {
      if (controller.signal.aborted) {
        setState('closed');
        return;
      }
      console.error('[RoastWidget] Error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      setState('error');
    }
  }, []);

  /** Toggle the widget open/closed. */
  const handleFabClick = useCallback(() => {
    if (state === 'closed' || state === 'done' || state === 'error') {
      if (state === 'closed') {
        setRoastLevel(0);
        startRoast(0);
      } else {
        // Close the bubble
        setState('closed');
        setResponse('');
      }
    } else {
      // Abort in-flight request and close
      abortRef.current?.abort();
      setState('closed');
      setResponse('');
    }
  }, [state, startRoast]);

  /** Re-roast at the same level (SVG refresh — no prompt change). */
  const handleReRoast = useCallback(() => {
    startRoast(roastLevel);
  }, [roastLevel, startRoast]);

  /** Escalate: increment vulgarity level and re-roast with a harder prompt. */
  const handleEscalate = useCallback(() => {
    const nextLevel = roastLevel + 1;
    setRoastLevel(nextLevel);
    startRoast(nextLevel, true);
  }, [roastLevel, startRoast]);

  /** Prefetch the chat page so navigation is near-instant. */
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = '/chat';
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  /** Continue the roast in the full chat page, passing the conversation via sessionStorage. */
  const handleContinueInChat = useCallback(() => {
    if (!response) return;
    const handoff = {
      messages: [{ id: crypto.randomUUID(), role: 'assistant', content: response }],
    };
    sessionStorage.setItem('grok-roast-handoff', JSON.stringify(handoff));
    window.location.href = '/chat';
  }, [response]);

  const isOpen = state !== 'closed';

  return (
    <>
      {/* Chat bubble */}
      {isOpen && (
        <div className="fixed right-4 bottom-20 z-50 w-[min(380px,calc(100vw-2rem))] sm:right-6 sm:bottom-24">
          <div className="bg-bg-base border-border flex max-h-[60vh] flex-col overflow-hidden rounded-2xl border shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-orange-500/20 bg-gradient-to-r from-orange-500/10 to-red-500/10 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-base">
                  {HEADER_ICONS[Math.min(roastLevel, HEADER_ICONS.length - 1)]}
                </span>
                <span className="text-sm font-semibold">Roast by Grok</span>
              </div>
              <div className="flex items-center gap-1">
                {(state === 'done' || state === 'error') && (
                  <>
                    {/* Escalate: harder prompt each click — emoji size kept at default so
                        multiple fires render clearly side-by-side */}
                    <button
                      onClick={handleEscalate}
                      aria-label="Make it more vulgar"
                      className="roast-header-btn flex h-7 items-center justify-center rounded-md px-2 transition-all hover:scale-125"
                      title={ESCALATE_TITLES[Math.min(roastLevel, ESCALATE_TITLES.length - 1)]}
                      style={{ animationDelay: '0s' }}
                    >
                      {ESCALATE_FIRES[Math.min(roastLevel, ESCALATE_FIRES.length - 1)]}
                    </button>
                    {/* Refresh: same level, same prompt */}
                    <button
                      onClick={handleReRoast}
                      aria-label="Roast again"
                      className="roast-header-btn flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition-colors hover:text-white"
                      title="Roast again"
                      style={{ animationDelay: '0.3s' }}
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
                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                        <path d="M16 16h5v5" />
                      </svg>
                    </button>
                  </>
                )}
                <button
                  onClick={handleFabClick}
                  aria-label="Close roast"
                  className="roast-header-btn text-text-muted hover:text-text-primary flex h-7 w-7 items-center justify-center rounded-md transition-colors"
                  style={{ animationDelay: '0.6s' }}
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
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div ref={bubbleRef} className="scrollbar-thin overflow-y-auto px-4 py-3">
              {(state === 'loading' || (state === 'streaming' && !response)) && (
                <LoadingIndicator />
              )}
              {(state === 'streaming' || state === 'done') && response && (
                <RoastContent response={response} streaming={state === 'streaming'} />
              )}
              {state === 'error' && (
                <p className="text-sm text-red-400">{errorMsg || 'Failed to generate roast.'}</p>
              )}
            </div>

            {/* Footer — Continue in Chat */}
            {state === 'done' && response && (
              <div className="border-t border-orange-500/10 px-4 py-2">
                <button
                  onClick={handleContinueInChat}
                  className="text-accent hover:text-accent/80 flex w-full items-center justify-end gap-1 text-xs font-medium transition-colors"
                >
                  Continue in Chat →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={handleFabClick}
        aria-label={isOpen ? 'Close roast' : 'Roast Tomer Nosrati'}
        className="roast-fab group fixed right-4 bottom-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 sm:right-6 sm:bottom-6"
      >
        <span className="text-2xl transition-transform duration-300 group-hover:scale-125">
          {isOpen ? '✕' : '🔥'}
        </span>
      </button>
    </>
  );
}

/** Lazily renders markdown content — avoids pulling renderMarkdown into the idle bundle. */
function RoastContent({ response, streaming }: { response: string; streaming: boolean }) {
  const [renderFn, setRenderFn] = useState<
    ((md: string, streaming: boolean) => React.ReactNode) | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    import('@lib/ai/markdown').then(({ renderMarkdown }) => {
      if (!cancelled) setRenderFn(() => renderMarkdown);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const content = renderFn ? renderFn(response, streaming) : response;
  return <div className="text-text-primary text-sm leading-relaxed">{content}</div>;
}

/** Pulsing dots loading indicator. */
function LoadingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      <span className="text-text-muted text-sm">Grok is cooking</span>
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="bg-accent inline-block h-1.5 w-1.5 rounded-full"
            style={{
              animation: 'roast-dot 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </span>
    </div>
  );
}
