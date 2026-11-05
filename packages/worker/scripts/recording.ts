/**
 * @file What every recorder shares: GitHub's rate limit for a caller with no
 * token, which the recorders spend to record a refusal; and an exchange's
 * file, as each writes it, JSON in the form `format:check` holds, written
 * whole. A recorder stopped part way leaves each exchange as it was or as it
 * is now, never half of one, though it may leave the `.part` file it was
 * writing, which git ignores. The worker's recorder and the services'
 * recorder at the repository's root both build on it.
 */

import type { Exchange } from "@nusnus/github-data/fixtures/exchange";

import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { format, resolveConfig } from "prettier";

// GitHub's limit for a caller without a token is 60 requests an hour:
// https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#primary-rate-limit-for-unauthenticated-users
export const UNAUTHENTICATED_LIMIT = 60;

export async function writeExchangeFile(
  file: string,
  exchange: Exchange,
): Promise<void> {
  mkdirSync(path.dirname(file), { recursive: true });
  // Only a run stopped between the write and the rename tells a file written
  // beside its target from one written over it, and no test stops one there.
  // Stryker disable next-line StringLiteral
  const partFile = `${file}.part`;
  writeFileSync(
    partFile,
    // Prettier keeps the objects JSON.stringify breaks onto lines, and joins
    // each array that fits on one, as format:check holds the file.
    await format(JSON.stringify(exchange, null, 2), {
      ...(await resolveConfig(file)),
      filepath: file,
    }),
  );
  // A rename within one folder replaces the file whole.
  renameSync(partFile, file);
}
