/**
 * VideoChatLoader — engaging loading screen for video generation.
 *
 * Shown while the AI generates a video response (10-30 seconds).
 * Features rotating cinematic messages, animated film-strip frames,
 * pulsing glow effects, and a progress-like animation to keep users
 * engaged during the wait.
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

/** Film strip frame — a single decorative frame */
function FilmFrame({ delay, side }: { delay: number; side: 'left' | 'right' }) {
  return (
    <div
      className="video-chat-film-frame absolute h-8 w-12 rounded border border-[#00ff41]/15 bg-[#00ff41]/[0.03] sm:h-10 sm:w-14"
      style={{
        animationDelay: `${delay}s`,
        [side]: side === 'left' ? '8px' : '8px',
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
  const [dots, setDots] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Cycle through loading messages
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    intervalRef.current = setInterval(() => {
      setFadeIn(false);
      timeoutId = setTimeout(() => {
        setMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
        setFadeIn(true);
      }, 300);
    }, 3000);

    return () => {
      clearInterval(intervalRef.current);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

  // Animate dots for progress feel
  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((prev) => (prev + 1) % 4);
    }, 500);
    return () => clearInterval(dotInterval);
  }, []);

  return (
    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-[#00ff41]/10 bg-[#0a0a0a]">
      {/* Background ambient glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="video-chat-loader-glow absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00ff41]/[0.04] blur-3xl sm:h-80 sm:w-80" />
      </div>

      {/* Film strip decorative frames — left side */}
      <div className="absolute top-0 left-0 h-full w-14 overflow-hidden opacity-30 sm:w-16">
        <FilmFrame delay={0} side="left" />
        <FilmFrame delay={0.8} side="left" />
        <FilmFrame delay={1.6} side="left" />
        <FilmFrame delay={2.4} side="left" />
      </div>

      {/* Film strip decorative frames — right side */}
      <div className="absolute top-0 right-0 h-full w-14 overflow-hidden opacity-30 sm:w-16">
        <FilmFrame delay={0.4} side="right" />
        <FilmFrame delay={1.2} side="right" />
        <FilmFrame delay={2.0} side="right" />
        <FilmFrame delay={2.8} side="right" />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-5 px-6 sm:gap-6">
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

          {/* Animated dots */}
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1 w-1 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: i < dots ? 'rgba(0, 255, 65, 0.6)' : 'rgba(0, 255, 65, 0.15)',
                  transform: i < dots ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Subtitle text */}
        <span className="text-center text-xs text-white/25 sm:text-xs">
          {variant === 'initial'
            ? 'Your cinematic experience is being created'
            : 'Generating your next scene'}
        </span>
      </div>

      {/* Bottom shimmer bar — fake progress feel */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-white/[0.03]">
        <div className="video-chat-loader-shimmer h-full w-1/3 bg-gradient-to-r from-transparent via-[#00ff41]/30 to-transparent" />
      </div>
    </div>
  );
});
