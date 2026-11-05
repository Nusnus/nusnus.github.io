/**
 * @file The backoffs: each route's backoff, kept in a route store beside the
 * route's cached reply, so every isolate in the data center backs off
 * together. A route's backoff is kept after its last failure for longer than
 * its longest wait, so failures in a row keep counting.
 */

import type { WorkerRoute } from "@nusnus/github-data/routes";

import { instantSchema } from "@nusnus/github-data/formats";
import * as schema from "@nusnus/github-data/schema";

import { RouteStore } from "../route-store.ts";
import { Backoff } from "./backoff.ts";

/** A backoff that breaks the shape the worker stores backoffs in. */
class BackoffShapeError extends Error {
  override name = "BackoffShapeError";
}

/** Keeps each route's backoff in the data center's cache. */
export class Backoffs {
  static readonly #RECORD_SCHEMA = schema.strictObject({
    failures: schema.int().check(schema.positive()),
    notBefore: instantSchema,
    reason: schema.string(),
  });

  readonly #store: RouteStore;

  constructor(cache: Cache, workerOrigin: string) {
    this.#store = new RouteStore(cache, workerOrigin, {
      keyPrefix: "/backoff",
      name: "backoff",
      retentionDays: 1,
      isOldShape: (error) => error instanceof BackoffShapeError,
    });
  }

  async match(route: WorkerRoute<unknown>): Promise<Backoff | undefined> {
    return this.#store.match(route, async (stored) => {
      const { failures, notBefore, reason } = schema.parse(
        Backoffs.#RECORD_SCHEMA,
        await stored.json(),
        shapeError(route),
      );
      return new Backoff(failures, notBefore, reason);
    });
  }

  async put(route: WorkerRoute<unknown>, backoff: Backoff): Promise<void> {
    await this.#store.put(
      route,
      JSON.stringify(
        schema.encode(Backoffs.#RECORD_SCHEMA, backoff, shapeError(route)),
      ),
    );
  }

  async delete(route: WorkerRoute<unknown>): Promise<void> {
    await this.#store.delete(route);
  }
}

function shapeError(
  route: WorkerRoute<unknown>,
): (issues: string) => BackoffShapeError {
  return (issues) =>
    new BackoffShapeError(
      `The worker's backoff for ${route.path} breaks the shape the worker stores backoffs in:\n${issues}\n` +
        "Fix how the worker builds, stores or reads backoffs.",
    );
}
