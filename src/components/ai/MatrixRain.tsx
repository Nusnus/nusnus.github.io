/**
 * Matrix digital-rain canvas backdrop.
 *
 * Fixed-position, pointer-events-none, very low opacity. Rendered with
 * requestAnimationFrame on a single 2D canvas — no DOM churn. Throttled
 * to ~24fps and pauses when the tab is hidden.
 */

import { memo, useEffect, useRef } from 'react';

const CHARS = 'アァカサタナハマヤャラワガザダバパ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const FONT_SIZE = 14;
const FRAME_MS = 42; // ~24fps — plenty for ambient rain
const FADE_ALPHA = 0.06;

export const MatrixRain = memo(function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Honour reduced-motion — just don't animate
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let cols = 0;
    let drops: number[] = [];
    let raf = 0;
    let last = 0;
    let running = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(window.innerWidth / FONT_SIZE);
      drops = Array.from({ length: cols }, () => Math.floor(Math.random() * -50));
      // Clear so the trail doesn't persist across resizes
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    };

    const tick = (ts: number) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      if (ts - last < FRAME_MS) return;
      last = ts;

      // Translucent black rect for the fading trail
      ctx.fillStyle = `rgba(0, 0, 0, ${FADE_ALPHA})`;
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      ctx.font = `${FONT_SIZE}px monospace`;
      ctx.fillStyle = '#4ade80'; // green-400 — will be dimmed by canvas opacity

      for (let i = 0; i < cols; i++) {
        const ch = CHARS.charAt(Math.floor(Math.random() * CHARS.length));
        const x = i * FONT_SIZE;
        const dropY = drops[i] ?? 0;
        const y = dropY * FONT_SIZE;
        ctx.fillText(ch, x, y);

        if (y > window.innerHeight && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] = dropY + 1;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else {
        running = true;
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 opacity-[0.04] mix-blend-screen"
    />
  );
});
