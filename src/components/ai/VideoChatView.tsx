/**
 * VideoChatView — dedicated full-screen video chat experience.
 *
 * Cinema-style layout with the video as the focal point, option cards
 * below, and a clean dark aesthetic. Designed for mobile-first with
 * touch-friendly interactions.
 *
 * Flow:
 * 1. Video plays with TTS voiceover (auto-play)
 * 2. Options appear after video ends
 * 3. User picks an option (or types custom)
 * 4. Next video generates and plays
 * 5. Repeat
 */

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { cn } from '@lib/utils/cn';
import type { ChatMessage, ChatFormOption } from '@lib/ai/types';
import { VideoChatPlayer } from './VideoChatPlayer';
import { VideoChatLoader } from './VideoChatLoader';

interface VideoChatViewProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  onFormSubmit: (
    messageId: string,
    selectedId: string,
    value: string,
    customValue?: string,
  ) => void;
  onExit: () => void;
}

/** Dedicated video chat experience — cinema-style, mobile-native. */
export const VideoChatView = memo(function VideoChatView({
  messages,
  isGenerating,
  onFormSubmit,
  onExit,
}: VideoChatViewProps) {
  const [playbackDone, setPlaybackDone] = useState(false);
  const [otherText, setOtherText] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);
  const otherInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Find the latest assistant message with video chat content
  const latestVideoMsg = [...messages]
    .reverse()
    .find((m) => m.role === 'assistant' && (m.videoChatUrl || m.videoChatSpokenText));

  const latestForm = latestVideoMsg?.form;
  const isFormAnswered = latestForm?.selectedId !== undefined && latestForm?.selectedId !== null;

  // Check if we're waiting for video generation
  const isWaitingForVideo = isGenerating && !latestVideoMsg?.videoChatUrl;

  // Check if video is loading (has spoken text but no video URL yet)
  const isVideoLoading =
    isGenerating && !!latestVideoMsg?.videoChatSpokenText && !latestVideoMsg?.videoChatUrl;

  // Check if video generation failed (generation finished but no video URL)
  const isVideoFailed = !isGenerating && !!latestVideoMsg && !latestVideoMsg.videoChatUrl;

  // Reset playback state when a new video message arrives
  // This is the React-recommended "derive state from props" pattern.
  const [trackedVideoId, setTrackedVideoId] = useState<string | null>(null);
  const latestVideoId = latestVideoMsg?.id ?? null;
  if (latestVideoId && latestVideoId !== trackedVideoId) {
    setTrackedVideoId(latestVideoId);
    setPlaybackDone(false);
    setOtherText('');
    setShowOtherInput(false);
  }

  // Scroll to bottom when options appear
  useEffect(() => {
    if (playbackDone || isFormAnswered) {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [playbackDone, isFormAnswered]);

  const handlePlaybackComplete = useCallback(() => {
    setPlaybackDone(true);
  }, []);

  const handleOptionClick = useCallback(
    (option: ChatFormOption) => {
      if (!latestVideoMsg || !latestForm || isFormAnswered || isGenerating) return;
      onFormSubmit(latestVideoMsg.id, option.id, option.value);
    },
    [latestVideoMsg, latestForm, isFormAnswered, isGenerating, onFormSubmit],
  );

  const handleOtherToggle = useCallback(() => {
    setShowOtherInput(true);
    requestAnimationFrame(() => otherInputRef.current?.focus());
  }, []);

  const handleOtherSubmit = useCallback(() => {
    const trimmed = otherText.trim();
    if (!trimmed || !latestVideoMsg || !latestForm || isFormAnswered || isGenerating) return;
    onFormSubmit(latestVideoMsg.id, '__other__', trimmed, trimmed);
    setOtherText('');
    setShowOtherInput(false);
  }, [otherText, latestVideoMsg, latestForm, isFormAnswered, isGenerating, onFormSubmit]);

  const handleOtherKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleOtherSubmit();
      }
      if (e.key === 'Escape') {
        setShowOtherInput(false);
        setOtherText('');
      }
    },
    [handleOtherSubmit],
  );

  // Show options after playback, if video failed, or if already answered
  const showOptions =
    (playbackDone || isFormAnswered || isVideoFailed) &&
    latestForm &&
    latestForm.options.length > 0;

  return (
    <div className="flex h-full flex-col bg-black">
      {/* Top bar — minimal, transparent */}
      <div className="relative z-10 flex shrink-0 items-center justify-between px-4 py-3 sm:px-6">
        <button
          onClick={onExit}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10 hover:text-white/80 sm:px-4 sm:py-2 sm:text-sm"
          aria-label="Exit video chat"
        >
          <svg
            className="h-3.5 w-3.5 sm:h-4 sm:w-4"
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
          <span className="hidden sm:inline">Exit</span>
        </button>
        <div className="flex items-center gap-2">
          <span
            className="block h-2 w-2 rounded-full bg-[#00ff41]"
            style={{ boxShadow: '0 0 8px rgba(0,255,65,0.5)' }}
          />
          <span className="text-xs font-semibold tracking-wider text-white/50 sm:text-sm">
            VIDEO CHAT
          </span>
        </div>
        <div className="w-16 sm:w-20" /> {/* Spacer for centering */}
      </div>

      {/* Main content — scrollable */}
      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex flex-1 flex-col items-center justify-center px-3 py-4 sm:px-6 sm:py-8">
          {/* Video area */}
          <div className="w-full max-w-2xl">
            {/* Initial loading state (no video yet) */}
            {isWaitingForVideo && !latestVideoMsg && <VideoChatLoader variant="initial" />}

            {/* Video player */}
            {latestVideoMsg && !isVideoFailed && (
              <VideoChatPlayer
                key={latestVideoMsg.id}
                videoUrl={latestVideoMsg.videoChatUrl ?? ''}
                audioUrl={latestVideoMsg.videoChatAudioUrl}
                spokenText={latestVideoMsg.videoChatSpokenText}
                isLoading={(isVideoLoading || !latestVideoMsg.videoChatUrl) && isGenerating}
                onPlaybackComplete={handlePlaybackComplete}
              />
            )}

            {/* Video generation failed — show error with spoken text fallback */}
            {isVideoFailed && (
              <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-5">
                <svg
                  className="h-6 w-6 text-red-400/60"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
                  <line x1="4" y1="4" x2="20" y2="20" strokeWidth="2" />
                </svg>
                <span className="text-sm text-white/50">Video generation failed</span>
                {latestVideoMsg.videoChatSpokenText && (
                  <p className="mt-1 text-center text-sm leading-relaxed text-white/70">
                    {latestVideoMsg.videoChatSpokenText}
                  </p>
                )}
              </div>
            )}

            {/* Generating next video indicator */}
            {isGenerating && isFormAnswered && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#00ff41]/60 [animation-delay:0ms]" />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#00ff41]/50 [animation-delay:150ms]" />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#00ff41]/40 [animation-delay:300ms]" />
              </div>
            )}
          </div>

          {/* Options area */}
          {showOptions && (
            <div className="video-chat-options-appear mt-6 w-full max-w-2xl sm:mt-8">
              {/* Question */}
              {latestForm.question && (
                <p className="mb-4 text-center text-sm font-medium text-white/70 sm:mb-5 sm:text-base">
                  {latestForm.question}
                </p>
              )}

              {/* Option cards — stacked on mobile, grid on larger screens */}
              <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                {latestForm.options.map((option) => {
                  const isSelected = latestForm.selectedId === option.id;
                  const isOtherSelected = isFormAnswered && !isSelected;

                  return (
                    <button
                      key={option.id}
                      onClick={() => handleOptionClick(option)}
                      disabled={isFormAnswered || isGenerating}
                      className={cn(
                        'group/opt relative overflow-hidden rounded-xl border p-4 text-left transition-all duration-200 sm:p-5',
                        isSelected
                          ? 'border-[#00ff41]/40 bg-[#00ff41]/10 ring-1 ring-[#00ff41]/20'
                          : isOtherSelected
                            ? 'border-white/[0.04] bg-white/[0.02] opacity-30'
                            : 'border-white/[0.08] bg-white/[0.03] hover:border-[#00ff41]/25 hover:bg-[#00ff41]/[0.05] active:scale-[0.98]',
                        (isFormAnswered || isGenerating) && !isSelected && 'cursor-default',
                      )}
                    >
                      {/* Selection indicator */}
                      {isSelected && (
                        <div className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#00ff41]/20 sm:top-4 sm:right-4">
                          <svg
                            className="h-3.5 w-3.5 text-[#00ff41]"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}

                      <span
                        className={cn(
                          'block text-sm font-medium sm:text-base',
                          isSelected ? 'text-[#00ff41]' : 'text-white/85',
                        )}
                      >
                        {option.label}
                      </span>
                      {option.description && (
                        <span
                          className={cn(
                            'mt-1 block text-xs leading-relaxed sm:text-sm',
                            isSelected ? 'text-[#00ff41]/60' : 'text-white/40',
                          )}
                        >
                          {option.description}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* "Other" option */}
              {latestForm.allowOther && !isFormAnswered && (
                <div className="mt-2.5 sm:mt-3">
                  {!showOtherInput ? (
                    <button
                      onClick={handleOtherToggle}
                      disabled={isFormAnswered || isGenerating}
                      className="w-full rounded-xl border border-dashed border-white/[0.08] px-4 py-3 text-left text-sm text-white/40 transition-all hover:border-[#00ff41]/20 hover:bg-white/[0.02] hover:text-white/60 sm:py-3.5"
                    >
                      <span className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                        Type your own response...
                      </span>
                    </button>
                  ) : (
                    <div className="video-chat-options-appear flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-3">
                      <input
                        ref={otherInputRef}
                        type="text"
                        value={otherText}
                        onChange={(e) => setOtherText(e.target.value)}
                        onKeyDown={handleOtherKeyDown}
                        placeholder="Type your response..."
                        className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30 sm:text-base"
                      />
                      <button
                        onClick={handleOtherSubmit}
                        disabled={!otherText.trim()}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#00ff41]/10 text-[#00ff41] transition-colors hover:bg-[#00ff41]/20 disabled:opacity-30"
                        aria-label="Send"
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
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Custom answer display */}
              {isFormAnswered &&
                latestForm.selectedId === '__other__' &&
                latestForm.customValue && (
                  <div className="mt-3 rounded-xl border border-[#00ff41]/20 bg-[#00ff41]/5 px-4 py-3">
                    <span className="text-xs text-[#00ff41]/50">Your response: </span>
                    <span className="text-sm text-white/80">{latestForm.customValue}</span>
                  </div>
                )}
            </div>
          )}

          <div ref={scrollRef} className="h-4" />
        </div>
      </div>
    </div>
  );
});
