/**
 * @file Refresh leases: so that concurrent requests that find one stale cached
 * reply start one background refresh between them, the first takes a lease on
 * the reply and the rest find it held.
 *
 * A lease is never released; it lapses after the longest a background
 * refresh can run, so a background refresh that the runtime cancels cannot
 * block the next one. Leases hold only times: the Workers runtime reuses an
 * isolate across requests but cancels each request's I/O when the request
 * ends, so a promise shared across requests can stall every request awaiting
 * it:
 * https://developers.cloudflare.com/workers/observability/errors/#cannot-perform-io-on-behalf-of-a-different-request
 */

/**
 * Lets one request at a time start a background refresh of a stale cached
 * reply, until its lease lapses.
 */
export class RefreshLeases {
  readonly #lapsesAt = new Map<string, number>();
  readonly #leaseMs: number;

  constructor(leaseMs: number) {
    this.#leaseMs = leaseMs;
  }

  tryAcquire(key: string, now: Date): boolean {
    if ((this.#lapsesAt.get(key) ?? 0) > now.getTime()) {
      return false;
    }
    this.#lapsesAt.set(key, now.getTime() + this.#leaseMs);
    return true;
  }
}
