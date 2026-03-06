/**
 * MatrixRain — falling-glyph backdrop for the Cybernus chat page.
 *
 * Pure CSS transform animations (no canvas, no RAF loop) so the main
 * thread stays free for streaming tokens.
 */

import { memo, useMemo } from 'react';
import type { CSSProperties } from 'react';

const GLYPHS =
  'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴ01';

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

interface RainColumn {
  left: number;
  delay: number;
  duration: number;
  glyphs: string;
}

interface MatrixRainProps {
  columns?: number;
  length?: number;
  seed?: number;
}

export const MatrixRain = memo(function MatrixRain({
  columns = 40,
  length = 24,
  seed = 0x5eed,
}: MatrixRainProps) {
  const cols = useMemo<RainColumn[]>(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: columns }, (_, i) => {
      let glyphs = '';
      for (let g = 0; g < length; g++) {
        glyphs += GLYPHS[Math.floor(rand() * GLYPHS.length)] ?? '0';
      }
      return {
        left: (i / columns) * 100 + rand() * (100 / columns) * 0.6,
        delay: rand() * -8,
        duration: 5 + rand() * 7,
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
