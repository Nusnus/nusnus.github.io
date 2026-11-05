/**
 * @file What every recorder shares: an exchange's file is written as Prettier
 * formats it under the config that governs the file, in a folder made for it
 * if need be, and replaces any file there whole, leaving nothing beside it.
 * These tests sit among the repository's, since the worker's own run in
 * workerd, which reads and writes no files.
 */

import type { Exchange } from "@nusnus/github-data/fixtures/exchange";

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { writeExchangeFile } from "../../../../../packages/worker/scripts/recording.ts";
import { temporaryFolder } from "../../../../fixtures/temporary-folder.ts";

const ZEN: Exchange = {
  request: { method: "GET", url: "https://api.github.com/zen" },
  status: 200,
  headers: { "content-type": "text/plain;charset=utf-8" },
  body: "Accessible for all.",
};

describe("writeExchangeFile", () => {
  it("writes the exchange as Prettier formats it under the file's config, joining each array that fits on a line", async () => {
    const folder = temporaryFolder("recording", {
      ".prettierrc.json": '{ "useTabs": true }',
    });
    const file = path.join(folder, "rest/zen.json");

    await writeExchangeFile(file, { ...ZEN, body: ["Accessible", "for all"] });

    expect(readFileSync(file, "utf8")).toBe(
      "{\n" +
        '\t"request": {\n' +
        '\t\t"method": "GET",\n' +
        '\t\t"url": "https://api.github.com/zen"\n' +
        "\t},\n" +
        '\t"status": 200,\n' +
        '\t"headers": {\n' +
        '\t\t"content-type": "text/plain;charset=utf-8"\n' +
        "\t},\n" +
        '\t"body": ["Accessible", "for all"]\n' +
        "}\n",
    );
  });

  it("replaces a file already there, leaving nothing beside it", async () => {
    const folder = temporaryFolder("recording", {
      "rest/zen.json": "an older recording",
    });

    await writeExchangeFile(path.join(folder, "rest/zen.json"), ZEN);

    expect([
      readdirSync(path.join(folder, "rest")),
      JSON.parse(readFileSync(path.join(folder, "rest/zen.json"), "utf8")),
    ]).toStrictEqual([["zen.json"], ZEN]);
  });
});
