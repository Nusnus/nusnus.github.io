/**
 * @file A route store: a value for each worker route, kept as JSON text in a
 * response in the Cloudflare Cache API of the data center serving the request,
 * so every isolate there shares it, for as many days as the store keeps it. A
 * value stored in a shape the worker no longer reads, as one written before a
 * deploy changed the shape is, counts as none, with a warning; any other
 * failure to read one escapes.
 */

import type { WorkerRoute } from "@nusnus/github-data/routes";

import { DAY_MS } from "@nusnus/github-data/calendar";

/**
 * What a route store keeps: the path its keys start with, what its warnings
 * call a value, how many days it keeps each, and how it tells the error of a
 * value stored in a shape the worker no longer reads.
 */
export interface StoredValues {
  readonly keyPrefix: "" | `/${string}`;
  readonly name: string;
  readonly retentionDays: number;
  isOldShape(error: unknown): boolean;
}

/** Keeps a value for each route in the data center's cache. */
export class RouteStore {
  readonly #cache: Cache;
  readonly #values: StoredValues;
  // The Cache API keys each entry by a URL, so a key needs the origin of the
  // worker's requests.
  readonly #workerOrigin: string;

  constructor(cache: Cache, workerOrigin: string, values: StoredValues) {
    this.#cache = cache;
    this.#values = values;
    this.#workerOrigin = workerOrigin;
  }

  async match<Value>(
    route: WorkerRoute<unknown>,
    read: (stored: Response) => Promise<Value>,
  ): Promise<undefined | Value> {
    const stored = await this.#cache.match(this.keyOf(route));
    if (stored === undefined) {
      return undefined;
    }
    try {
      return await read(stored);
    } catch (error) {
      if (!this.#values.isOldShape(error)) {
        throw error;
      }
      console.warn(
        `Ignoring the ${this.#values.name} for ${route.path}, stored in a shape the worker no longer reads.`,
        error,
      );
      return undefined;
    }
  }

  async put(
    route: WorkerRoute<unknown>,
    jsonText: string,
    headers: Readonly<Record<string, string>> = {},
  ): Promise<void> {
    await this.#cache.put(
      this.keyOf(route),
      new Response(jsonText, {
        headers: {
          "Cache-Control": `max-age=${String((this.#values.retentionDays * DAY_MS) / 1000)}`,
          "Content-Type": "application/json",
          ...headers,
        },
      }),
    );
  }

  async delete(route: WorkerRoute<unknown>): Promise<void> {
    await this.#cache.delete(this.keyOf(route));
  }

  keyOf(route: WorkerRoute<unknown>): string {
    return new URL(`${this.#values.keyPrefix}${route.path}`, this.#workerOrigin)
      .href;
  }
}
