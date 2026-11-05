/**
 * @file The recorder: records the exchanges the fake GitHub replays, from
 * GitHub's real API, with the worker's own GitHub client, so each request is
 * the one the worker sends. Run it from `packages/worker` as `GITHUB_TOKEN=$(gh
 * auth token) bun run record [name …]`, naming exchanges as their files under
 * `tests/fixtures/github/` are named, or none to record them all.
 *
 * A REST exchange's name says its request, and its suffix how it is recorded,
 * as the fake GitHub's docstring describes. The contribution graph's GraphQL
 * exchange is what its route source sends, and the activity route's events and
 * title lookup are recorded together from one run of its source, so the lookup
 * asks for the events' titles; any other GraphQL exchange sends its recorded
 * request again. The token is sent to GitHub and never recorded. A refusal
 * GitHub sends is recorded; any other failure stops the recorder.
 *
 * Then `bun run update:worker-replies`, from the repository's root, rewrites
 * the contract's worker replies from the new exchanges.
 */

import {
  type Exchange,
  type ExchangeRequest,
  recordedRequest,
  recordedResponse,
} from "@nusnus/github-data/fixtures/exchange";
import { fullNameSchema } from "@nusnus/github-data/formats";
import { GITHUB_API_ORIGIN } from "@nusnus/github-data/github-links";
import * as schema from "@nusnus/github-data/schema";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

import { GitHubClient } from "../src/github/client.ts";
import { GitHubError } from "../src/github/failures.ts";
import { RequestPolicy } from "../src/github/request-policy.ts";
import { activitySource } from "../src/routes/activity/source.ts";
import { contributionGraphSource } from "../src/routes/contribution-graph.ts";
import { contributorsPage } from "../src/routes/repositories.ts";
import { UNAUTHENTICATED_LIMIT, writeExchangeFile } from "./recording.ts";

const EXCHANGES_FOLDER = path.join(
  import.meta.dirname,
  "../tests/fixtures/github",
);

const ACTIVITY_EXCHANGES = [
  "rest/users/Nusnus/events/public",
  "graphql/titles-of-user-events",
] as const;

const CONTRIBUTIONS_EXCHANGE = "graphql/contributions";

const CONTRIBUTORS_PAGE_NAME =
  /^rest\/repos\/(?<fullName>[^/]+\/[^/]+)\/contributors\.page-(?<page>\d+)$/;

const token = process.env["GITHUB_TOKEN"];
if (token === undefined || token === "") {
  throw new Error(
    "The recorder needs a GitHub token in GITHUB_TOKEN; run it as GITHUB_TOKEN=$(gh auth token) bun run record.",
  );
}

/** A suffix of an exchange's name that says how the recorder records it. */
type Suffix = "invalid" | "rate-limited" | "unauthorized";

// A request GitHub refuses as invalid is sent with the token; a refused
// token's, with a token GitHub does not know; and a rate limit's, with none,
// until GitHub refuses it.
const SUFFIX_RECORDERS: Readonly<
  Record<Suffix, (request: ExchangeRequest) => Promise<Exchange | undefined>>
> = {
  "rate-limited": rateLimitedExchange,
  invalid: (request) => firstExchange(token, request),
  unauthorized: (request) => firstExchange("not-a-github-token", request),
};

const REST_NAME = new RegExp(
  `^rest(?<resource>/.+?)(?:\\.(?<suffix>${Object.keys(SUFFIX_RECORDERS).join("|")}))?$`,
);

const names = process.argv.slice(2);
for (const name of names.length > 0 ? names : recordedNames()) {
  if ((ACTIVITY_EXCHANGES as readonly string[]).includes(name)) {
    const [events, titles] = await exchangesOf(token, (github) =>
      activitySource.fetchData(github),
    );
    await write(ACTIVITY_EXCHANGES[0], events);
    await write(ACTIVITY_EXCHANGES[1], titles);
  } else if (name === CONTRIBUTIONS_EXCHANGE) {
    const [contributions] = await exchangesOf(token, (github) =>
      contributionGraphSource.fetchData(github),
    );
    await write(name, contributions);
  } else {
    const { request, suffix } = requestOf(name);
    await write(
      name,
      await (suffix === undefined
        ? firstExchange(token, request)
        : SUFFIX_RECORDERS[suffix](request)),
    );
  }
}

function recordedNames(): string[] {
  return (
    ["rest", "graphql"]
      .flatMap((kind) =>
        readdirSync(path.join(EXCHANGES_FOLDER, kind), {
          encoding: "utf8",
          recursive: true,
        })
          .filter((file) => file.endsWith(".json"))
          .map((file) => `${kind}/${file.replace(/\.json$/, "")}`),
      )
      // Recording the activity route's events records its title lookup too.
      .filter((name) => name !== ACTIVITY_EXCHANGES[1])
  );
}

