/**
 * @file A route's backoff: after a fetch of the route's data fails, whether
 * GitHub failed or the worker did, the instant before which the worker does
 * not ask GitHub for that route, the failure that set it, and how many fetches
 * in a row have failed.
 *
 * The instant is the one GitHub asked for, when it asked; otherwise a wait that
 * doubles with each failure in a row, up to a cap, with jitter, so a failing
 * GitHub is asked ever less often. A successful fetch clears the backoff.
 */

import { exponentialBackoffMs } from "@nusnus/github-data/retries";

/** When the worker may next ask GitHub for a route, and why it waits. */
export class Backoff {
  // The first wait, from half a minute to a minute, rides out a blip without
  // leaving a page without data for long.
  static readonly #FIRST_CEILING_MS = 60_000;

  // GitHub's primary rate limit renews every hour, so a longer wait gains
  // nothing: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#primary-rate-limit-for-authenticated-users
  static readonly #MAX_CEILING_MS = 60 * 60_000;

  readonly failures: number;
  readonly notBefore: Date;
  readonly reason: string;

  constructor(failures: number, notBefore: Date, reason: string) {
    this.failures = failures;
    this.notBefore = notBefore;
    this.reason = reason;
  }

  static after(
    previous: Backoff | undefined,
    failure: { readonly message: string; readonly retryAt?: Date | undefined },
    now: Date,
    random: () => number,
  ): Backoff {
    const failures = (previous?.failures ?? 0) + 1;
    return new Backoff(
      failures,
      failure.retryAt ??
        new Date(
          now.getTime() +
            exponentialBackoffMs(
              Backoff.#FIRST_CEILING_MS,
              failures,
              random,
              Backoff.#MAX_CEILING_MS,
            ),
        ),
      failure.message,
    );
  }

  defers(now: Date): boolean {
    return now < this.notBefore;
  }
}
