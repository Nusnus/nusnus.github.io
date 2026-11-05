/**
 * @file A route's backoff: the first failure waits from half a minute to a
 * minute, each failure in a row doubles the wait up to a cap, and a failure
 * that names when GitHub allows requests again waits exactly until then; the
 * backoff keeps the failure's message, and holds back every fetch before its
 * instant.
 */

import { describe, expect, it } from "vitest";

import { Backoff } from "../../../../src/cache/backoffs/backoff.ts";
import { GitHubError } from "../../../../src/github/failures.ts";
import { TRANSIENT_STEP } from "../../../fixtures/next-steps.ts";

const NOW = new Date("2026-11-04T12:00:00Z");
const SERVER_ERROR = GitHubError.transient("GitHub answered with 503.");
const SERVER_ERROR_MESSAGE = "GitHub answered with 503.\n" + TRANSIENT_STEP;

describe("Backoff.after", () => {
  it.each([
    [0, new Date("2026-11-04T12:00:30Z")],
    [0.5, new Date("2026-11-04T12:00:45Z")],
  ])(
    "waits half a minute and a random part of another after a first failure, here %d",
    (random, notBefore) => {
      expect(
        Backoff.after(undefined, SERVER_ERROR, NOW, () => random),
      ).toStrictEqual(new Backoff(1, notBefore, SERVER_ERROR_MESSAGE));
    },
  );

  it("doubles the wait after each failure in a row", () => {
    expect(
      Backoff.after(
        new Backoff(2, NOW, "GitHub answered with 502."),
        SERVER_ERROR,
        NOW,
        () => 0,
      ),
    ).toStrictEqual(
      new Backoff(3, new Date("2026-11-04T12:02:00Z"), SERVER_ERROR_MESSAGE),
    );
  });

  it("waits an hour at most", () => {
    expect(
      Backoff.after(
        new Backoff(7, NOW, "GitHub answered with 502."),
        SERVER_ERROR,
        NOW,
        () => 0.5,
      ).notBefore,
    ).toStrictEqual(new Date("2026-11-04T12:45:00Z"));
  });

  it("waits until the instant GitHub names", () => {
    const rateLimit = GitHubError.rateLimited(
      "GitHub limited the rate.",
      new Date("2026-11-04T12:20:04Z"),
    );

    expect(Backoff.after(undefined, rateLimit, NOW, () => 0.5)).toStrictEqual(
      new Backoff(
        1,
        new Date("2026-11-04T12:20:04Z"),
        "GitHub limited the rate.\nGitHub allows requests again at 2026-11-04T12:20:04.000Z.",
      ),
    );
  });
});

describe("Backoff.defers", () => {
  const backoff = new Backoff(1, NOW, SERVER_ERROR_MESSAGE);

  it("holds back a fetch before its instant", () => {
    expect(backoff.defers(new Date(NOW.getTime() - 1))).toBe(true);
  });

  it("lets a fetch go from its instant on", () => {
    expect(backoff.defers(NOW)).toBe(false);
  });
});
