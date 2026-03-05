/**
 * Groky Spectrum — branch-line slider.
 *
 * A horizontal line with 5 notch points. Each notch has a vertical branch
 * with a label. As the thumb moves, the nearest notch glows. Snaps on
 * release. Persists to localStorage.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { SPECTRUM, valueToNotch, getNotch, type SpectrumNotch } from '@lib/ai/spectrum';

interface SpectrumSliderProps {
  /** Current notch index (0..4). */
  value: number;
  /** Called when the active notch changes. */
  onChange: (index: number) => void;
}

export const SpectrumSlider = memo(function SpectrumSlider({
  value,
  onChange,
}: SpectrumSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  /** Live thumb position 0..1 during drag (snaps on release). */
  const [livePos, setLivePos] = useState(SPECTRUM[value]?.position ?? 0.5);
  const [dragging, setDragging] = useState(false);

  /**
   * Sync external `value` prop → internal livePos when not dragging.
   * This is the canonical React controlled-component-with-local-drag-state
   * pattern — the effect is intentional, not a derived-state smell.
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!dragging) setLivePos(SPECTRUM[value]?.position ?? 0.5);
  }, [value, dragging]);

  /** Convert clientX → 0..1 along the track. */
  const clientXToPos = useCallback((clientX: number): number => {
    const el = trackRef.current;
    if (!el) return 0.5;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handleDown = useCallback(
    (clientX: number) => {
      setDragging(true);
      const p = clientXToPos(clientX);
      setLivePos(p);

      const move = (e: PointerEvent) => setLivePos(clientXToPos(e.clientX));
      const up = (e: PointerEvent) => {
        const finalPos = clientXToPos(e.clientX);
        const notch = valueToNotch(finalPos);
        setLivePos(SPECTRUM[notch]?.position ?? finalPos);
        setDragging(false);
        onChange(notch);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [clientXToPos, onChange],
  );

  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        onChange(Math.max(0, value - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        onChange(Math.min(SPECTRUM.length - 1, value + 1));
      }
    },
    [value, onChange],
  );

  const activeNotch = valueToNotch(livePos);
  const active: SpectrumNotch = getNotch(activeNotch);

  return (
    <div className="select-none">
      {/* Branch labels row */}
      <div className="relative mb-2 h-16">
        {SPECTRUM.map((notch, i) => {
          const near = Math.abs(notch.position - livePos);
          const isActive = i === activeNotch;
          const glow = Math.max(0, 1 - near * 4); // 0..1 glow intensity
          return (
            <div
              key={notch.label}
              className="absolute -translate-x-1/2 text-center transition-all duration-150"
              style={{
                left: `${notch.position * 100}%`,
                opacity: 0.35 + glow * 0.65,
                transform: `translateX(-50%) scale(${0.85 + glow * 0.15})`,
              }}
            >
              <div
                className={`mb-0.5 font-mono text-xs font-semibold tracking-wider ${
                  isActive ? 'text-accent' : 'text-text-secondary'
                }`}
                style={
                  isActive ? { textShadow: `0 0 ${4 + glow * 8}px var(--color-accent)` } : undefined
                }
              >
                {notch.label}
              </div>
              <div className="text-text-tertiary text-[9px] leading-tight whitespace-nowrap">
                {notch.traits}
              </div>
              {/* Branch line (vertical tick from track up to label) */}
              <div
                className="absolute top-full left-1/2 w-px -translate-x-1/2 transition-all duration-150"
                style={{
                  height: '12px',
                  background: isActive ? 'var(--color-accent)' : 'var(--color-border)',
                  boxShadow: isActive ? `0 0 6px var(--color-accent)` : 'none',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={SPECTRUM.length - 1}
        aria-valuenow={value}
        aria-valuetext={active.label}
        aria-label="Personality spectrum"
        onPointerDown={(e) => {
          e.preventDefault();
          handleDown(e.clientX);
        }}
        onKeyDown={handleKey}
        className="focus-visible:ring-accent relative h-6 cursor-pointer touch-none rounded focus:outline-none focus-visible:ring-2"
      >
        {/* Rail */}
        <div className="bg-border absolute top-1/2 right-0 left-0 h-0.5 -translate-y-1/2 rounded-full" />
        {/* Glow trail from center */}
        <div
          className="bg-accent/40 absolute top-1/2 h-1 -translate-y-1/2 rounded-full blur-[2px] transition-all duration-75"
          style={{
            left: `${Math.min(50, livePos * 100)}%`,
            right: `${Math.min(50, (1 - livePos) * 100)}%`,
          }}
        />
        {/* Thumb */}
        <div
          className={`bg-accent absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left,box-shadow] ${
            dragging
              ? 'shadow-[0_0_16px_var(--color-accent)] duration-0'
              : 'shadow-[0_0_8px_var(--color-accent)] duration-200'
          }`}
          style={{ left: `${livePos * 100}%` }}
        />
      </div>

      {/* Active label (mobile-friendly readout) */}
      <div className="mt-3 text-center md:hidden">
        <span className="text-accent font-mono text-sm font-semibold">{active.label}</span>
        <span className="text-text-tertiary block text-xs">{active.traits}</span>
      </div>
    </div>
  );
});
