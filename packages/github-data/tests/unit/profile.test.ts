/**
 * @file Tomer's account and profile: his login, and the avatar and follower
 * count a profile reply holds.
 */

import { describe, expect, it } from "vitest";

import { GITHUB_LOGIN } from "../../src/profile.ts";
import { WORKER_ROUTES, WorkerReplyError } from "../../src/routes.ts";
import { profileReply } from "../fixtures/worker-replies.ts";

describe("GITHUB_LOGIN", () => {
  it("names Tomer Nosrati's GitHub account", () => {
    expect(GITHUB_LOGIN).toBe("Nusnus");
  });
});

describe("profile reply", () => {
  it("holds Tomer's avatar and follower count", () => {
    const route = WORKER_ROUTES.profile;

    expect(route.encodeReply(route.parseReply(profileReply))).toStrictEqual(
      profileReply,
    );
  });

  it("refuses an avatar served from outside GitHub's avatar host", () => {
    expect(() =>
      WORKER_ROUTES.profile.parseReply({
        ...profileReply,
        data: {
          ...profileReply.data,
          avatarUrl: "https://example.org/u/4662342?v=4",
        },
      }),
    ).toThrow(
      new WorkerReplyError(
        "The worker's /profile reply breaks the github-data contract:\n" +
          '✖ Invalid string: must start with "https://avatars.githubusercontent.com/"\n' +
          "  → at data.avatarUrl\n" +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });

  it("refuses a field the site does not render", () => {
    expect(() =>
      WORKER_ROUTES.profile.parseReply({
        ...profileReply,
        data: { ...profileReply.data, login: "Nusnus" },
      }),
    ).toThrow(
      new WorkerReplyError(
        "The worker's /profile reply breaks the github-data contract:\n" +
          '✖ Unrecognized key: "login"\n' +
          "  → at data\n" +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });
});
