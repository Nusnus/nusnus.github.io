/**
 * GrokySpectrum — personality slider, Corporate → Unhinged.
 *
 * Visual:
 * - Native range input (0–4) styled as a glowing track.
 * - Five tick labels across the bottom — active one is accent-colored.
 * - Trait chips for the active level pop in with `spectrum-pop`.
 *
 * Behavior:
 * - Controlled component. Parent owns the state + persistence.
 * - Disabled while a message is generating (can't change tone mid-stream).
 */

import { useMemo } from 'react';
import { cn } from '@lib/utils/cn';
import { GROKY_SPECTRUM, type SpectrumLevel } from '@lib/ai/config';

interface GrokySpectrumProps {
  value: SpectrumLevel;
  onChange: (value: SpectrumLevel) => void;
  disabled?: boolean;
}

export function GrokySpectrum({ value, onChange, disabled = false }: GrokySpectrumProps) {
  const active = GROKY_SPECTRUM[value];

  // Pre-compute track fill percentage (0→0%, 4→100%).
  const fillPct = useMemo(() => (value / (GROKY_SPECTRUM.length - 1)) * 100, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(e.target.value) as SpectrumLevel;
    onChange(next);
  };

  return (
    <div className="bg-bg-surface/60 border-accent/10 rounded-xl border px-4 py-3 backdrop-blur-sm">
      {/* Header row — title + active label */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-text-secondary font-mono text-[11px] tracking-wider uppercase">
          Groky Spectrum
        </span>
        <span
          key={active.label}
          className="spectrum-pop text-accent font-mono text-xs font-bold tracking-wide"
        >
          {active.label}
        </span>
      </div>

      {/* Slider — native range on a custom track */}
      <div className="relative">
        {/* Track background */}
        <div className="bg-bg-elevated absolute top-1/2 right-0 left-0 h-1 -translate-y-1/2 rounded-full" />
        {/* Fill */}
        <div
          className="bg-accent absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full transition-all"
          style={{ width: `${fillPct}%` }}
        />
        {/* Tick marks */}
        <div className="pointer-events-none absolute top-1/2 right-0 left-0 flex -translate-y-1/2 justify-between">
          {GROKY_SPECTRUM.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 w-1.5 rounded-full transition-colors',
                i <= value ? 'bg-accent' : 'bg-bg-elevated',
              )}
            />
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={GROKY_SPECTRUM.length - 1}
          step={1}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          aria-label="Groky Spectrum — personality intensity"
          aria-valuetext={active.label}
          className={cn(
            // Remove native appearance; size only for the invisible hit area.
            'relative h-6 w-full appearance-none bg-transparent outline-none',
            disabled && 'cursor-not-allowed opacity-50',
            // Thumb — WebKit
            '[&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:ring-accent/30 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:ring-4 [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-125',
            // Thumb — Firefox
            '[&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:ring-accent/30 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:ring-4',
          )}
        />
      </div>

      {/* Tick labels — all five, active one highlighted */}
      <div className="mt-1 flex justify-between">
        {GROKY_SPECTRUM.map((level, i) => (
          <span
            key={level.label}
            className={cn(
              'text-[9px] font-medium tracking-tight transition-colors',
              i === value ? 'text-accent' : 'text-text-muted',
            )}
          >
            {level.label}
          </span>
        ))}
      </div>

      {/* Active trait chips — re-keyed on value so spectrum-pop fires on change */}
      <div
        key={`traits-${value}`}
        className="mt-2 flex flex-wrap gap-1"
        aria-live="polite"
        aria-atomic="true"
      >
        {active.traits.map((trait, i) => (
          <span
            key={trait}
            className="spectrum-pop bg-accent/10 text-accent border-accent/20 inline-flex rounded-md border px-2 py-0.5 text-[10px] font-medium"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {trait}
          </span>
        ))}
      </div>
    </div>
  );
}
