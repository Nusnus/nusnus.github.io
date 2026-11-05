/**
 * @file Bun's install settings: each install waits as long after a release as
 * Renovate waits before it proposes one.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(import.meta.dirname, "../..");

function settingOf(file: string, pattern: RegExp): string | undefined {
  return pattern.exec(readFileSync(path.join(ROOT, file), "utf8"))?.[1];
}

describe("bunfig", () => {
  it("holds each install to the release age Renovate waits for", () => {
    expect({
      bunSeconds: settingOf("bunfig.toml", /^minimumReleaseAge = (\d+)$/m),
      renovateDays: settingOf(
        ".github/renovate.json5",
        /^ {2}minimumReleaseAge: "(\d+) days",$/m,
      ),
    }).toStrictEqual({ bunSeconds: "604800", renovateDays: "7" });
  });
});
