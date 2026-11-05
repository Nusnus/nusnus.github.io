/**
 * @file The problems a browser page reports while a smoke test runs: each
 * console message, of any type, and each uncaught page error, as text, in
 * order.
 */

/** A console message, as Playwright's `ConsoleMessage` gives it. */
interface ConsoleMessage {
  text(): string;
  type(): string;
}

/**
 * The events a page reports problems through, as Playwright's `Page` emits
 * them.
 */
interface ProblemSource {
  on(event: "console", listener: (message: ConsoleMessage) => void): unknown;
  on(event: "pageerror", listener: (error: Error) => void): unknown;
}

/** Records each problem a page reports from the moment it starts listening. */
export class PageProblems {
  readonly problems: readonly string[];

  constructor(page: ProblemSource) {
    const problems: string[] = [];
    this.problems = problems;
    page.on("console", (message) => {
      problems.push(`console.${message.type()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => {
      problems.push(`uncaught: ${error.message}`);
    });
  }
}
