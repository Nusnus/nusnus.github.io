/**
 * @file Title lookups: one query for any number of pages, each page asked
 * once, with each link a variable, and none without pages; a pull request's
 * title, a commit message's first line, or for a commit whose first line is
 * empty its reference; and no title for a page GitHub does not have.
 */

import type { GitHubUrl } from "@nusnus/github-data/github-links";

import { describe, expect, it } from "vitest";

import type { TitlePageTarget } from "../../../../src/routes/activity/event-targets.ts";

import { parseGitHubData } from "../../../../src/github/failures.ts";
import {
  type GitHubResources,
  githubResourcesSchema,
  lookUpTitles,
  titlesFrom,
  titlesQuery,
} from "../../../../src/routes/activity/titles.ts";
import {
  receivedRequests,
  recorded,
  replayGitHub,
  testClient,
  useFakeGitHub,
} from "../../../fixtures/github/fake.ts";
import { MISSHAPEN_STEP } from "../../../fixtures/next-steps.ts";

useFakeGitHub();

const NUSTACK_RELEASE =
  "https://github.com/Nusnus/nustack/commit/4a4971bbf03f31c673ebe5c23bd8e32918e6cc61";

function page(url: GitHubUrl, reference: string): TitlePageTarget {
  return { reference, titlePageUrl: url, url };
}

function recordedResources(name: string): GitHubResources {
  return parseGitHubData(
    "data",
    githubResourcesSchema,
    (recorded(name).body as { data: unknown }).data,
  );
}

describe("lookUpTitles", () => {
  it("looks up every page's title in one request, asking for each page once", async () => {
    replayGitHub(recorded("graphql/titles-of-user-events"));
    const pages = [
      page(NUSTACK_RELEASE, "4a4971b"),
      ...[7, 36, 35, 20, 12, 11].map((number) =>
        page(
          `https://github.com/Nusnus/nusnus.github.io/pull/${String(number)}`,
          `#${String(number)}`,
        ),
      ),
    ];

    const titles = await lookUpTitles(testClient().github, [
      ...pages,
      page("https://github.com/Nusnus/nusnus.github.io/pull/36", "#36"),
    ]);

    expect([
      receivedRequests().length,
      titles.get("https://github.com/Nusnus/nusnus.github.io/pull/7"),
    ]).toStrictEqual([
      1,
      "feat(chat): rebuild /chat as Cybernus — Tomer's digital self",
    ]);
  });

  it("sends no request without pages", async () => {
    await expect(lookUpTitles(testClient().github, [])).resolves.toStrictEqual(
      new Map(),
    );
    expect(receivedRequests()).toStrictEqual([]);
  });
});

describe("titlesQuery", () => {
  it("asks for each page's resource, its link a variable", () => {
    expect(
      titlesQuery([
        page(NUSTACK_RELEASE, "4a4971b"),
        page("https://github.com/celery/celery/pull/11013", "#11013"),
      ]),
    ).toStrictEqual({
      query:
        "query ($url0: URI!, $url1: URI!) {\n" +
        "  resource0: resource(url: $url0) { ... on PullRequest { title } ... on Commit { message } }\n" +
        "  resource1: resource(url: $url1) { ... on PullRequest { title } ... on Commit { message } }\n" +
        "}",
      variables: {
        url0: NUSTACK_RELEASE,
        url1: "https://github.com/celery/celery/pull/11013",
      },
    });
  });
});

describe("titlesFrom", () => {
  it("refuses a reply that holds no resource for a page", () => {
    expect(() =>
      titlesFrom(
        [page("https://github.com/celery/kombu/pull/2817", "#2817")],
        {},
      ),
    ).toThrow(
      expect.objectContaining({
        kind: "misshapen",
        message:
          "GitHub's reply to the title lookup holds no resource0, for https://github.com/celery/kombu/pull/2817.\n" +
          MISSHAPEN_STEP,
        name: "GitHubError",
      }),
    );
  });

  it("takes each commit message's first line, and each pull request's title", () => {
    expect(
      titlesFrom(
        [
          page(
            "https://github.com/celery/sphinx_celery/commit/833e23a3592cd842ad4af21e9c19a0a6ea311e26",
            "833e23a",
          ),
          page(
            "https://github.com/celery/celery/commit/683271f43f92e4f730b640913c4e96eb30f9944c",
            "683271f",
          ),
          page(
            "https://github.com/celery/celery/commit/420fd8f9f476674b9362fbad8dcf9a52b580cbe4",
            "420fd8f",
          ),
          page(
            "https://github.com/celery/kombu/commit/4480119fcb6cec09d7d1e8e523182f61eb1d7fe6",
            "4480119",
          ),
          page("https://github.com/celery/kombu/pull/2817", "#2817"),
        ],
        recordedResources("graphql/titles-of-celery-events"),
      ),
    ).toStrictEqual(
      new Map([
        [
          "https://github.com/celery/celery/commit/420fd8f9f476674b9362fbad8dcf9a52b580cbe4",
          "Update billiard and click-repl versions in requirements (#11002)",
        ],
        [
          "https://github.com/celery/celery/commit/683271f43f92e4f730b640913c4e96eb30f9944c",
          "[pre-commit.ci] pre-commit autoupdate",
        ],
        [
          "https://github.com/celery/kombu/commit/4480119fcb6cec09d7d1e8e523182f61eb1d7fe6",
          "Merge branch 'main' into py315",
        ],
        [
          "https://github.com/celery/kombu/pull/2817",
          "chore(deps): Bump pytest from 9.1.1 to 9.2.0",
        ],
        [
          "https://github.com/celery/sphinx_celery/commit/833e23a3592cd842ad4af21e9c19a0a6ea311e26",
          "[pre-commit.ci] pre-commit autoupdate",
        ],
      ]),
    );
  });

  it("titles a commit whose message's first line is empty by its reference", () => {
    // git refuses an empty commit message unless told otherwise, so no
    // recorded commit has one; this resource is written here.
    expect(
      titlesFrom([page(NUSTACK_RELEASE, "4a4971b")], {
        resource0: { message: "\nchore(release): 0.0.2 (#35)" },
      }),
    ).toStrictEqual(new Map([[NUSTACK_RELEASE, "4a4971b"]]));
  });

  it("gives no title to a page GitHub does not have", () => {
    expect(
      titlesFrom(
        [page("https://github.com/celery/celery/pull/999999999", "#999999999")],
        recordedResources("graphql/titles-of-missing-pull-request"),
      ),
    ).toStrictEqual(new Map());
  });
});
