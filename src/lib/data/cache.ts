interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Client-side cache using sessionStorage with TTL support.
 * SSR-safe: returns null when sessionStorage is unavailable.
 */
export const cache = {
  get<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;

    try {
      const raw = sessionStorage.getItem(`nusnus:${key}`);
      if (!raw) return null;

      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (Date.now() > entry.expiresAt) {
        sessionStorage.removeItem(`nusnus:${key}`);
        return null;
      }

      return entry.value;
    } catch {
      return null;
    }
  },

  set<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
    if (typeof window === 'undefined') return;

    try {
      const entry: CacheEntry<T> = {
        value,
        expiresAt: Date.now() + ttlMs,
      };
      sessionStorage.setItem(`nusnus:${key}`, JSON.stringify(entry));
    } catch {
      // sessionStorage full or unavailable — silently fail
    }
  },

  clear(key: string): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(`nusnus:${key}`);
  },
};
