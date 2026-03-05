/**
 * MatrixRain — falling-glyph backdrop for the Cybernus chat page.
 *
 * Pure CSS transform animations (no canvas, no RAF loop) so the main
 * thread stays free for streaming tokens. Columns are generated once
 * per mount with randomised timing; the actual fall is GPU-composited.
 *
 * Sits behind all content at `z-0` with heavy opacity knockdown so it
 * reads as texture, not noise. Respects `prefers-reduced-motion` via
 * the global.css kill-switch.
 */

import { memo, useMemo } from 'react';
import type { CSSProperties } from 'react';

/** Katakana range + a few Latin digits — classic Matrix glyph soup. */
const GLYPHS =
  'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴ01';

/** Cheap mulberry32 PRNG — seeded so SSR/CSR renders match. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One column's worth of generated data. */
interface RainColumn {
  left: number; // 0-100 vw%
  delay: number; // s
  duration: number; // s
  glyphs: string;
}

interface MatrixRainProps {
  /** Number of falling columns. More = denser. ~40 looks good on desktop. */
  columns?: number;
  /** Glyphs per column. */
  length?: number;
  /** Override the random seed (useful for visual regression tests). */
  seed?: number;
}

/**
 * Full-screen Matrix rain backdrop. Render once at the top of the page
 * tree; it absolutely positions itself behind everything.
 */
export const MatrixRain = memo(function MatrixRain({
  columns = 40,
  length = 24,
  seed = 0x5eed,
}: MatrixRainProps) {
  // Generate columns once. `useMemo` keeps them stable across re-renders
  // so the animation doesn't restart on every parent state change.
  const cols = useMemo<RainColumn[]>(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: columns }, (_, i) => {
      let glyphs = '';
      for (let g = 0; g < length; g++) {
        glyphs += GLYPHS[Math.floor(rand() * GLYPHS.length)] ?? '0';
      }
      return {
        left: (i / columns) * 100 + rand() * (100 / columns) * 0.6,
        delay: rand() * -8, // negative so columns are mid-fall on mount
        duration: 5 + rand() * 7, // 5-12s per fall
        glyphs,
      };
    });
  }, [columns, length, seed]);

  return (
    <div
      aria-hidden="true"
      className="text-accent/15 pointer-events-none fixed inset-0 z-0 overflow-hidden font-mono text-xs leading-tight select-none"
    >
      {cols.map((c, i) => {
        const style: CSSProperties & Record<'--delay' | '--dur', string> = {
          left: `${c.left}%`,
          '--delay': `${c.delay}s`,
          '--dur': `${c.duration}s`,
        };
        return (
          <span
            key={i}
            className="cybernus-rain-col absolute top-0 [writing-mode:vertical-rl]"
            style={style}
          >
            {c.glyphs}
          </span>
        );
      })}
    </div>
  );
});
