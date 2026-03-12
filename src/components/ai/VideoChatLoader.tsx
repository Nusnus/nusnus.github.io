/**
 * VideoChatLoader — engaging loading screen for video generation.
 *
 * Shown while the AI generates a video response (10-30 seconds).
 * Features rotating cinematic messages, animated film-strip frames,
 * pulsing glow effects, and a fake estimated-time progress bar to
 * keep users engaged during the wait.
 *
 * Performance: progress bar and ETA use direct DOM manipulation via
 * refs + requestAnimationFrame — no React re-renders during animation.
 */

import { useState, useEffect, memo, useRef } from 'react';

const LOADING_MESSAGES = [
  'Setting the scene...',
  'Directing the camera...',
  'Rolling film...',
  'Crafting the visuals...',
  'Composing the narrative...',
  'Rendering cinematic frames...',
  'Preparing your experience...',
  'Adjusting the lighting...',
  'Curating the story...',
  'Assembling the sequence...',
];

/** Estimated total generation time in seconds. Progress bar fills to ~90% over this period. */
const ESTIMATED_DURATION_S = 25;

/** Film strip frame — a single decorative frame */
function FilmFrame({ delay, side }: { delay: number; side: 'left' | 'right' }) {
  return (
    <div
      className="video-chat-film-frame absolute h-8 w-12 rounded border border-[#00ff41]/15 bg-[#00ff41]/[0.03] sm:h-10 sm:w-14"
      style={{
        animationDelay: `${delay}s`,
        [side]: '8px',
        top: `${((delay * 60) % 80) + 5}%`,
      }}
    />
  );
}

interface VideoChatLoaderProps {
  /** Optional variant for different contexts */
  variant?: 'initial' | 'generating' | undefined;
}

