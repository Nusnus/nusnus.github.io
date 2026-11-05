/**
 * @file Retries: when a client asks a service again after a failure. A
 * service may name the wait in a Retry-After header, as seconds to wait or the
 * date to retry at, which `retryAtOf` reads and `retryAfterOf` writes; with no
 * wait named, a client waits an exponential backoff with equal jitter,
 * `exponentialBackoffMs`, below the backoff's ceiling, `backoffCeilingMs`,
 * which doubles with each attempt up to any cap. A client that retries alone,
 * with no others to spread apart from, can wait the ceiling itself. The worker
 * reads GitHub's Retry-After and writes its own, which the site reads, and
 * both back off.
 */

// Retry-After holds seconds to wait, or the date to retry at as an
// IMF-fixdate, the form RFC 9110 has every sender write and Date's toUTCString
// writes. The RFC keeps two obsolete date forms, which no service the project
// asks sends, so they are refused, as is text such as "2.5", which Date.parse
// alone reads as a date:
// https://www.rfc-editor.org/rfc/rfc9110#field.retry-after
export function retryAtOf(
  retryAfter: string,
  receivedAt: Date,
): Date | undefined {
  if (/^\d+$/.test(retryAfter)) {
    return new Date(receivedAt.getTime() + Number(retryAfter) * 1000);
  }
  const retryAt = new Date(retryAfter);
  return retryAt.toUTCString() === retryAfter ? retryAt : undefined;
}

export function retryAfterOf(retryAt: Date, now: Date): string {
  return String(
    Math.max(0, Math.ceil((retryAt.getTime() - now.getTime()) / 1000)),
  );
}

// Equal jitter: half of each wait is fixed and half random, so clients that
// failed together retry apart, and none sooner than half the ceiling:
// https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
export function exponentialBackoffMs(
  firstCeilingMs: number,
  attempt: number,
  random: () => number,
  maxCeilingMs?: number,
): number {
  const ceilingMs = backoffCeilingMs(firstCeilingMs, attempt, maxCeilingMs);
  return ceilingMs / 2 + (random() * ceilingMs) / 2;
}

export function backoffCeilingMs(
  firstCeilingMs: number,
  attempt: number,
  maxCeilingMs = Number.POSITIVE_INFINITY,
): number {
  return Math.min(firstCeilingMs * 2 ** (attempt - 1), maxCeilingMs);
}
