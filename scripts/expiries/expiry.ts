/**
 * @file An expiry: something the site relies on that expires on a date unless
 * someone renews it, and how to renew it; and the error that says why the
 * check could not learn one, and what to do about it.
 */

import { DAY_MS } from "@nusnus/github-data/calendar";

/** A failure to learn when something expires, saying what to do about it. */
export class ExpiryCheckError extends Error {
  override name = "ExpiryCheckError";
}

/**
 * When one thing expires, or that it never does, and how to renew it before it
 * does: its subject names what expires, such as "The worker's GitHub token",
 * and its renewal is the next step for whoever reads it. It is due from
 * `NOTICE_DAYS` days before it expires, which gives its owner that much
 * notice.
 */
export class Expiry {
  static readonly NOTICE_DAYS = 30;

  readonly subject: string;
  readonly expiresAt: "never" | Date;
  readonly renewal: string;

  constructor(subject: string, expiresAt: "never" | Date, renewal: string) {
    this.subject = subject;
    this.expiresAt = expiresAt;
    this.renewal = renewal;
  }

  describeAt(now: Date): string {
    if (this.expiresAt === "never") {
      return `${this.subject} never expires.`;
    }
    const date = this.expiresAt.toISOString().slice(0, 10);
    const daysLeft = Math.floor(
      (this.expiresAt.getTime() - now.getTime()) / DAY_MS,
    );
    if (daysLeft < 0) {
      return `${this.subject} expired on ${date}.`;
    }
    return `${this.subject} expires on ${date}, in ${String(daysLeft)} ${daysLeft === 1 ? "day" : "days"}.`;
  }

  isDueAt(now: Date): boolean {
    return (
      this.expiresAt !== "never" &&
      this.expiresAt.getTime() - now.getTime() <= Expiry.NOTICE_DAYS * DAY_MS
    );
  }
}
