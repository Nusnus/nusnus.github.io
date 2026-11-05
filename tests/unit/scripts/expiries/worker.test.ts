/**
 * @file The worker's access to GitHub is read from its reply's access
 * headers: the API version it requests, and when its token expires, or that it
 * never does. A reply fails, saying what to do, when the worker could not
 * fetch GitHub's data, when it answers with another failure, when it breaks
 * the contract, and when it names no API version.
 */

import type { Exchange } from "@nusnus/github-data/fixtures/exchange";

import {
  noSuchRouteExchange,
  profileExchange,
  profileUnavailableExchange,
} from "@nusnus/github-data/fixtures/worker-replies";
import { describe, expect, it } from "vitest";

import { ExpiryCheckError } from "../../../../scripts/expiries/expiry.ts";
import { parseWorkerAccess } from "../../../../scripts/expiries/worker.ts";
import { receivedFrom, servedAt } from "../../../fixtures/services/network.ts";

const PROFILE_URL = "https://ai-proxy.tomer-nosrati.workers.dev/profile";

describe("parseWorkerAccess", () => {
  it("reads the API version the worker requests and when its token expires", () => {
    expect(parseWorkerAccess(receivedFrom(profileExchange))).toStrictEqual({
      apiVersion: "2026-03-10",
      tokenExpiresAt: new Date("2023-04-26T21:23:18Z"),
    });
  });

  it("reads a token that never expires from a reply that names no token expiry", () => {
    // The recorded reply came from a token that expires; one that never does
    // makes GitHub, and so the worker, send no expiry, so this drops it.
    const neverExpiring: Exchange = {
      ...profileExchange,
      headers: { "X-GitHub-Api-Version": "2026-03-10" },
    };

    expect(parseWorkerAccess(receivedFrom(neverExpiring))).toStrictEqual({
      apiVersion: "2026-03-10",
      tokenExpiresAt: "never",
    });
  });

  it("refuses a reply the worker could not fetch from GitHub, saying the next run repeats the check", () => {
    expect(() =>
      parseWorkerAccess(receivedFrom(profileUnavailableExchange)),
    ).toThrow(
      new ExpiryCheckError(
        `The worker answered GET ${PROFILE_URL} with 502: ` +
          '{"error":"GitHub data for /profile is unavailable, and the worker has no cached reply to serve: GitHub answered GET /users/Nusnus with 403: {\\"message\\":\\"API rate limit exceeded for 203.0.113.7. (But here\'s the good news: Authenticated requests get a higher rate limit. Check out the documentation for more details.)\\",\\"documentation_url\\":\\"https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting\\"}\\nGitHub allows requests again at 2026-11-04T08:20:04.000Z.\\nThe worker asks GitHub again at 2026-11-04T08:20:04.000Z."}\n' +
          "It could not fetch GitHub's data and had no cached reply to serve. The next scheduled run repeats the check; " +
          "if the failure lasts, the worker's logs, in the Cloudflare dashboard's Workers & Pages, say why.",
      ),
    );
  });

  it("refuses any other failing reply from the worker, saying to deploy it from main", () => {
    // A worker deployed from a commit without the profile route answers its
    // path as it answers any other it lacks, which no worker deployed from
    // main does, so this serves its recorded answer to an unknown path.
    expect(() =>
      parseWorkerAccess(
        receivedFrom(servedAt(noSuchRouteExchange, PROFILE_URL)),
      ),
    ).toThrow(
      new ExpiryCheckError(
        `The worker answered GET ${PROFILE_URL} with 404: ` +
          '{"error":"The worker has no route at /no-such-route; it serves /activity, /contribution-graph, /profile, /repositories."}\n' +
          "Deploy the worker from main; if that does not fix it, the worker's logs, in the Cloudflare dashboard's Workers & Pages, say why.",
      ),
    );
  });

  it("refuses a reply that breaks the contract, saying to deploy from one commit", () => {
    // A worker deployed from another commit sends another shape, which none
    // deployed from main can, so this edits the recorded reply's body.
    const otherShape: Exchange = {
      ...profileExchange,
      body: { data: {}, fetchedAt: "now" },
    };

    expect(() => parseWorkerAccess(receivedFrom(otherShape))).toThrow(
      new ExpiryCheckError(
        "The worker's /profile reply breaks the github-data contract:\n" +
          "✖ Invalid ISO datetime\n  → at fetchedAt\n" +
          "✖ Invalid input: expected string, received undefined\n  → at data.avatarUrl\n" +
          "✖ Invalid input: expected number, received undefined\n  → at data.followers\n" +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });

  it("refuses a reply that names no API version, saying to deploy the worker", () => {
    // A worker deployed from before it sent the access headers sends none,
    // which none deployed from main can, so this drops them.
    const noAccessHeaders: Exchange = { ...profileExchange, headers: {} };

    expect(() => parseWorkerAccess(receivedFrom(noAccessHeaders))).toThrow(
      new ExpiryCheckError(
        `The worker's reply to GET ${PROFILE_URL} has no valid API version in its X-GitHub-Api-Version header:\n` +
          "✖ Invalid input: expected string, received null\n" +
          "Deploy the worker from main.",
      ),
    );
  });
});
