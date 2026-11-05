/**
 * @file The profile route's source: Tomer's avatar and follower count, read
 * from GitHub's users API, which must serve the avatar from its avatar host,
 * and a login GitHub knows no account by refused, saying to set Tomer's.
 */

import { describe, expect, it } from "vitest";

import { parseGitHubData } from "../../../src/github/failures.ts";
import {
  githubUserSchema,
  profileFrom,
  profileSource,
} from "../../../src/routes/profile.ts";
import {
  recorded,
  replayGitHub,
  servedFor,
  testClient,
  useFakeGitHub,
} from "../../fixtures/github/fake.ts";
import { MISSHAPEN_STEP } from "../../fixtures/next-steps.ts";

useFakeGitHub();

const USER = recorded("rest/users/Nusnus").body as object;

describe("githubUserSchema", () => {
  it("accepts an avatar served from GitHub's avatar host", () => {
    expect(
      parseGitHubData("reply to GET /users/Nusnus", githubUserSchema, USER)
        .avatar_url,
    ).toBe("https://avatars.githubusercontent.com/u/4662342?v=4");
  });

  it("refuses an avatar served from outside GitHub's avatar host", () => {
    expect(() =>
      parseGitHubData("reply to GET /users/Nusnus", githubUserSchema, {
        ...USER,
        avatar_url: "https://example.org/u/4662342?v=4",
      }),
    ).toThrow(
      expect.objectContaining({
        kind: "misshapen",
        message:
          "GitHub's reply to GET /users/Nusnus is not in the shape the worker reads:\n" +
          '✖ Invalid string: must start with "https://avatars.githubusercontent.com/"\n' +
          "  → at avatar_url\n" +
          MISSHAPEN_STEP,
        name: "GitHubError",
      }),
    );
  });
});

describe("profileSource", () => {
  it("counts its reply fresh for ten minutes", () => {
    expect(profileSource.freshForSeconds).toBe(600);
  });

  it("refuses a login GitHub knows no account by, saying to set Tomer's", async () => {
    // GitHub's real reply for a path it does not have, as it answers a login
    // that no account has, which no exchange can record of Tomer's own.
    replayGitHub(
      servedFor(
        recorded("rest/repos/celery/no-such-repository"),
        recorded("rest/users/Nusnus").request,
      ),
    );

    await expect(profileSource.fetchData(testClient().github)).rejects.toThrow(
      expect.objectContaining({
        kind: "not found",
        message:
          'GitHub answered GET /users/Nusnus with 404: {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}\n' +
          "Set GITHUB_LOGIN to Tomer's GitHub login.",
        name: "GitHubError",
      }),
    );
  });
});

describe("profileFrom", () => {
  it("reads Tomer's avatar and follower count", () => {
    expect(
      profileFrom(
        parseGitHubData("reply to GET /users/Nusnus", githubUserSchema, USER),
      ),
    ).toStrictEqual({
      avatarUrl: "https://avatars.githubusercontent.com/u/4662342?v=4",
      followers: 120,
    });
  });
});
