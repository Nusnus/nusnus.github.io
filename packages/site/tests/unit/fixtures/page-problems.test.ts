/**
 * @file The problems a page reports: each console message, whatever its type,
 * and each uncaught error, as text, in order.
 */

import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";

import { PageProblems } from "../../fixtures/page-problems.ts";

function consoleMessage(type: string, text: string) {
  return { text: () => text, type: () => type };
}

describe("PageProblems", () => {
  it("records each console message and each uncaught error, in order", () => {
    const page = new EventEmitter();
    const { problems } = new PageProblems(page);

    page.emit("console", consoleMessage("warning", "Deprecated"));
    page.emit("pageerror", new Error("Boom"));
    page.emit("console", consoleMessage("error", "Failed to load"));

    expect(problems).toStrictEqual([
      "console.warning: Deprecated",
      "uncaught: Boom",
      "console.error: Failed to load",
    ]);
  });

  it.each([
    ["log", "console.log: Hello"],
    ["info", "console.info: Hello"],
    ["debug", "console.debug: Hello"],
    ["assert", "console.assert: Hello"],
  ])("records a console %s message too", (type, problem) => {
    const page = new EventEmitter();
    const { problems } = new PageProblems(page);

    page.emit("console", consoleMessage(type, "Hello"));

    expect(problems).toStrictEqual([problem]);
  });
});
