/**
 * @file The fake network behaves as the network does for the scripts: a
 * request no replay answers fails as an unreachable one does; a reply served
 * for another request keeps its reply; a received response matches what the
 * expiry check's fetch makes of the replay; a replay answers each recorded
 * request with its recorded reply, as often as it comes, records who asked,
 * and leaves other requests to other replays. An unreachable service, a
 * silent one and a broken body fail as fetch fails for each, and leave every
 * other request to its replay.
 */

import { describe, expect, it } from "vitest";

import {
  breakBody,
  receivedFrom,
  receivedRequests,
  recorded,
  replayServices,
  servedAt,
  silence,
  unreachable,
  useFakeNetwork,
} from "../../../fixtures/services/network.ts";

useFakeNetwork();

const VERSIONS_URL = "https://api.github.com/versions";
const SCHEDULE_URL =
  "https://raw.githubusercontent.com/nodejs/Release/main/schedule.json";

describe("useFakeNetwork", () => {
  it("fails a request no replay answers as an unreachable network does, a .json file's too", async () => {
    replayServices(recorded("github/versions"));

    await expect(fetch(SCHEDULE_URL)).rejects.toThrow(
      new TypeError("fetch failed"),
    );
  });
});

describe("servedAt", () => {
  it("serves an exchange's reply for another request", async () => {
    replayServices(servedAt(recorded("node/missing-file"), SCHEDULE_URL));

    const response = await fetch(SCHEDULE_URL);

    expect([response.status, await response.text()]).toStrictEqual([
      404,
      "404: Not Found",
    ]);
  });
});

describe("receivedFrom", () => {
  it("is what the check's fetch receives from the exchange's replay", async () => {
    const exchange = recorded("github/versions");
    replayServices(exchange);

    const response = await fetch(VERSIONS_URL);

    expect(receivedFrom(exchange)).toStrictEqual({
      body: await response.text(),
      headers: response.headers,
      status: response.status,
      url: VERSIONS_URL,
    });
  });

  it("is what the check's fetch receives from the replay of a reply without a body", async () => {
    // No service the scripts ask answers without a body on demand, and an
    // exchange may hold none, so this one is written by hand.
    const exchange = {
      headers: {},
      request: { method: "GET", url: VERSIONS_URL },
      status: 204,
    };
    replayServices(exchange);

    const response = await fetch(VERSIONS_URL);

    expect(receivedFrom(exchange)).toStrictEqual({
      body: await response.text(),
      headers: response.headers,
      status: 204,
      url: VERSIONS_URL,
    });
  });
});

describe("replayServices", () => {
  it("answers a recorded request with its recorded status, headers and JSON, as often as it comes", async () => {
    replayServices(recorded("github/versions"));

    const responses = await Promise.all([
      fetch(VERSIONS_URL),
      fetch(VERSIONS_URL),
    ]);

    expect(
      await Promise.all(
        responses.map(async (response) => [
          response.status,
          response.headers.get("X-GitHub-Api-Version-Selected"),
          await response.json(),
        ]),
      ),
    ).toStrictEqual([
      [200, "2022-11-28", ["2026-03-10", "2022-11-28"]],
      [200, "2022-11-28", ["2026-03-10", "2022-11-28"]],
    ]);
  });

  it("answers with a recorded text body as text", async () => {
    replayServices(recorded("node/missing-file"));

    const response = await fetch(
      "https://raw.githubusercontent.com/nodejs/Release/main/missing-file.json",
    );

    expect([response.status, await response.text()]).toStrictEqual([
      404,
      "404: Not Found",
    ]);
  });

  it("records each request it answers, with the token it carried", async () => {
    replayServices(recorded("github/versions"));

    await fetch(VERSIONS_URL, { headers: { Authorization: "Bearer token" } });
    await fetch(VERSIONS_URL);

    expect(
      receivedRequests().map(({ headers, url }) => ({
        authorization: headers["authorization"],
        url,
      })),
    ).toStrictEqual([
      { authorization: "Bearer token", url: VERSIONS_URL },
      { authorization: undefined, url: VERSIONS_URL },
    ]);
  });

  it("leaves a request it holds no exchange for to another replay", async () => {
    replayServices(recorded("github/versions"));
    replayServices(recorded("node/schedule"));

    expect(
      (await Promise.all([fetch(VERSIONS_URL), fetch(SCHEDULE_URL)])).map(
        ({ status }) => status,
      ),
    ).toStrictEqual([200, 200]);
  });
});

describe("unreachable", () => {
  it("fails each request to the service as fetch fails when the network does, with a TypeError", async () => {
    replayServices(recorded("node/schedule"));
    unreachable(VERSIONS_URL);

    await expect(fetch(VERSIONS_URL)).rejects.toThrow(
      new TypeError("fetch failed"),
    );
    expect((await fetch(SCHEDULE_URL)).status).toBe(200);
  });
});

describe("silence", () => {
  it("fails each request to the service as fetch fails once its deadline passes, with the deadline's reason", async () => {
    const deadline = AbortSignal.timeout(1);
    await new Promise((resolve) => {
      deadline.addEventListener("abort", resolve);
    });
    const reason = deadline.reason as DOMException;
    silence(VERSIONS_URL);

    const silent = await fetch(VERSIONS_URL).catch((error: unknown) => error);

    expect(silent).toBeInstanceOf(DOMException);
    expect([
      (silent as DOMException).name,
      (silent as DOMException).message,
    ]).toStrictEqual([reason.name, reason.message]);
  });

  it("leaves every other request to the network", async () => {
    replayServices(recorded("node/schedule"));
    silence(VERSIONS_URL);

    expect((await fetch(SCHEDULE_URL)).status).toBe(200);
  });
});

describe("breakBody", () => {
  it("fails reading each response body from the service with the error", async () => {
    replayServices(recorded("node/schedule"));
    breakBody(VERSIONS_URL, new Error("the body broke"));

    const response = await fetch(VERSIONS_URL);

    await expect(response.text()).rejects.toThrow(new Error("the body broke"));
    expect((await fetch(SCHEDULE_URL)).status).toBe(200);
  });
});
