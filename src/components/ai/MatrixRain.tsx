/**
 * MatrixRain — Canvas-based Matrix digital rain background effect.
 *
 * Renders a subtle, performant green-code rain animation behind the chat.
 * Uses requestAnimationFrame and low opacity to avoid distraction.
 */

import { useEffect, useRef } from 'react';

interface MatrixRainProps {
  opacity?: number;
}

const CHARS =
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF';
const FONT_SIZE = 14;
const DROP_SPEED = 0.4;
/** Target ~20fps — subtle background doesn't need full 60fps. */
const FRAME_INTERVAL = 50;

export function MatrixRain({ opacity = 0.03 }: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let drops: number[] = [];

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const columns = Math.floor(canvas.width / FONT_SIZE);
      drops = Array.from({ length: columns }, () => Math.random() * -100);
    }

    resize();
    window.addEventListener('resize', resize);

    let lastFrameTime = 0;
    let paused = false;

    function draw(now: number) {
      if (!ctx || !canvas) return;
      animId = requestAnimationFrame(draw);

      // Skip frames to throttle to ~20fps and pause when tab hidden
      if (paused || now - lastFrameTime < FRAME_INTERVAL) return;
      lastFrameTime = now;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#00ff41';
      ctx.font = `${FONT_SIZE}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)];
        const x = i * FONT_SIZE;
        const y = (drops[i] ?? 0) * FONT_SIZE;

        if (char) ctx.fillText(char, x, y);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] = (drops[i] ?? 0) + DROP_SPEED;
      }
    }

    // Pause when tab is hidden to save CPU
    function onVisibility() {
      paused = document.hidden;
    }
    document.addEventListener('visibilitychange', onVisibility);

    animId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ opacity }}
      aria-hidden="true"
    />
  );
}
