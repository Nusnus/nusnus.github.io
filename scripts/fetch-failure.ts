/**
 * @file How a request failed when it failed as the network can: the network
 * failed, or the request's deadline passed. fetch rejects with a TypeError
 * when the network fails, and with the deadline's TimeoutError when it passes:
 * https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch#exceptions
 * Any other error is a bug, and travels on.
 */

/** How a request failed: its network failed, or its deadline passed. */
export type FetchFailure = "network" | "timeout";

export function fetchFailureOf(error: unknown): FetchFailure {
  if (error instanceof TypeError) {
    return "network";
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "timeout";
  }
  throw error;
}
