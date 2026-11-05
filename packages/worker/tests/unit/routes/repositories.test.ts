/**
 * @file The repositories route's source: a tracked repository's GitHub data,
 * refused when GitHub knows it by another name; Tomer's contributor rank, read
 * page by page until he is found, a short page or an empty repository ends the
 * list, or GitHub's ranks end; and a repository GitHub fails to answer for
 * failing the whole reply.
 */

import type { Exchange } from "@nusnus/github-data/fixtures/exchange";

import { TRACKED_REPOSITORIES } from "@nusnus/github-data/repositories";
import { describe, expect, it } from "vitest";

import { parseGitHubData } from "../../../src/github/failures.ts";
import {
  githubContributorsSchema,
  githubRepositorySchema,
  rankOnPage,
  repositoriesSource,
  repositoryFrom,
} from "../../../src/routes/repositories.ts";
import {
  recorded,
  replayGitHub,
  servedFor,
  testClient,
  useFakeGitHub,
} from "../../fixtures/github/fake.ts";
import { REPOSITORY_NOT_FOUND_STEP } from "../../fixtures/next-steps.ts";

useFakeGitHub();

const CELERY = parseGitHubData(
  "repository",
  githubRepositorySchema,
  recorded("rest/repos/celery/celery").body,
);

// A full page of celery's contributors, on which Tomer is not.
const FULL_PAGE_WITHOUT_TOMER = recorded(
  "rest/repos/celery/celery/contributors.page-2",
);

function contributors(name: string): ReturnType<typeof parseContributors> {
  return parseContributors(recorded(name).body);
}

function parseContributors(json: unknown) {
  return parseGitHubData("contributors", githubContributorsSchema, json);
}

function trackedExchangesButVineContributors(): Exchange[] {
  return TRACKED_REPOSITORIES.flatMap(({ fullName }) => [
    recorded(`rest/repos/${fullName}`),
    ...(fullName === "celery/vine"
      ? []
      : [recorded(`rest/repos/${fullName}/contributors.page-1`)]),
  ]);
}

function vineContributors(page: number): Exchange["request"] {
  return {
    method: "GET",
    url: `https://api.github.com/repos/celery/vine/contributors?per_page=100&page=${String(page)}`,
  };
}

describe("repositoriesSource", () => {
  it("counts its reply fresh for a quarter of an hour, as its refresh costs the most requests", () => {
    expect(repositoriesSource.freshForSeconds).toBe(900);
  });

  it("reads on to the next page of contributors until it finds Tomer", async () => {
    // A full page without Tomer, then vine's page, which ranks him 7th.
    replayGitHub(
      ...trackedExchangesButVineContributors(),
      servedFor(FULL_PAGE_WITHOUT_TOMER, vineContributors(1)),
      servedFor(
        recorded("rest/repos/celery/vine/contributors.page-1"),
        vineContributors(2),
      ),
    );

    await expect(
      repositoriesSource.fetchData(testClient().github),
    ).resolves.toMatchObject({ "celery/vine": { contributorRank: 107 } });
  });

  it("ranks no one in an empty repository, whose contributors GitHub answers with no content", async () => {
    replayGitHub(
      ...trackedExchangesButVineContributors(),
      servedFor(
        recorded("rest/repos/meilix/meilix-docs/contributors.page-1"),
        vineContributors(1),
      ),
    );

    await expect(
      repositoriesSource.fetchData(testClient().github),
    ).resolves.toMatchObject({ "celery/vine": { contributorRank: null } });
  });

  it("fails the reply when GitHub has no repository it tracks, saying to remove it", async () => {
    replayGitHub(
      ...trackedExchangesButVineContributors().filter(
        ({ request }) =>
          request.url !== "https://api.github.com/repos/celery/vine",
      ),
      recorded("rest/repos/celery/vine/contributors.page-1"),
      servedFor(recorded("rest/repos/celery/no-such-repository"), {
        method: "GET",
        url: "https://api.github.com/repos/celery/vine",
      }),
    );

    await expect(
      repositoriesSource.fetchData(testClient().github),
    ).rejects.toThrow(
      expect.objectContaining({
        kind: "not found",
        message:
          'GitHub answered GET /repos/celery/vine with 404: {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}\n' +
          REPOSITORY_NOT_FOUND_STEP,
        name: "GitHubError",
      }),
    );
  });

  it("fails the reply when GitHub has no contributors list for a repository it tracks, saying to remove it", async () => {
    replayGitHub(
      ...trackedExchangesButVineContributors(),
      servedFor(
        recorded("rest/repos/celery/no-such-repository"),
        vineContributors(1),
      ),
    );

    await expect(
      repositoriesSource.fetchData(testClient().github),
    ).rejects.toThrow(
      expect.objectContaining({
        kind: "not found",
        message:
          'GitHub answered GET /repos/celery/vine/contributors?per_page=100&page=1 with 404: {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}\n' +
          REPOSITORY_NOT_FOUND_STEP,
        name: "GitHubError",
      }),
    );
  });
});

describe("repositoryFrom", () => {
  it("reads a tracked repository's GitHub data, with Tomer's rank", () => {
    expect(repositoryFrom("celery/celery", CELERY, 4)).toStrictEqual({
      contributorRank: 4,
      description: "Distributed Task Queue (development branch)",
      forks: 5253,
      language: "Python",
      lastPush: new Date("2026-11-03T22:13:28Z"),
      stars: 29133,
    });
  });

  it("refuses a repository GitHub knows by another name, saying to rename it", () => {
    expect(() => repositoryFrom("celery/kombu", CELERY, 4)).toThrow(
      expect.objectContaining({
        kind: "not found",
        message:
          "GitHub knows the tracked repository celery/kombu as celery/celery now.\n" +
          "Rename it in TRACKED_REPOSITORIES.",
        name: "GitHubError",
      }),
    );
  });
});

describe("rankOnPage", () => {
  it("ranks Tomer by his place on the first page", () => {
    expect(
      rankOnPage(1, contributors("rest/repos/celery/vine/contributors.page-1")),
    ).toBe(7);
  });

  it("ranks Tomer after every contributor on the pages before", () => {
    expect(
      rankOnPage(2, contributors("rest/repos/celery/vine/contributors.page-1")),
    ).toBe(107);
  });

  it("reads on past a full page without Tomer", () => {
    expect(rankOnPage(4, parseContributors(FULL_PAGE_WITHOUT_TOMER.body))).toBe(
      "next page",
    );
  });

  it("ranks no one after a short page without Tomer", () => {
    expect(
      rankOnPage(1, contributors("rest/repos/celery/ceps/contributors.page-1")),
    ).toBeNull();
  });

  it("ranks no one past five pages, where GitHub's ranks end", () => {
    expect(
      rankOnPage(5, parseContributors(FULL_PAGE_WITHOUT_TOMER.body)),
    ).toBeNull();
  });
});
