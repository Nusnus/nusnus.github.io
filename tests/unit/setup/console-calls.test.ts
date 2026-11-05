/**
 * @file Every console method throws a ConsoleCallError, which names itself,
 * the call and how to fix it, unless the test stubs that method because it
 * expects the output.
 */

import { describe, expect, it, vi } from "vitest";

import { ConsoleCallError } from "../../setup/console-calls.ts";

describe("ConsoleCallError", () => {
  it("names itself where it prints", () => {
    expect(String(new ConsoleCallError("probe"))).toBe(
      "ConsoleCallError: probe",
    );
  });
});

describe("console-calls", () => {
  it.each([
    [
      "assert",
      'console.assert was called during a test: probe. Fix its cause, or where the test expects it, stub it with vi.spyOn(console, "assert").mockImplementation(() => undefined) and assert the call.',
    ],
    [
      "clear",
      'console.clear was called during a test: probe. Fix its cause, or where the test expects it, stub it with vi.spyOn(console, "clear").mockImplementation(() => undefined) and assert the call.',
    ],
    [
      "count",
      'console.count was called during a test: probe. Fix its cause, or where the test expects it, stub it with vi.spyOn(console, "count").mockImplementation(() => undefined) and assert the call.',
    ],
    [
      "countReset",
      'console.countReset was called during a test: probe. Fix its cause, or where the test expects it, stub it with vi.spyOn(console, "countReset").mockImplementation(() => undefined) and assert the call.',
    ],
    [
      "debug",
      'console.debug was called during a test: probe. Fix its cause, or where the test expects it, stub it with vi.spyOn(console, "debug").mockImplementation(() => undefined) and assert the call.',
    ],
    [
      "dir",
      'console.dir was called during a test: probe. Fix its cause, or where the test expects it, stub it with vi.spyOn(console, "dir").mockImplementation(() => undefined) and assert the call.',
    ],
    [
      "dirxml",
      'console.dirxml was called during a test: probe. Fix its cause, or where the test expects it, stub it with vi.spyOn(console, "dirxml").mockImplementation(() => undefined) and assert the call.',
    ],
    [
      "error",
      'console.error was called during a test: probe. Fix its cause, or where the test expects it, stub it with vi.spyOn(console, "error").mockImplementation(() => undefined) and assert the call.',
    ],
    [
      "group",
      'console.group was called during a test: probe. Fix its cause, or where the test expects it, stub it with vi.spyOn(console, "group").mockImplementation(() => undefined) and assert the call.',
    ],
    [
      "groupCollapsed",
      'console.groupCollapsed was called during a test: probe. Fix its cause, or where the test expects it, stub it with vi.spyOn(console, "groupCollapsed").mockImplementation(() => undefined) and assert the call.',
    ],
    [
      "groupEnd",
      'console.groupEnd was called during a test: probe. Fix its cause, or where the test expects it, stub it with vi.spyOn(console, "groupEnd").mockImplementation(() => undefined) and assert the call.',
    ],
    [
      "info",
      'console.info was called during a test: probe. Fix its cause, or where the test expects it, stub it with vi.spyOn(console, "info").mockImplementation(() => undefined) and assert the call.',
    ],
    [
      "log",
      'console.log was called during a test: probe. Fix its cause, or where the test expects it, stub it with vi.spyOn(console, "log").mockImplementation(() => undefined) and assert the call.',
    ],
    [
      "table",
      'console.table was called during a test: probe. Fix its cause, or where the test expects it, stub it with vi.spyOn(console, "table").mockImplementation(() => undefined) and assert the call.',
    ],
    [
      "time",
      'console.time was called during a test: probe. Fix its cause, or where the test expects it, stub it with vi.spyOn(console, "time").mockImplementation(() => undefined) and assert the call.',
    ],
    [
      "timeEnd",
      'console.timeEnd was called during a test: probe. Fix its cause, or where the test expects it, stub it with vi.spyOn(console, "timeEnd").mockImplementation(() => undefined) and assert the call.',
    ],
    [
      "timeLog",
      'console.timeLog was called during a test: probe. Fix its cause, or where the test expects it, stub it with vi.spyOn(console, "timeLog").mockImplementation(() => undefined) and assert the call.',
    ],
    [
      "trace",
      'console.trace was called during a test: probe. Fix its cause, or where the test expects it, stub it with vi.spyOn(console, "trace").mockImplementation(() => undefined) and assert the call.',
    ],
    [
      "warn",
      'console.warn was called during a test: probe. Fix its cause, or where the test expects it, stub it with vi.spyOn(console, "warn").mockImplementation(() => undefined) and assert the call.',
    ],
  ] as const)(
    "throws on console.%s, naming the output and the fix",
    (method, message) => {
      const call = () => {
        (console[method] as (...data: unknown[]) => void)("probe");
      };

      expect(call).toThrow(new ConsoleCallError(message));
    },
  );

  it("names every argument of the call", () => {
    expect(() => {
      console.error("boom", 42);
    }).toThrow(
      new ConsoleCallError(
        'console.error was called during a test: boom 42. Fix its cause, or where the test expects it, stub it with vi.spyOn(console, "error").mockImplementation(() => undefined) and assert the call.',
      ),
    );
  });

  it("lets a test stub a console method whose output it expects", () => {
    const logError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    console.error("expected");

    expect(logError).toHaveBeenCalledExactlyOnceWith("expected");
  });
});
