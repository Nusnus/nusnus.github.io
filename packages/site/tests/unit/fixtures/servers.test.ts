/**
 * @file smokeServers puts the preview on Astro preview's default port unless
 * PREVIEW_PORT names another, and the worker replay 1000 ports above it, and
 * refuses a PREVIEW_PORT that is no port or that leaves the replay none.
 */

import { describe, expect, it } from "vitest";

import { smokeServers } from "../../fixtures/servers.ts";

describe("smokeServers", () => {
  it("puts the preview on Astro preview's default port when PREVIEW_PORT is unset", () => {
    expect(smokeServers(undefined)).toStrictEqual({
      preview: { port: 4321, url: "http://localhost:4321" },
      workerReplay: { port: 5321, url: "http://localhost:5321" },
    });
  });

  it.each([
    [
      "1",
      {
        preview: { port: 1, url: "http://localhost:1" },
        workerReplay: { port: 1001, url: "http://localhost:1001" },
      },
    ],
    [
      "64535",
      {
        preview: { port: 64_535, url: "http://localhost:64535" },
        workerReplay: { port: 65_535, url: "http://localhost:65535" },
      },
    ],
  ] as const)(
    "accepts PREVIEW_PORT %s, putting the worker replay 1000 ports above it",
    (setting, servers) => {
      expect(smokeServers(setting)).toStrictEqual(servers);
    },
  );

  it.each([
    [
      "",
      'PREVIEW_PORT must be a port from 1 to 64535, so the worker replay\'s, 1000 above it, is a port too; got "". Set it to a free port in that range, or unset it to use 4321.',
    ],
    [
      "0",
      'PREVIEW_PORT must be a port from 1 to 64535, so the worker replay\'s, 1000 above it, is a port too; got "0". Set it to a free port in that range, or unset it to use 4321.',
    ],
    [
      "64536",
      'PREVIEW_PORT must be a port from 1 to 64535, so the worker replay\'s, 1000 above it, is a port too; got "64536". Set it to a free port in that range, or unset it to use 4321.',
    ],
    [
      "4411x",
      'PREVIEW_PORT must be a port from 1 to 64535, so the worker replay\'s, 1000 above it, is a port too; got "4411x". Set it to a free port in that range, or unset it to use 4321.',
    ],
    [
      "x4411",
      'PREVIEW_PORT must be a port from 1 to 64535, so the worker replay\'s, 1000 above it, is a port too; got "x4411". Set it to a free port in that range, or unset it to use 4321.',
    ],
    [
      "44.1",
      'PREVIEW_PORT must be a port from 1 to 64535, so the worker replay\'s, 1000 above it, is a port too; got "44.1". Set it to a free port in that range, or unset it to use 4321.',
    ],
  ] as const)(
    'refuses PREVIEW_PORT "%s", naming the ports it takes',
    (setting, message) => {
      expect(() => smokeServers(setting)).toThrow(new Error(message));
    },
  );
});
