/**
 * @file Tomer's standing as a contributor to the tracked repositories: Celery's
 * repository by its full name, the link to his commits in a repository, and a
 * rank as it reads.
 */

import { describe, expect, it } from "vitest";

import {
  CELERY_FULL_NAME,
  commitsUrl,
  formatRank,
} from "../../../../src/github-data/stats/contributor-standing.ts";

describe("CELERY_FULL_NAME", () => {
  it("is Celery's own repository", () => {
    expect(CELERY_FULL_NAME).toBe("celery/celery");
  });
});

describe("commitsUrl", () => {
  it("links to Tomer's commits in the repository", () => {
    expect(commitsUrl("mher/flower")).toBe(
      "https://github.com/mher/flower/commits?author=Nusnus",
    );
  });
});

describe("formatRank", () => {
  it("writes a rank after a number sign", () => {
    expect(formatRank(4)).toBe("#4");
  });
});
