/**
 * @file The worker's Wrangler config: the worker's Cloudflare name is the one
 * the contract's worker origin names, so renaming the worker fails here, not
 * at a deploy's wait for the new worker. The worker's own tests run in
 * workerd, which reads no files, so this one runs among the repository's.
 */

import { WORKER_ORIGIN } from "@nusnus/github-data/routes";
import * as schema from "@nusnus/github-data/schema";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const WRANGLER_CONFIG = path.join(
  import.meta.dirname,
  "../../../../packages/worker/wrangler.jsonc",
);

describe("wrangler.jsonc", () => {
  it("names the worker as the contract's worker origin does", () => {
    // TypeScript reads JSON with comments, as its own configs are written.
    const config: unknown = ts.parseConfigFileTextToJson(
      WRANGLER_CONFIG,
      readFileSync(WRANGLER_CONFIG, "utf8"),
    ).config;
    const { name } = schema.parse(
      schema.object({ name: schema.string() }),
      config,
      (issues) => new Error(issues),
    );

    expect(new URL(WORKER_ORIGIN).hostname).toBe(
      `${name}.tomer-nosrati.workers.dev`,
    );
  });
});