function requestOf(name: string): {
  readonly request: ExchangeRequest;
  readonly suffix?: Suffix;
} {
  if (name.startsWith("graphql/")) {
    return { request: readExchange(name).request };
  }
  const page = CONTRIBUTORS_PAGE_NAME.exec(name)?.groups;
  if (page !== undefined) {
    return {
      request: restRequest(
        contributorsPage(
          schema.parse(
            fullNameSchema,
            page["fullName"],
            (issues) => new Error(`${name} names no repository:\n${issues}`),
          ),
          Number(page["page"]),
        ),
      ),
    };
  }
  const rest = REST_NAME.exec(name)?.groups;
  const resource = rest?.["resource"];
  if (resource === undefined) {
    throw new Error(
      `${name} names no exchange: name a REST exchange as rest/<path>, with an optional suffix .${Object.keys(SUFFIX_RECORDERS).join(", .")}, a page of a repository's contributors as rest/repos/<owner>/<name>/contributors.page-<n>, or a GraphQL exchange as its file in ${path.join(EXCHANGES_FOLDER, "graphql")} is named.`,
    );
  }
  return {
    request: restRequest(resource),
    // The pattern takes no other suffix than the table's.
    ...(rest?.["suffix"] === undefined
      ? {}
      : { suffix: rest["suffix"] as Suffix }),
  };
}

function restRequest(pathAndQuery: string): ExchangeRequest {
  return { method: "GET", url: `${GITHUB_API_ORIGIN}${pathAndQuery}` };
}

async function exchangesOf(
  withToken: string | undefined,
  run: (github: GitHubClient) => Promise<unknown>,
): Promise<Exchange[]> {
  const exchanges: Exchange[] = [];
  const github = new GitHubClient({
    deadlineMs: 60_000,
    // One attempt each, so each exchange is GitHub's first answer.
    policy: new RequestPolicy({
      ...RequestPolicy.DEFAULT.limits,
      maxAttempts: 1,
    }),
    random: Math.random,
    token: withToken ?? "",
    async fetch(input, init) {
      const request = new Request(input, init);
      // The worker's client always sends a token, so the one it sends when
      // the recorder has none is taken off.
      if (withToken === undefined) {
        request.headers.delete("Authorization");
      }
      const recorded = recordedRequest(request, await request.clone().text());
      const response = await fetch(request);
      exchanges.push({
        request: recorded,
        ...recordedResponse(response, await response.clone().text()),
      });
      return response;
    },
    now: () => new Date(),
    wait: (ms) => setTimeout(ms),
  });
  try {
    await run(github);
  } catch (error) {
    // A refusal is what some exchanges record; the exchange holds it.
    if (!(error instanceof GitHubError)) {
      throw error;
    }
    console.warn(error.message);
  }
  return exchanges;
}

async function firstExchange(
  withToken: string | undefined,
  request: ExchangeRequest,
): Promise<Exchange | undefined> {
  const [exchange] = await exchangesOf(withToken, (github) =>
    send(github, request),
  );
  return exchange;
}

async function send(
  github: GitHubClient,
  { body, url }: ExchangeRequest,
): Promise<unknown> {
  if (body === undefined) {
    const { pathname, search } = new URL(url);
    return github.get({
      nextStepIfNotFound: "",
      pathAndQuery: `/${pathname.slice(1)}${search}`,
      replyIfNoContent: null,
      replySchema: schema.unknown(),
    });
  }
  const { query, variables } = body as {
    query: string;
    variables: Record<string, unknown>;
  };
  return github.query(query, variables, schema.unknown());
}

async function rateLimitedExchange(
  request: ExchangeRequest,
): Promise<Exchange> {
  // The limit's last request still succeeds, so the refusal is one past it.
  for (let attempt = 1; attempt <= UNAUTHENTICATED_LIMIT + 1; attempt += 1) {
    const exchange = await firstExchange(undefined, request);
    if (exchange !== undefined && exchange.status !== 200) {
      return exchange;
    }
  }
  throw new Error(
    `GitHub answered ${String(UNAUTHENTICATED_LIMIT + 1)} requests with no token without refusing one; check its limit at the link beside UNAUTHENTICATED_LIMIT.`,
  );
}

function readExchange(name: string): Exchange {
  return JSON.parse(
    readFileSync(path.join(EXCHANGES_FOLDER, `${name}.json`), "utf8"),
  ) as Exchange;
}

async function write(
  name: string,
  exchange: Exchange | undefined,
): Promise<void> {
  if (exchange === undefined) {
    throw new Error(`Recording ${name} sent GitHub no request.`);
  }
  await writeExchangeFile(
    path.join(EXCHANGES_FOLDER, `${name}.json`),
    exchange,
  );
  console.log(
    `${name}: ${exchange.request.method} ${exchange.request.url} → ${String(exchange.status)}`,
  );
}
