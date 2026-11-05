/**
 * @file The expiry check's report: what it learned from each source, an
 * outcome, turned into the lines it prints and the code it exits with. An
 * expiry that is due, and each failure to learn one, prints as a GitHub
 * Actions error, which the run's summary shows, and fails the check.
 */

import { type Expiry, ExpiryCheckError } from "./expiry.ts";

/**
 * What the check learned from one source: its expiries, or why it could not.
 */
export type Outcome = ExpiryCheckError | readonly Expiry[];

/** The lines the check prints, and the code it exits with. */
export interface Report {
  readonly exitCode: 0 | 1;
  readonly lines: readonly string[];
}

/** A line of the report, and whether it fails the check. */
interface ReportLine {
  readonly fails: boolean;
  readonly text: string;
}

export function outcomeOf<Value>(
  settled: PromiseSettledResult<Value>,
  toExpiries: (value: Value) => readonly Expiry[],
): Outcome {
  if (settled.status === "rejected") {
    return asExpiryCheckError(settled.reason);
  }
  try {
    return toExpiries(settled.value);
  } catch (error) {
    return asExpiryCheckError(error);
  }
}

export function asExpiryCheckError(error: unknown): ExpiryCheckError {
  if (!(error instanceof ExpiryCheckError)) {
    throw error;
  }
  return error;
}

export function reportOutcomes(
  outcomes: readonly Outcome[],
  now: Date,
): Report {
  const lines = outcomes.flatMap((outcome): ReportLine[] =>
    outcome instanceof ExpiryCheckError
      ? [{ fails: true, text: outcome.message }]
      : outcome.map((expiry) =>
          expiry.isDueAt(now)
            ? {
                fails: true,
                text: `${expiry.describeAt(now)} ${expiry.renewal}`,
              }
            : { fails: false, text: expiry.describeAt(now) },
        ),
  );
  return {
    exitCode: lines.some(({ fails }) => fails) ? 1 : 0,
    lines: lines.map(({ fails, text }) =>
      fails ? `::error::${escapeCommandData(text)}` : text,
    ),
  };
}

// A workflow command ends at its line's end, so its message escapes each line
// break, and the percent sign that starts an escape, as GitHub's toolkit does:
// https://github.com/actions/toolkit/blob/main/packages/core/src/command.ts
function escapeCommandData(text: string): string {
  return text
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}
