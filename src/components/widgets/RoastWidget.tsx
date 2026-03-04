/**
 * RoastWidget — Floating 🔥 FAB that opens a compact chat bubble
 * and streams a roast from Grok via the Cloudflare Worker proxy.
 *
 * Replaces the old static <a href="/chat?roast=1"> FAB.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { cloudChatStream } from '@lib/ai/cloud';
import { buildCloudContext } from '@lib/ai/cloud-context';
import { DEFAULT_CLOUD_MODEL_ID } from '@lib/ai/config';
import { renderMarkdown } from '@lib/ai/markdown';

type WidgetState = 'closed' | 'loading' | 'streaming' | 'done' | 'error';

export default function RoastWidget() {
  const [state, setState] = useState<WidgetState>('closed');
  const [response, setResponse] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const bubbleRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /** Scroll the bubble to the bottom as tokens stream in. */
  const scrollToBottom = useCallback(() => {
    const el = bubbleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [response, scrollToBottom]);

  /** Fire the roast request. */
  const startRoast = useCallback(async () => {
    setState('loading');
    setResponse('');
    setErrorMsg('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const context = await buildCloudContext();
      const systemMessage = { role: 'system' as const, content: context };
      const userMessage = { role: 'user' as const, content: 'Roast Tomer Nosrati 🔥' };

      setState('streaming');

      await cloudChatStream(
        [systemMessage, userMessage],
        DEFAULT_CLOUD_MODEL_ID,
        (_token, accumulated) => {
          setResponse(accumulated);
        },
        controller.signal,
      );

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
        startRoast();
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

  /** Re-roast: get a fresh roast without closing. */
  const handleReRoast = useCallback(() => {
    startRoast();
  }, [startRoast]);

  const isOpen = state !== 'closed';

  return (
    <>
      {/* Chat bubble */}
      {isOpen && (
        <div className="fixed right-4 bottom-24 z-50 w-[min(380px,calc(100vw-2rem))] sm:right-6">
          <div className="bg-bg-base border-border flex max-h-[60vh] flex-col overflow-hidden rounded-2xl border shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-orange-500/20 bg-gradient-to-r from-orange-500/10 to-red-500/10 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-base">🔥</span>
                <span className="text-sm font-semibold">Roast by Grok</span>
              </div>
              <div className="flex items-center gap-1">
                {(state === 'done' || state === 'error') && (
                  <button
                    onClick={handleReRoast}
                    aria-label="Get another roast"
                    className="text-text-muted hover:text-accent flex h-7 w-7 items-center justify-center rounded-md transition-colors"
                    title="Another roast"
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
                )}
                <button
                  onClick={handleFabClick}
                  aria-label="Close roast"
                  className="text-text-muted hover:text-text-primary flex h-7 w-7 items-center justify-center rounded-md transition-colors"
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
              {state === 'loading' && <LoadingIndicator />}
              {(state === 'streaming' || state === 'done') && (
                <div className="text-text-primary text-sm leading-relaxed">
                  {renderMarkdown(response)}
                </div>
              )}
              {state === 'error' && (
                <p className="text-sm text-red-400">{errorMsg || 'Failed to generate roast.'}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={handleFabClick}
        aria-label={isOpen ? 'Close roast' : 'Roast Tomer Nosrati'}
        className="roast-fab group fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
      >
        <span className="text-2xl transition-transform duration-300 group-hover:scale-125">
          {isOpen ? '✕' : '🔥'}
        </span>
      </button>
    </>
  );
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
