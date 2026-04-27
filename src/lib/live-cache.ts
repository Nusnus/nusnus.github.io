/**
 * Client-side cache for live data fetched from the Cloudflare Worker.
 *
 * Two layers:
 *  1. `window.__liveData` — synchronous in-memory stash so React widgets that
 *     hydrate AFTER `LiveData` dispatches its CustomEvent (e.g. `client:visible`
 *     islands below the fold) can still read the latest payload on mount.
 *  2. `localStorage` — persists the last-known-good payload across page loads
 *     so refreshing the page paints fresh-looking numbers immediately while a
 *     background fetch refreshes them.
 *
 * Stored payloads carry a `fetchedAt` timestamp so consumers can decide whether
 * to use them (and so we can expire entries that are too stale to be useful).
 */

const LS_PREFIX = 'nusnus:live:';

/** Max age for a localStorage entry before we ignore it (24h). */
export const LIVE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface CacheEntry<T> {
  fetchedAt: number;
  data: T;
}

type LiveDataStash = Record<string, unknown>;

/** Get the (lazily-created) global stash of latest live payloads. */
function getStash(): LiveDataStash {
  if (typeof window === 'undefined') return {};
  const w = window as unknown as { __liveData?: LiveDataStash };
  if (!w.__liveData) w.__liveData = {};
  return w.__liveData;
}

/** Read the latest stashed payload for a given CustomEvent name (sync). */
export function readStash<T>(eventName: string): T | undefined {
  return getStash()[eventName] as T | undefined;
}

/** Dispatch a `live-data:*` CustomEvent and stash the payload for late readers. */
export function publishLiveData<T>(eventName: string, detail: T): void {
  if (typeof window === 'undefined') return;
  getStash()[eventName] = detail;
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

/** Read a cached payload from localStorage, ignoring entries older than maxAgeMs. */
export function readCache<T>(key: string, maxAgeMs: number = LIVE_CACHE_MAX_AGE_MS): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (typeof entry?.fetchedAt !== 'number') return null;
    if (Date.now() - entry.fetchedAt > maxAgeMs) return null;
    return entry.data;
  } catch {
    return null;
  }
}

/** Write a payload to localStorage with the current timestamp. Failures are silent. */
export function writeCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CacheEntry<T> = { fetchedAt: Date.now(), data };
    window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota exceeded / private mode — ignore */
  }
}
