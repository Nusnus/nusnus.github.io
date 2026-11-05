/**
 * @file Makes every console method throw, so a test that writes to the console
 * fails where it does instead of passing with output nobody reads.
 */

/** A console call made while a test ran. */
export class ConsoleCallError extends Error {
  override name = "ConsoleCallError";
}

// Every method of the Console standard: https://console.spec.whatwg.org/
const CONSOLE_METHODS = [
  "assert",
  "clear",
  "count",
  "countReset",
  "debug",
  "dir",
  "dirxml",
  "error",
  "group",
  "groupCollapsed",
  "groupEnd",
  "info",
  "log",
  "table",
  "time",
  "timeEnd",
  "timeLog",
  "trace",
  "warn",
] as const satisfies readonly (keyof Console)[];

for (const method of CONSOLE_METHODS) {
  console[method] = (...data: unknown[]) => {
    throw new ConsoleCallError(
      `console.${method} was called during a test: ${data.map(String).join(" ")}. ` +
        "Fix its cause, or where the test expects it, stub it with " +
        `vi.spyOn(console, "${method}").mockImplementation(() => undefined) and assert the call.`,
    );
  };
}
