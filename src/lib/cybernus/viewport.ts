/**
 * Viewport tracking hook — `useSyncExternalStore` over `window.resize`.
 *
 * Extracted from `CybernusChat`'s boot effect so that component no longer
 * owns viewport state at all. `useSyncExternalStore` is the React-19-correct
 * pattern here: it handles the subscribe/unsubscribe lifecycle, provides a
 * server snapshot for hydration safety, and only re-renders when the
 * snapshot value *changes* (so continuous resize drag doesn't thrash —
 * we only flip at the breakpoint).
 *
 * The subscribe and snapshot functions live at module scope so their
 * identities are stable across renders (avoids the "getSnapshot should be
 * cached" warning in dev).
 */

import { useSyncExternalStore } from 'react';

import type { CybernusViewport } from './context';

/** Tailwind `md:` breakpoint — must match the CSS. */
const DESKTOP_BREAKPOINT = 768;

/** Subscribe to resize events. Returns the unsubscribe function. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

/** Client snapshot — read the current viewport class from the DOM. */
function getSnapshot(): CybernusViewport {
  return window.innerWidth >= DESKTOP_BREAKPOINT ? 'desktop' : 'mobile';
}

/** Server snapshot — SSR has no window; default to desktop (wider layout). */
function getServerSnapshot(): CybernusViewport {
  return 'desktop';
}

/**
 * Track the current viewport class. Re-renders the caller exactly when the
 * window crosses the desktop/mobile breakpoint — not on every resize tick.
 */
export function useViewport(): CybernusViewport {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
