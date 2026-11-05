/**
 * @file GitHub's API as the worker calls it: REST reads and GraphQL queries,
 * sent with the worker's token under the pinned API version, each reply parsed
 * into the shape its caller reads, and the token's expiry as GitHub reports it.
 *
 * A client serves one fetch of a route's data: every request it sends shares
 * the client's deadline, each attempt has a timeout, and the request policy
 * decides whether a failed attempt is retried. The client reads the time, waits
 * and draws random numbers only through what it is given, but for each
 * attempt's timeout, which the runtime's own timer ends. Every failure is a
 * `GitHubError` naming the request. The runtime's fetch, called as a client
 * calls it, is here too.
 */

import { ACCESS_HEADERS } from "@nusnus/github-data/access-headers";
import { GITHUB_API_ORIGIN } from "@nusnus/github-data/github-links";
import * as schema from "@nusnus/github-data/schema";

import type { RequestPolicy } from "./request-policy.ts";

import project from "../../package.json" with { type: "json" };
import { GITHUB_API_VERSION } from "./api-version.ts";
import {
  failureOf,
  GitHubError,
  parseGitHubData,
  parseJsonBody,
} from "./failures.ts";

/**
 * What a GitHub client runs on: the worker's token, how long its fetch may
 * take, the request policy, and the clock, the wait, the random source and the
 * `fetch` it uses.
 */
export interface GitHubClientDependencies {
  readonly deadlineMs: number;
  readonly fetch: typeof fetch;
  readonly policy: RequestPolicy;
  readonly token: string;
  readonly now: () => Date;
  readonly random: () => number;
  readonly wait: (ms: number) => Promise<void>;
}

/**
 * A REST read: the path and query to GET, the schema of GitHub's reply, the
 * next step when GitHub has nothing there, and the reply that GitHub's
 * documented "no content" answer stands for, where it documents one.
 */
export interface RestRead<Reply> {
  readonly nextStepIfNotFound: string;
  readonly pathAndQuery: `/${string}`;
  readonly replyIfNoContent?: Reply;
  readonly replySchema: schema.Schema<Reply>;
}

/**
 * A request the client sends GitHub: its method, its path and query, any
 * body, and the next step when GitHub has nothing there.
 */
interface GitHubRequest {
  readonly body?: string;
  readonly method: "GET" | "POST";
  readonly nextStepIfNotFound: string;
  readonly pathAndQuery: `/${string}`;
}

/** What GitHub sent back for a request that succeeded. */
interface SuccessfulResponse {
  readonly body: string;
  readonly status: number;
}

// The runtime's fetch, which refuses to run as another object's method:
// https://developers.cloudflare.com/workers/observability/errors/#illegal-invocation-errors
export const runtimeFetch: typeof fetch = (input, init) => fetch(input, init);