export const VideoChatLoader = memo(function VideoChatLoader({
  variant = 'initial',
}: VideoChatLoaderProps) {
  const [msgIndex, setMsgIndex] = useState(() =>
    Math.floor(Math.random() * LOADING_MESSAGES.length),
  );
  const [fadeIn, setFadeIn] = useState(true);
  const startTimeRef = useRef(0);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const etaRef = useRef<HTMLSpanElement>(null);
  const rafIdRef = useRef(0);

  // Initialize startTime once on mount
  useEffect(() => {
    startTimeRef.current = Date.now();
  }, []);

  // Cycle through loading messages (only state-driven animation that needs re-renders)
  useEffect(() => {
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];
    const intervalId = setInterval(() => {
      setFadeIn(false);
      const tid = setTimeout(() => {
        setMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
        setFadeIn(true);
      }, 300);
      timeoutIds.push(tid);
    }, 3000);

    return () => {
      clearInterval(intervalId);
      timeoutIds.forEach((tid) => clearTimeout(tid));
    };
  }, []);

  // Progress bar animation via requestAnimationFrame + direct DOM manipulation.
  // Updates bar width, percentage text, and ETA without any React re-renders.
  useEffect(() => {
    const tick = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const ratio = Math.min(elapsed / ESTIMATED_DURATION_S, 1);
      // easeOutQuart: fast start, slow finish — feels natural
      const eased = 1 - Math.pow(1 - ratio, 4);
      // Cap at 92% and then crawl slowly beyond the estimate
      const capped = eased * 0.92;
      const crawl = ratio >= 1 ? Math.min((elapsed - ESTIMATED_DURATION_S) * 0.002, 0.07) : 0;
      const progress = Math.min(capped + crawl, 0.99);
      const pct = Math.round(progress * 100);
      const remaining = Math.max(0, ESTIMATED_DURATION_S - Math.round(elapsed));

      // Direct DOM updates — no setState, no re-render
      if (progressBarRef.current) progressBarRef.current.style.width = `${pct}%`;
      if (pctRef.current) pctRef.current.textContent = `${pct}%`;
      if (etaRef.current) {
        etaRef.current.textContent = remaining > 0 ? `~${remaining}s` : '';
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, []);

  return (
    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-[#00ff41]/10 bg-[#0a0a0a] sm:rounded-2xl">
      {/* Background ambient glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="video-chat-loader-glow absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00ff41]/[0.04] blur-3xl sm:h-80 sm:w-80" />
      </div>

      {/* Film strip decorative frames — left side (hidden on very small screens) */}
      <div className="absolute top-0 left-0 hidden h-full w-14 overflow-hidden opacity-30 sm:block sm:w-16">
        <FilmFrame delay={0} side="left" />
        <FilmFrame delay={0.8} side="left" />
        <FilmFrame delay={1.6} side="left" />
        <FilmFrame delay={2.4} side="left" />
      </div>

      {/* Film strip decorative frames — right side (hidden on very small screens) */}
      <div className="absolute top-0 right-0 hidden h-full w-14 overflow-hidden opacity-30 sm:block sm:w-16">
        <FilmFrame delay={0.4} side="right" />
        <FilmFrame delay={1.2} side="right" />
        <FilmFrame delay={2.0} side="right" />
        <FilmFrame delay={2.8} side="right" />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-4 px-4 sm:gap-6 sm:px-6">
        {/* Animated icon */}
        <div className="relative">
          {/* Outer pulsing ring */}
          <div className="video-chat-loader-ring absolute -inset-4 rounded-full border border-[#00ff41]/20 sm:-inset-5" />
          {/* Middle pulsing ring */}
          <div
            className="video-chat-loader-ring absolute -inset-2 rounded-full border border-[#00ff41]/10 sm:-inset-3"
            style={{ animationDelay: '0.5s' }}
          />

          {/* Core icon */}
          <div className="relative flex h-16 w-16 items-center justify-center sm:h-20 sm:w-20">
            {/* Spinning border */}
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#00ff41] [animation-duration:2s]" />
            <div
              className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-t-[#00ff41]/40 [animation-duration:3s]"
              style={{ animationDirection: 'reverse' }}
            />

            {/* Clapperboard icon */}
            <svg
              className="relative h-7 w-7 text-[#00ff41]/80 sm:h-8 sm:w-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Clapperboard body */}
              <path d="M4 11v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              {/* Clapperboard top (clapper) */}
              <path d="M4 11l2-6h12l2 6" />
              {/* Clapper stripes */}
              <line x1="8" y1="5" x2="9.5" y2="11" />
              <line x1="13" y1="5" x2="14.5" y2="11" />
            </svg>
          </div>
        </div>

        {/* Loading message with fade transition */}
        <div className="flex flex-col items-center gap-2">
          <span
            className="min-h-[1.5em] text-center text-sm font-medium text-[#00ff41]/80 transition-opacity duration-300 sm:text-base"
            style={{ opacity: fadeIn ? 1 : 0 }}
          >
            {LOADING_MESSAGES[msgIndex]}
          </span>
        </div>

        {/* Subtitle text */}
        <span className="text-center text-xs text-white/25 sm:text-xs">
          {variant === 'initial'
            ? 'Your cinematic experience is being created'
            : 'Generating your next scene'}
        </span>
      </div>

      {/* Progress bar — direct DOM updates via ref, no re-renders */}
      <div className="absolute inset-x-0 bottom-0 h-1.5 overflow-hidden bg-white/[0.05]">
        <div
          ref={progressBarRef}
          className="h-full bg-gradient-to-r from-[#00ff41]/60 via-[#00ff41] to-[#00ff41]/60"
          style={{ width: '0%', willChange: 'width' }}
        />
      </div>
      {/* Progress percentage + ETA — direct DOM updates via ref */}
      <div className="absolute right-2 bottom-2.5 flex items-center gap-2 text-[10px] text-white/30 sm:right-4 sm:bottom-3.5 sm:text-xs">
        <span ref={pctRef}>0%</span>
        <span ref={etaRef} />
      </div>
    </div>
  );
});
