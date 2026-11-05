/**
 * @file A cached reply: a route's reply encoded once, as the JSON text the
 * worker sends, beside the instant its data was fetched and the token's
 * expiry; and its access headers: always the API version the worker requests,
 * and the token's expiry when it has one.
 */

import { profileReply } from "@nusnus/github-data/fixtures/worker-replies";
import { WORKER_ROUTES } from "@nusnus/github-data/routes";
import { describe, expect, it } from "vitest";

import { CachedReply } from "../../../../src/cache/cached-replies/cached-reply.ts";

const PROFILE_BODY =
  '{"data":{"avatarUrl":"https://avatars.githubusercontent.com/u/4662342?v=4","followers":120},"fetchedAt":"2026-11-04T07:19:55.000Z"}';
const FETCHED_AT = new Date("2026-11-04T07:19:55Z");

describe("CachedReply.encode", () => {
  it("encodes a route's reply as JSON text, beside when its data was fetched and the token's expiry", () => {
    expect(
      CachedReply.encode(
        WORKER_ROUTES.profile,
        WORKER_ROUTES.profile.parseReply(profileReply),
        "2023-04-26 23:23:18 +0200",
      ),
    ).toStrictEqual(
      new CachedReply(PROFILE_BODY, FETCHED_AT, "2023-04-26 23:23:18 +0200"),
    );
  });
});

describe("CachedReply.accessHeaders", () => {
  it("names the API version the worker requests, for a token that never expires", () => {
    expect(
      new CachedReply(PROFILE_BODY, FETCHED_AT, null).accessHeaders(),
    ).toStrictEqual({
      "X-GitHub-Api-Version": "2026-03-10",
    });
  });

  it("names the token's expiry too, when it has one", () => {
    expect(
      new CachedReply(
        PROFILE_BODY,
        FETCHED_AT,
        "2023-04-26 23:23:18 +0200",
      ).accessHeaders(),
    ).toStrictEqual({
      "GitHub-Authentication-Token-Expiration": "2023-04-26 23:23:18 +0200",
      "X-GitHub-Api-Version": "2026-03-10",
    });
  });
});