/** Sends one fetch's requests to GitHub's API, within the fetch's deadline. */
export class GitHubClient {
  static readonly #GRAPHQL_REPLY_SCHEMA = schema.object({
    data: schema.unknown(),
    errors: schema.optional(
      schema.array(schema.object({ message: schema.string() })),
    ),
  });

  readonly #deadlineAt: Date;
  readonly #dependencies: GitHubClientDependencies;
  readonly #headers: Readonly<Record<string, string>>;
  readonly #requestLinesSent = new Set<string>();

  #tokenExpiry: null | string = null;

  get tokenExpiry(): null | string {
    return this.#tokenExpiry;
  }

  constructor(dependencies: GitHubClientDependencies) {
    this.#dependencies = dependencies;
    this.#deadlineAt = new Date(
      dependencies.now().getTime() + dependencies.deadlineMs,
    );
    this.#headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${dependencies.token}`,
      // GitHub refuses requests without a User-Agent naming the application,
      // here the worker's package:
      // https://docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api#user-agent
      "User-Agent": project.name,
      [ACCESS_HEADERS.apiVersion]: GITHUB_API_VERSION,
    };
  }

  async get<Reply>({
    nextStepIfNotFound,
    pathAndQuery,
    replyIfNoContent,
    replySchema,
  }: RestRead<Reply>): Promise<Reply> {
    const request = {
      method: "GET",
      nextStepIfNotFound,
      pathAndQuery,
    } as const;
    const requestLine = requestLineOf(request);
    const { body, status } = await this.#send(request);
    // GitHub documents a 204 for some reads, such as an empty repository's
    // contributors: https://docs.github.com/en/rest/repos/repos#list-repository-contributors
    if (status === 204 && replyIfNoContent !== undefined) {
      return replyIfNoContent;
    }
    return parseGitHubData(
      `reply to ${requestLine}`,
      replySchema,
      parseJsonBody(requestLine, status, body),
    );
  }

  // A GraphQL reply can hold errors beside data, and the worker refuses one
  // that holds any: https://spec.graphql.org/October2021/#sec-Response-Format
  async query<Data>(
    query: string,
    variables: Readonly<Record<string, unknown>>,
    dataSchema: schema.Schema<Data>,
  ): Promise<Data> {
    const request = {
      body: JSON.stringify({ query, variables }),
      method: "POST",
      nextStepIfNotFound:
        "Send the query to GitHub's GraphQL endpoint: https://docs.github.com/en/graphql/guides/forming-calls-with-graphql#the-graphql-endpoint",
      pathAndQuery: "/graphql",
    } as const;
    const requestLine = requestLineOf(request);
    const { body, status } = await this.#send(request);
    const reply = parseGitHubData(
      `reply to ${requestLine}`,
      GitHubClient.#GRAPHQL_REPLY_SCHEMA,
      parseJsonBody(requestLine, status, body),
    );
    if (reply.errors !== undefined) {
      throw GitHubError.refused(
        `GitHub's GraphQL API answered ${requestLine} with errors: ${reply.errors.map(({ message }) => message).join("; ")}`,
        "Fix the query, or the login or links it names.",
      );
    }
    return parseGitHubData(
      `data in its reply to ${requestLine}`,
      dataSchema,
      reply.data,
    );
  }

  async #send(request: GitHubRequest): Promise<SuccessfulResponse> {
    const { now, policy, random, wait } = this.#dependencies;
    for (let attempt = 1; ; attempt += 1) {
      const outcome = await this.#attempt(request);
      if (!(outcome instanceof GitHubError)) {
        return outcome;
      }
      const waitMs = policy.waitBeforeRetry(
        attempt,
        outcome,
        now(),
        this.#deadlineAt,
        random,
      );
      if (waitMs === undefined) {
        throw outcome;
      }
      await wait(waitMs);
    }
  }

  async #attempt(
    request: GitHubRequest,
  ): Promise<GitHubError | SuccessfulResponse> {
    const { deadlineMs, fetch, now, policy } = this.#dependencies;
    const requestLine = requestLineOf(request);
    const timeoutMs = policy.attemptTimeoutMs(now(), this.#deadlineAt);
    if (timeoutMs === undefined) {
      return GitHubError.deadlineSpent(
        `The worker's ${String(deadlineMs)} ms to fetch from GitHub ran out before ${requestLine} could start` +
          (this.#requestLinesSent.size === 0
            ? "."
            : `, after ${[...this.#requestLinesSent].join(", ")}.`),
      );
    }
    this.#requestLinesSent.add(requestLine);
    const signal = AbortSignal.timeout(timeoutMs);
    let response: Response;
    let body: string;
    try {
      response = await fetch(`${GITHUB_API_ORIGIN}${request.pathAndQuery}`, {
        body: request.body ?? null,
        headers: this.#headers,
        method: request.method,
        signal,
      });
      body = await response.text();
    } catch (error) {
      // Any rejection means no reply arrived: the attempt timed out, or the
      // request never reached GitHub.
      return GitHubError.transient(
        signal.aborted
          ? `GitHub did not answer ${requestLine} within ${String(timeoutMs)} ms.`
          : `${requestLine} could not reach GitHub: ${String(error)}`,
      );
    }
    if (!response.ok) {
      return failureOf(
        requestLine,
        { body, headers: response.headers, status: response.status },
        now(),
        request.nextStepIfNotFound,
      );
    }
    this.#tokenExpiry = response.headers.get(ACCESS_HEADERS.tokenExpiry);
    return { body, status: response.status };
  }
}

function requestLineOf({ method, pathAndQuery }: GitHubRequest): string {
  return `${method} ${pathAndQuery}`;
}
