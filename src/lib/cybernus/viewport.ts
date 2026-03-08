/**
 * Viewport class hook — desktop vs mobile.
 *
 * Cybernus adjusts its output formatting based on screen width (narrower
 * tables and shorter code blocks on mobile). The component also swaps
 * between a three-column layout and a single-column drawer.
 *
 * `useSyncExternalStore` is used so the client snapshot reads `window`
 * without a hydration mismatch: the server snapshot is a stable constant,
 * the client snapshot reads the live value, and React reconciles the
 * difference without a warning. Subscribe/getSnapshot/getServerSnapshot
 * are module-scope so their identities are stable across renders — an
 * inline arrow would trigger "getSnapshot should be cached".
 */

import { useSyncExternalStore } from 'react';

export type CybernusViewport = 'desktop' | 'mobile';

/** Tailwind's `lg` breakpoint — matches the three-column layout's `lg:` prefix. */
const DESKTOP_BREAKPOINT = 1024;

function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

function getSnapshot(): CybernusViewport {
  return window.innerWidth >= DESKTOP_BREAKPOINT ? 'desktop' : 'mobile';
}

function getServerSnapshot(): CybernusViewport {
  // SSR has no viewport — default to desktop so the wide layout is the
  // pre-hydration markup. The client snapshot corrects it on mount.
  return 'desktop';
}

/** React hook returning the current viewport class. */
export function useViewport(): CybernusViewport {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
