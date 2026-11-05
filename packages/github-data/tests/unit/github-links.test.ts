/**
 * @file GitHub's links: a link stays on github.com, and each page the project
 * names has its link.
 */

import { describe, expect, it } from "vitest";

import {
  commitsByAuthorUrl,
  commitUrl,
  GITHUB_API_ORIGIN,
  githubUrlSchema,
  ownerUrl,
  personalAccessTokenUrl,
  pullRequestUrl,
  repositoryUrl,
} from "../../src/github-links.ts";
import { parse } from "../../src/schema.ts";

describe("GITHUB_API_ORIGIN", () => {
  it("is where GitHub serves its REST and GraphQL API", () => {
    expect(GITHUB_API_ORIGIN).toBe("https://api.github.com");
  });
});

describe("githubUrlSchema", () => {
  it("accepts a link to a page on github.com", () => {
    expect(
      parse(
        githubUrlSchema,
        "https://github.com/celery/celery",
        (issues) => new Error(issues),
      ),
    ).toBe("https://github.com/celery/celery");
  });

  it.each([
    "http://github.com/celery/celery",
    "https://github.com.example.org/celery/celery",
    "javascript:alert(1)",
  ])("refuses %s, which is not on github.com", (value) => {
    expect(() =>
      parse(githubUrlSchema, value, (issues) => new Error(issues)),
    ).toThrow(
      new Error(
        "✖ must be a link to a page on github.com, such as https://github.com/celery",
      ),
    );
  });
});

describe("ownerUrl", () => {
  it("is the owner's profile", () => {
    expect(ownerUrl("celery")).toBe("https://github.com/celery");
  });
});

describe("repositoryUrl", () => {
  it("is the repository's page", () => {
    expect(repositoryUrl("celery/kombu")).toBe(
      "https://github.com/celery/kombu",
    );
  });
});

describe("pullRequestUrl", () => {
  it("is the pull request's page in its repository", () => {
    expect(pullRequestUrl("celery/celery", 9000)).toBe(
      "https://github.com/celery/celery/pull/9000",
    );
  });
});

describe("commitUrl", () => {
  it("is the commit's page in its repository", () => {
    expect(
      commitUrl("celery/billiard", "7d2fcd2a2d0978d2c9062b8566fac0f7f84e5399"),
    ).toBe(
      "https://github.com/celery/billiard/commit/7d2fcd2a2d0978d2c9062b8566fac0f7f84e5399",
    );
  });
});

describe("commitsByAuthorUrl", () => {
  it("lists the person's commits to the repository", () => {
    expect(commitsByAuthorUrl("celery/celery", "Nusnus")).toBe(
      "https://github.com/celery/celery/commits?author=Nusnus",
    );
  });
});

describe("personalAccessTokenUrl", () => {
  it("opens the token form with its name and expiry filled in", () => {
    expect(personalAccessTokenUrl("nusnus.github.io worker", "none")).toBe(
      "https://github.com/settings/personal-access-tokens/new?name=nusnus.github.io%20worker&expires_in=none",
    );
  });
});
