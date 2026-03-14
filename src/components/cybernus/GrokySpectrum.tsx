/**
 * GrokySpectrum — the personality slider.
 *
 * A horizontal track with five labelled branches. Drag the thumb and
 * Cybernus's delivery shifts from keynote-polite to full-chaos Grok.
 */

import { memo, useId } from 'react';
import type { CSSProperties } from 'react';

import { SPECTRUM_BANDS, bandForValue } from '@lib/cybernus/spectrum';
import { cn } from '@lib/utils/cn';

interface GrokySpectrumProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const GrokySpectrum = memo(function GrokySpectrum({
  value,
  onChange,
  disabled = false,
  compact = false,
}: GrokySpectrumProps) {
  const inputId = useId();
  const active = bandForValue(value);
  const thumbPct = Math.max(0, Math.min(100, value));

  const glowStyle: CSSProperties & Record<'--band-glow', string> = {
    '--band-glow': active.glow,
  };

  return (
    <div className="w-full" style={glowStyle}>
      <div
        className={cn('relative mb-2 flex items-end justify-between', compact ? 'h-10' : 'h-16')}
      >
        {SPECTRUM_BANDS.map((band) => {
          const isActive = band.label === active.label;
          const centre = (band.min + band.max) / 2;
          const branchGlow: CSSProperties & Record<'--band-glow', string> = {
            left: `${centre}%`,
            '--band-glow': band.glow,
          };
          return (
            <div
              key={band.label}
              className="absolute flex -translate-x-1/2 flex-col items-center"
              style={branchGlow}
            >
              <div
                className={cn(
                  'rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase transition-all duration-300',
                  isActive
                    ? 'cybernus-band-active text-text-primary scale-110 border-[var(--band-glow)] bg-[var(--band-glow)]/15'
                    : 'border-border text-text-muted scale-95 opacity-60',
                )}
              >
                {band.label}
              </div>
              <div
                className={cn(
                  'w-px transition-all duration-300',
                  compact ? 'h-3' : 'h-6',
                  isActive ? 'bg-[var(--band-glow)]' : 'bg-border',
                )}
              />
            </div>
          );
        })}
      </div>

      <div className="relative h-6">
        <div className="bg-bg-elevated absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full">
          <div
            className="h-full rounded-full transition-all duration-150"
            style={{
              width: `${thumbPct}%`,
              background: `linear-gradient(90deg, oklch(0.7 0.05 160), ${active.glow})`,
            }}
          />
        </div>

        <div
          className="cybernus-band-active pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-[left,border-color] duration-150"
          style={{
            left: `${thumbPct}%`,
            borderColor: active.glow,
            backgroundColor: 'var(--color-bg-base)',
          }}
        />

        <input
          id={inputId}
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Personality spectrum"
          aria-valuetext={`${Math.round(value)}% — ${active.label}`}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </div>

      {!compact && (
        <p className="text-text-muted mt-2 text-center text-xs transition-opacity duration-200">
          <span className="font-mono text-[var(--band-glow)]">{Math.round(value)}%</span>
          {' — '}
          {active.blurb}
        </p>
      )}

      <label htmlFor={inputId} className="sr-only">
        Groky Spectrum: drag to adjust Cybernus personality from professional to unhinged.
      </label>
    </div>
  );
});
