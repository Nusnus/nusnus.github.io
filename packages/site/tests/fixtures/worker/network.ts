/**
 * @file A fake of the network between the site and the worker, and of the time
 * a worker client keeps. The network answers as the recorded responses do, by
 * default, and fails the paths a test chooses: `workerNotFound` answers with
 * the worker's recorded 404, whatever path it was asked for, and
 * `workerUnavailable` with its recorded 502, sent while GitHub refused it and
 * it had no cached reply. `silentNetwork` never answers, until the request's
 * signal, if it has one, aborts. `testTiming` never times out, waits no real
 * time and records each wait it was asked for.
 */

import { bodyTextOf } from "@nusnus/github-data/fixtures/exchange";
import {
  noSuchRouteExchange,
  profileUnavailableExchange,
} from "@nusnus/github-data/fixtures/worker-replies";
import { vi } from "vitest";

import type { Timing } from "../../../src/github-data/snapshot/worker-client.ts";

import { recordedResponseAt } from "./recorded-responses.ts";

/** How the network fails a path, such as with an error status. */
export type NetworkFailure = () => Promise<Response>;

export const FAKE_WORKER_ORIGIN = new URL("https://worker.example");

export function workerNetwork({
  failing = {},
  replies = {},
}: {
  readonly failing?: Readonly<Record<string, NetworkFailure>>;
  readonly replies?: Readonly<Record<string, unknown>>;
} = {}) {
  return vi.fn((input: RequestInfo | URL) => {
    const { pathname } = new URL(new Request(input).url);
    const failure = failing[pathname];
    if (failure !== undefined) {
      return failure();
    }
    const reply = replies[pathname];
    if (reply !== undefined) {
      return Promise.resolve(Response.json(reply));
    }
    const recorded = recordedResponseAt(pathname);
    return Promise.resolve(new Response(bodyTextOf(recorded), recorded));
  });
}

export const workerNotFound: NetworkFailure = () =>
  Promise.resolve(
    new Response(bodyTextOf(noSuchRouteExchange), noSuchRouteExchange),
  );

export const workerUnavailable: NetworkFailure = () =>
  Promise.resolve(
    new Response(
      bodyTextOf(profileUnavailableExchange),
      profileUnavailableExchange,
    ),
  );

export function silentNetwork(
  _input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const signal = init?.signal;
  return new Promise((_resolve, reject) => {
    signal?.addEventListener("abort", () => {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- fetch rejects with the reason its signal aborted with.
      reject(signal.reason);
    });
  });
}

export function testTiming(now: Date): Timing & {
  readonly waits: number[];
} {
  const waits: number[] = [];
  return {
    waits,
    now: () => now,
    random: () => 0.5,
    timeout: () => new AbortController().signal,
    wait: (ms) => {
      waits.push(ms);
      return Promise.resolve();
    },
  };
}
