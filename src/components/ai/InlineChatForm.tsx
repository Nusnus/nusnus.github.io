/**
 * InlineChatForm — dynamic in-chat interactive form.
 *
 * Rendered inside assistant messages when the AI calls the `ask_user` tool.
 * Presents clickable options plus an optional free-text "Other" input.
 * Once the user picks an option (or types a custom answer), the form
 * locks and the value is sent as the user's next message.
 */

import { useState, useCallback, useRef, memo } from 'react';
import { cn } from '@lib/utils/cn';
import type { ChatForm } from '@lib/ai/types';

interface InlineChatFormProps {
  form: ChatForm;
  onSubmit: (value: string) => void;
  disabled?: boolean;
}

/** Reusable in-chat form with selectable options and optional "Other" text input. */
export const InlineChatForm = memo(function InlineChatForm({
  form,
  onSubmit,
  disabled = false,
}: InlineChatFormProps) {
  const [otherText, setOtherText] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);
  const otherInputRef = useRef<HTMLInputElement>(null);

  const isAnswered = form.selectedId !== undefined && form.selectedId !== null;
  const isCustomAnswer = isAnswered && form.selectedId === '__other__';
  const isLocked = isAnswered || disabled;

  const handleOptionClick = useCallback(
    (_optionId: string, value: string) => {
      if (isLocked) return;
      onSubmit(value);
    },
    [isLocked, onSubmit],
  );

  const handleOtherToggle = useCallback(() => {
    if (isLocked) return;
    setShowOtherInput(true);
    requestAnimationFrame(() => otherInputRef.current?.focus());
  }, [isLocked]);

  const handleOtherSubmit = useCallback(() => {
    const trimmed = otherText.trim();
    if (!trimmed || isLocked) return;
    onSubmit(trimmed);
  }, [otherText, isLocked, onSubmit]);

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

  return (
    <div className="chat-form-appear mt-3 mb-1">
      {/* Question */}
      <p className="text-text-secondary mb-3 text-[13px] font-medium">{form.question}</p>

      {/* Options grid */}
      <div className="grid gap-2 sm:grid-cols-2">
        {form.options.map((option) => {
          const isSelected = form.selectedId === option.id;
          const isOtherSelected = isAnswered && !isSelected;

          return (
            <button
              key={option.id}
              onClick={() => handleOptionClick(option.id, option.value)}
              disabled={isLocked}
              className={cn(
                'group/opt relative overflow-hidden rounded-xl border p-3 text-left transition-all duration-200',
                isSelected
                  ? 'border-accent/40 bg-accent/10 ring-accent/20 ring-1'
                  : isOtherSelected
                    ? 'border-white/[0.04] bg-white/[0.01] opacity-40'
                    : 'border-white/[0.08] bg-white/[0.02] hover:-translate-y-0.5 hover:border-[#00ff41]/25 hover:bg-[#00ff41]/[0.04]',
                isLocked && !isSelected && 'cursor-default',
              )}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="bg-accent/20 absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full">
                  <svg
                    className="text-accent h-3 w-3"
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
                  'block text-[13px] font-medium',
                  isSelected ? 'text-accent' : 'text-text-primary/85',
                )}
              >
                {option.label}
              </span>
              {option.description && (
                <span
                  className={cn(
                    'mt-0.5 block text-[11px] leading-snug',
                    isSelected ? 'text-accent/60' : 'text-text-muted',
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
      {form.allowOther && !isAnswered && (
        <div className="mt-2">
          {!showOtherInput ? (
            <button
              onClick={handleOtherToggle}
              disabled={isLocked}
              className="text-text-muted hover:text-text-secondary hover:border-accent/20 w-full rounded-xl border border-dashed border-white/[0.08] px-3 py-2.5 text-left text-[12px] transition-all hover:bg-white/[0.02]"
            >
              <span className="flex items-center gap-2">
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                </svg>
                Other — type your own answer
              </span>
            </button>
          ) : (
            <div className="chat-form-appear flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
              <input
                ref={otherInputRef}
                type="text"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                onKeyDown={handleOtherKeyDown}
                placeholder="Type your answer..."
                className="text-text-primary placeholder:text-text-muted min-w-0 flex-1 bg-transparent text-[13px] outline-none"
              />
              <button
                onClick={handleOtherSubmit}
                disabled={!otherText.trim()}
                className="text-accent hover:bg-accent/10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
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

      {/* Answered with custom text indicator */}
      {isCustomAnswer && form.customValue && (
        <div className="border-accent/20 bg-accent/5 mt-2 rounded-xl border px-3 py-2">
          <span className="text-accent/70 text-[11px]">Your answer: </span>
          <span className="text-text-primary text-[13px]">{form.customValue}</span>
        </div>
      )}
    </div>
  );
});
