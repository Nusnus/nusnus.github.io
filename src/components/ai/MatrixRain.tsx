/**
 * MatrixRain — canvas-based falling-glyph background for the Cybernus chat.
 *
 * Design:
 * - One column per ~14px of viewport width, each with its own drop position.
 * - Glyphs are katakana + digits + a few Latin caps — classic Matrix vibe.
 * - Semi-transparent black fill each frame gives the fading-trail effect.
 * - Paused entirely under `prefers-reduced-motion: reduce`.
 * - `pointer-events: none` and `z-index: 0` — purely decorative.
 *
 * Perf: Single rAF loop, no React state changes per frame. Columns are
 * tracked in a plain array via ref. Canvas sized to devicePixelRatio once
 * on resize, then CSS-scaled.
 */

import { useEffect, useRef } from 'react';

/** Glyph pool — katakana block + digits + a couple of operators. */
const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789+-*<>';

/** Font size in CSS px — also the column width. */
const FONT_SIZE = 14;

/** Computed accent-green — close to oklch(0.72 0.17 145). */
const GLYPH_COLOR = 'rgba(89, 211, 137, 0.85)';

/** Trail fade — how quickly old glyphs disappear. Higher alpha = shorter trails. */
const FADE_ALPHA = 0.06;

/** Probability a column resets after passing the bottom edge. */
const RESET_CHANCE = 0.025;

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Respect reduced-motion — don't animate at all.
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const canvas = canvasRef.current;
    if (!canvas || prefersReduced) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let columns: number[] = [];
    let columnCount = 0;
    let rafId = 0;

    /** Resize canvas to viewport × DPR and reseed columns with random start positions. */
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${FONT_SIZE}px monospace`;

      columnCount = Math.ceil(w / FONT_SIZE);
      // Start each column at a random negative y so the first wave staggers in.
      columns = Array.from({ length: columnCount }, () => -Math.floor(Math.random() * 50));

      // Paint the background solid once so the first frame isn't a flash.
      ctx.fillStyle = 'rgb(0, 0, 0)';
      ctx.fillRect(0, 0, w, h);
    };

    /** One animation frame. */
    const draw = () => {
      const w = canvas.width / Math.min(window.devicePixelRatio || 1, 2);
      const h = canvas.height / Math.min(window.devicePixelRatio || 1, 2);

      // Fading trail — translucent black over the whole canvas.
      ctx.fillStyle = `rgba(0, 0, 0, ${FADE_ALPHA})`;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = GLYPH_COLOR;

      for (let i = 0; i < columnCount; i++) {
        const col = columns[i] ?? 0;
        const x = i * FONT_SIZE;
        const y = col * FONT_SIZE;

        // Only draw if the glyph is actually on screen — saves fillText calls.
        if (y > 0 && y < h + FONT_SIZE) {
          const glyph = GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
          ctx.fillText(glyph, x, y);
        }

        // Advance — reset randomly once past the bottom edge for uneven rain.
        if (y > h && Math.random() < RESET_CHANCE) {
          columns[i] = 0;
        } else {
          columns[i] = col + 1;
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 opacity-30"
    />
  );
}
