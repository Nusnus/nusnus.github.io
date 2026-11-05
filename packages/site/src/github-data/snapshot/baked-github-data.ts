/**
 * @file The GitHub data the build bakes into the site: a complete snapshot from
 * the worker, the instant it was baked, and the worker's origin, which the
 * browser refreshes from. A Vite plugin serves it to the site's code, in JSON,
 * as the module `BAKED_GITHUB_DATA_MODULE`, which `parseBakedGitHubData` reads.
 * The plugin bakes it once per build from the deployed worker, or from the one
 * the `WORKER_ORIGIN` environment variable names, such as the smoke tests'
 * replay of recorded replies. The build fails, saying what went wrong, unless
 * the worker gives a complete snapshot.
 */

import { WORKER_ORIGIN } from "@nusnus/github-data/routes";

import type { WorkerClient } from "./worker-client.ts";

import {
  type EncodedSnapshot,
  encodeSnapshot,
  type GitHubSnapshot,
  parseSnapshot,
} from "./snapshot.ts";

/** The baked snapshot, when it was baked, and the worker it came from. */
export interface BakedGitHubData {
  readonly bakedAt: Date;
  readonly snapshot: GitHubSnapshot;
  readonly workerOrigin: URL;
}

/** The baked data as the module holds it, in JSON. */
export interface EncodedBakedGitHubData {
  readonly bakedAt: string;
  readonly snapshot: EncodedSnapshot;
  readonly workerOrigin: string;
}

export const BAKED_GITHUB_DATA_MODULE = "virtual:baked-github-data";

// Vite's convention marks a module no file holds with a leading NUL:
// https://vite.dev/guide/api-plugin#virtual-modules-convention
const RESOLVED_MODULE = `\0${BAKED_GITHUB_DATA_MODULE}`;

const WEB_PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:"]);

export function bakedGitHubDataPlugin(worker: WorkerClient, now: () => Date) {
  // The server and client builds each load the module; baking it once gives
  // both the same data, so the islands hydrate from what the HTML shows.
  let source: Promise<string> | undefined;
  return {
    name: "baked-github-data",
    load(id: string): Promise<string> | undefined {
      if (id !== RESOLVED_MODULE) {
        return undefined;
      }
      source ??= bakeGitHubDataModule(worker, now());
      return source;
    },
    resolveId(id: string): string | undefined {
      return id === BAKED_GITHUB_DATA_MODULE ? RESOLVED_MODULE : undefined;
    },
  };
}

export function parseBakedGitHubData(
  encoded: EncodedBakedGitHubData,
): BakedGitHubData {
  return {
    bakedAt: new Date(encoded.bakedAt),
    snapshot: parseSnapshot(encoded.snapshot),
    workerOrigin: new URL(encoded.workerOrigin),
  };
}

export function parseWorkerOrigin(override: string | undefined): URL {
  if (override === undefined) {
    return new URL(WORKER_ORIGIN);
  }
  const origin = URL.parse(override);
  if (
    origin === null ||
    !WEB_PROTOCOLS.has(origin.protocol) ||
    origin.href !== `${origin.origin}/`
  ) {
    throw new Error(
      `WORKER_ORIGIN must be a worker's origin, its scheme, host and port alone, such as ${WORKER_ORIGIN}, got "${override}"; unset it to use the deployed worker.`,
    );
  }
  return origin;
}

async function bakeGitHubDataModule(
  worker: WorkerClient,
  bakedAt: Date,
): Promise<string> {
  const baked: EncodedBakedGitHubData = {
    bakedAt: bakedAt.toISOString(),
    snapshot: encodeSnapshot(await worker.fetchSnapshot()),
    workerOrigin: worker.origin.href,
  };
  return `export default ${JSON.stringify(baked)};\n`;
}
