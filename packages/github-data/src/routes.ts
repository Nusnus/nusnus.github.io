/**
 * @file The worker's routes: where the worker is deployed, the header that
 * names the version of the worker that sent each response, how long the
 * worker may spend fetching a route's data, the body of its errors, and the
 * path of each kind of GitHub data and the reply it serves, which the worker
 * encodes to JSON and the site parses on receipt, each refusing a reply that
 * breaks the contract, so the two cannot drift apart unseen. A reply the
 * worker builds that breaks the contract is a fault in how the worker builds
 * it; one the site receives that breaks it comes from a worker deployed from
 * another commit.
 */

import { activitySchema } from "./activity.ts";
import { contributionGraphSchema } from "./contribution-graph.ts";
import { instantSchema } from "./formats.ts";
import { profileSchema } from "./profile.ts";
import { repositoriesSchema } from "./repositories.ts";
import * as schema from "./schema.ts";

/**
 * A worker reply: GitHub data and the instant the worker fetched it from
 * GitHub, which the site shows as when its data was updated.
 */
export type WorkerReply<Data> = schema.Infer<
  ReturnType<typeof workerReplySchema<Data>>
>;

export type EncodedWorkerReply = schema.Encoded<
  ReturnType<typeof workerReplySchema<unknown>>
>;

/** A reply that does not hold its route's contract. */
export class WorkerReplyError extends Error {
  override name = "WorkerReplyError";
}

/**
 * A worker route: its path, which `urlAt` places at a worker's origin, and the
 * reply it serves, which `parseReply` reads from JSON and `encodeReply` writes
 * to JSON, each refusing a reply that breaks the contract with a
 * `WorkerReplyError` naming each way it does, and what to do about it.
 */
export class WorkerRoute<Data> {
  readonly path: `/${string}`;
  readonly #replySchema: ReturnType<typeof workerReplySchema<Data>>;

  constructor(path: `/${string}`, dataSchema: schema.Schema<Data>) {
    this.path = path;
    this.#replySchema = workerReplySchema(dataSchema);
  }

  urlAt(origin: string | URL): URL {
    return new URL(this.path, origin);
  }

  parseReply(json: unknown): WorkerReply<Data> {
    return schema.parse(
      this.#replySchema,
      json,
      (issues) =>
        new WorkerReplyError(
          `The worker's ${this.path} reply breaks the github-data contract:\n${issues}\n` +
            "Deploy the worker and the site from the same commit.",
        ),
    );
  }

  encodeReply(reply: WorkerReply<Data>): EncodedWorkerReply {
    return schema.encode(
      this.#replySchema,
      reply,
      (issues) =>
        new WorkerReplyError(
          `The worker built a ${this.path} reply that breaks the github-data contract:\n${issues}\n` +
            `Fix how the worker's route source for ${this.path} builds it.`,
        ),
    );
  }
}

// The deployed worker's Cloudflare name, which wrangler.jsonc sets, on the
// workers.dev subdomain of the account that deploys it.
export const WORKER_ORIGIN = "https://ai-proxy.tomer-nosrati.workers.dev";

// Cloudflare's id of the worker version that sent a response, which
// `wrangler deploy` reports for the version it deploys.
export const WORKER_VERSION_HEADER = "Worker-Version";

// The longest the worker spends fetching a route's data from GitHub, and so
// about the longest a client waits for a route the worker holds no reply of.
// It leaves five seconds of the worker's background limit,
// `RouteServer.BACKGROUND_LIMIT_MS`, to store what it fetched.
export const WORKER_FETCH_DEADLINE_MS = 25_000;

export const workerErrorSchema = schema.readonly(
  schema.strictObject({ error: schema.string() }),
);

/**
 * The body of each error the worker answers with: what went wrong and what to
 * do about it.
 */
export type WorkerError = schema.Infer<typeof workerErrorSchema>;

export const WORKER_ROUTES = {
  activity: new WorkerRoute("/activity", activitySchema),
  contributionGraph: new WorkerRoute(
    "/contribution-graph",
    contributionGraphSchema,
  ),
  profile: new WorkerRoute("/profile", profileSchema),
  repositories: new WorkerRoute("/repositories", repositoriesSchema),
} as const;

export type WorkerRouteName = keyof typeof WORKER_ROUTES;

export type WorkerRouteData<Name extends WorkerRouteName> =
  (typeof WORKER_ROUTES)[Name] extends WorkerRoute<infer Data> ? Data : never;

function workerReplySchema<Data>(dataSchema: schema.Schema<Data>) {
  return schema.readonly(
    schema.strictObject({ data: dataSchema, fetchedAt: instantSchema }),
  );
}
