/**
 * @file The GitHub client: what it sends GitHub; the token's expiry as GitHub
 * reports it; replies parsed into the shape their caller reads, a documented
 * "no content" answer read as the caller's reply for it, and a body that is not
 * JSON refused; GraphQL replies refused when they report errors; failed
 * attempts retried as the request policy decides, after the waits it asks for,
 * and the last failure thrown; an attempt that GitHub leaves unanswered timed
 * out by the deadline at the latest; a request that cannot reach GitHub named;
 * and no request started once the deadline has passed.
 */

import * as schema from "@nusnus/github-data/schema";
import { describe, expect, it } from "vitest";

import type { RestRead } from "../../../src/github/client.ts";

import { RequestPolicy } from "../../../src/github/request-policy.ts";
import {
  failGitHub,
  receivedRequests,
  recorded,
  replayGitHub,
  servedFor,
  testClient,
  useFakeGitHub,
  withExpiringToken,
} from "../../fixtures/github/fake.ts";
import {
  DEADLINE_SPENT_STEP,
  MISSHAPEN_STEP,
  REFUSED_TOKEN_STEP,
  TRANSIENT_STEP,
} from "../../fixtures/next-steps.ts";

useFakeGitHub();

const USER = recorded("rest/users/Nusnus").request;
const USER_READ = {
  nextStepIfNotFound: "Set GITHUB_LOGIN to Tomer's login.",
  pathAndQuery: "/users/Nusnus",
  replySchema: schema.object({ login: schema.string() }),
} as const;
const CONTRIBUTORS_READ: RestRead<{ login: string }[]> = {
  ...USER_READ,
  replyIfNoContent: [],
  replySchema: schema.array(schema.object({ login: schema.string() })),
};
// A server error cannot be recorded on demand, so its reply is written here.
const SERVER_ERROR = { status: 503, headers: {} };

describe("GitHubClient.tokenExpiry", () => {
  it("is the expiry GitHub's latest reply reported, verbatim", async () => {
    replayGitHub(withExpiringToken(recorded("rest/users/Nusnus")));
    const { github } = testClient();

    await github.get(USER_READ);

    expect(github.tokenExpiry).toBe("2023-04-26 23:23:18 +0200");
  });

  it("is null when GitHub's latest reply reported none", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));
    const { github } = testClient();

    await github.get(USER_READ);

    expect(github.tokenExpiry).toBeNull();
  });
});

describe("GitHubClient.get", () => {
  it("sends the token, GitHub's media type, the application's name and the API version", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));

    await testClient().github.get(USER_READ);

    expect(receivedRequests()[0]?.headers).toMatchObject({
      accept: "application/vnd.github+json",
      authorization: "Bearer test-token",
      "user-agent": "@nusnus/worker",
      "x-github-api-version": "2026-03-10",
    });
  });

  it("returns the reply in the shape its schema reads", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));

    await expect(testClient().github.get(USER_READ)).resolves.toStrictEqual({
      login: "Nusnus",
    });
  });

  it("refuses a reply not in the shape its schema reads, naming the request", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));

    await expect(
      testClient().github.get({
        ...USER_READ,
        replySchema: schema.object({ plan: schema.string() }),
      }),
    ).rejects.toThrow(
      expect.objectContaining({
        kind: "misshapen",
        message:
          "GitHub's reply to GET /users/Nusnus is not in the shape the worker reads:\n" +
          "✖ Invalid input: expected string, received undefined\n" +
          "  → at plan\n" +
          MISSHAPEN_STEP,
        name: "GitHubError",
      }),
    );
  });

  it("gives the caller's reply for a documented answer with no content", async () => {
    replayGitHub(
      servedFor(
        recorded("rest/repos/meilix/meilix-docs/contributors.page-1"),
        USER,
      ),
    );

    await expect(
      testClient().github.get(CONTRIBUTORS_READ),
    ).resolves.toStrictEqual([]);
  });

  it("refuses an answer with no content where none is documented", async () => {
    replayGitHub(
      servedFor(
        recorded("rest/repos/meilix/meilix-docs/contributors.page-1"),
        USER,
      ),
    );

    await expect(testClient().github.get(USER_READ)).rejects.toThrow(
      expect.objectContaining({
        kind: "misshapen",
        message:
          "GitHub answered GET /users/Nusnus with 204 and no body\n" +
          MISSHAPEN_STEP,
        name: "GitHubError",
      }),
    );
  });

  it("refuses a body that is not JSON, naming the request", async () => {
    replayGitHub(servedFor(recorded("rest/zen"), USER));

    await expect(testClient().github.get(CONTRIBUTORS_READ)).rejects.toThrow(
      expect.objectContaining({
        kind: "misshapen",
        message:
          "GitHub answered GET /users/Nusnus with 200 and a body that is not JSON: Accessible for all.\n" +
          MISSHAPEN_STEP,
        name: "GitHubError",
      }),
    );
  });

  it("retries a transient failure after the policy's waits, and returns the reply that follows", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));
    failGitHub(USER, SERVER_ERROR, 2);
    const { github, waits } = testClient();

    await expect(github.get(USER_READ)).resolves.toStrictEqual({
      login: "Nusnus",
    });
    expect(waits).toStrictEqual([750, 1500]);
  });

  it("throws the last failure after the policy's last attempt", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));
    failGitHub(USER, SERVER_ERROR);

    await expect(testClient().github.get(USER_READ)).rejects.toThrow(
      expect.objectContaining({
        kind: "transient",
        message: `GitHub answered GET /users/Nusnus with 503: \n${TRANSIENT_STEP}`,
        name: "GitHubError",
      }),
    );
    expect(receivedRequests().length).toBe(3);
  });

  it("retries a rate limit at its reset, when the reset comes before the deadline", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));
    failGitHub(USER, recorded("rest/users/Nusnus.rate-limited"), 1);
    const { github, waits } = testClient({
      startAt: new Date("2026-11-04T08:20:00Z"),
    });

    await github.get(USER_READ);

    expect(waits).toStrictEqual([4000]);
  });

  it("fails a rate limit whose reset comes after the deadline at once, naming the reset", async () => {
    replayGitHub(recorded("rest/users/Nusnus.rate-limited"));

    await expect(testClient().github.get(USER_READ)).rejects.toThrow(
      expect.objectContaining({
        kind: "rate limited",
        message:
          'GitHub answered GET /users/Nusnus with 403: {"message":"API rate limit exceeded for 203.0.113.7. (But here\'s the good news: Authenticated requests get a higher rate limit. Check out the documentation for more details.)","documentation_url":"https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting"}\n' +
          "GitHub allows requests again at 2026-11-04T08:20:04.000Z.",
        name: "GitHubError",
      }),
    );
    expect(receivedRequests().length).toBe(1);
  });

  it("fails a refusal at once", async () => {
    replayGitHub(recorded("rest/users/Nusnus.unauthorized"));

    await expect(testClient().github.get(USER_READ)).rejects.toThrow(
      expect.objectContaining({
        kind: "refused",
        message:
          'GitHub answered GET /users/Nusnus with 401: {"message":"Bad credentials","documentation_url":"https://docs.github.com/rest","status":"401"}\n' +
          REFUSED_TOKEN_STEP,
        name: "GitHubError",
      }),
    );
    expect(receivedRequests().length).toBe(1);
  });

  it("names the caller's next step when GitHub has nothing at the path", async () => {
    replayGitHub(
      servedFor(recorded("rest/repos/celery/no-such-repository"), USER),
    );

    await expect(testClient().github.get(USER_READ)).rejects.toThrow(
      expect.objectContaining({
        kind: "not found",
        message:
          'GitHub answered GET /users/Nusnus with 404: {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}\n' +
          "Set GITHUB_LOGIN to Tomer's login.",
        name: "GitHubError",
      }),
    );
  });

  it("retries a request GitHub leaves unanswered past an attempt's timeout, then names the timeout", async () => {
    failGitHub(USER, "silence");
    const { github, waits } = testClient({
      policy: new RequestPolicy({
        attemptTimeoutMs: 50,
        firstBackoffMs: 1000,
        maxAttempts: 3,
      }),
    });

    await expect(github.get(USER_READ)).rejects.toThrow(
      expect.objectContaining({
        kind: "transient",
        message: `GitHub did not answer GET /users/Nusnus within 50 ms.\n${TRANSIENT_STEP}`,
        name: "GitHubError",
      }),
    );
    expect([receivedRequests().length, waits]).toStrictEqual([3, [750, 1500]]);
  });

  it("shortens an attempt's timeout to the deadline, and retries nothing past it", async () => {
    failGitHub(USER, "silence");

    await expect(
      testClient({ deadlineMs: 100 }).github.get(USER_READ),
    ).rejects.toThrow(
      expect.objectContaining({
        kind: "transient",
        message:
          "GitHub did not answer GET /users/Nusnus within 100 ms.\n" +
          TRANSIENT_STEP,
        name: "GitHubError",
      }),
    );
    expect(receivedRequests().length).toBe(1);
  });

  it("names a request that cannot reach GitHub", async () => {
    failGitHub(USER, "unreachable", 1);

    await expect(
      testClient({ deadlineMs: 1000 }).github.get(USER_READ),
    ).rejects.toThrow(
      expect.objectContaining({
        kind: "transient",
        message:
          "GET /users/Nusnus could not reach GitHub: TypeError: Failed to fetch\n" +
          TRANSIENT_STEP,
        name: "GitHubError",
      }),
    );
  });

  it("sends no request once the fetch's deadline has passed, saying so", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));
    const { advance, github } = testClient({ deadlineMs: 1000 });
    advance(1000);

    await expect(github.get(USER_READ)).rejects.toThrow(
      expect.objectContaining({
        kind: "transient",
        message: `The worker's 1000 ms to fetch from GitHub ran out before GET /users/Nusnus could start.\n${DEADLINE_SPENT_STEP}`,
        name: "GitHubError",
      }),
    );
    expect(receivedRequests()).toStrictEqual([]);
  });

  it("starts no request once the deadline has passed, naming the requests before it", async () => {
    replayGitHub(
      recorded("rest/users/Nusnus"),
      recorded("rest/repos/celery/kombu"),
      recorded("rest/repos/celery/vine"),
    );
    const { advance, github } = testClient({ deadlineMs: 1000 });
    await github.get(USER_READ);
    await github.get({
      ...USER_READ,
      pathAndQuery: "/repos/celery/kombu",
      replySchema: schema.unknown(),
    });
    advance(1000);

    await expect(
      github.get({ ...USER_READ, pathAndQuery: "/repos/celery/vine" }),
    ).rejects.toThrow(
      expect.objectContaining({
        kind: "transient",
        message: `The worker's 1000 ms to fetch from GitHub ran out before GET /repos/celery/vine could start, after GET /users/Nusnus, GET /repos/celery/kombu.\n${DEADLINE_SPENT_STEP}`,
        name: "GitHubError",
      }),
    );
    expect(receivedRequests().map(({ url }) => url)).toStrictEqual([
      "https://api.github.com/users/Nusnus",
      "https://api.github.com/repos/celery/kombu",
    ]);
  });
});

describe("GitHubClient.query", () => {
  const contributions = recorded("graphql/contributions");
  const { query, variables } = contributions.request.body as {
    query: string;
    variables: Record<string, unknown>;
  };

  it("sends the query and its variables, and returns its data in the shape its schema reads", async () => {
    replayGitHub(contributions);

    await expect(
      testClient().github.query(
        query,
        variables,
        schema.object({ user: schema.object({}) }),
      ),
    ).resolves.toStrictEqual({ user: {} });
  });

  it("refuses a reply that is not a GraphQL reply", async () => {
    // A real REST reply, a list, where GitHub's GraphQL API sends an object.
    replayGitHub(
      servedFor(
        recorded("rest/repos/celery/ceps/contributors.page-1"),
        contributions.request,
      ),
    );

    await expect(
      testClient().github.query(query, variables, schema.unknown()),
    ).rejects.toThrow(
      expect.objectContaining({
        kind: "misshapen",
        message:
          "GitHub's reply to POST /graphql is not in the shape the worker reads:\n" +
          "✖ Invalid input: expected object, received array\n" +
          MISSHAPEN_STEP,
        name: "GitHubError",
      }),
    );
  });

  it("refuses data not in the shape its schema reads", async () => {
    replayGitHub(contributions);

    await expect(
      testClient().github.query(
        query,
        variables,
        schema.object({ viewer: schema.string() }),
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        kind: "misshapen",
        message:
          "GitHub's data in its reply to POST /graphql is not in the shape the worker reads:\n" +
          "✖ Invalid input: expected string, received undefined\n" +
          "  → at viewer\n" +
          MISSHAPEN_STEP,
        name: "GitHubError",
      }),
    );
  });

  it("refuses a reply that reports errors, quoting them", async () => {
    replayGitHub(
      servedFor(
        recorded("graphql/errors-of-unknown-users"),
        contributions.request,
      ),
    );

    await expect(
      testClient().github.query(query, variables, schema.unknown()),
    ).rejects.toThrow(
      expect.objectContaining({
        kind: "refused",
        message:
          "GitHub's GraphQL API answered POST /graphql with errors: " +
          "Could not resolve to a User with the login of 'no-such-user-nusnus-worker'.; " +
          "Could not resolve to a User with the login of 'no-such-user-nusnus-worker-2'.\n" +
          "Fix the query, or the login or links it names.",
        name: "GitHubError",
      }),
    );
  });

  it("refuses a body that is not JSON", async () => {
    replayGitHub(servedFor(recorded("rest/zen"), contributions.request));

    await expect(
      testClient().github.query(query, variables, schema.unknown()),
    ).rejects.toThrow(
      expect.objectContaining({
        kind: "misshapen",
        message:
          "GitHub answered POST /graphql with 200 and a body that is not JSON: Accessible for all.\n" +
          MISSHAPEN_STEP,
        name: "GitHubError",
      }),
    );
  });

  it("names GitHub's GraphQL endpoint when GitHub has nothing there", async () => {
    replayGitHub(
      servedFor(
        recorded("rest/repos/celery/no-such-repository"),
        contributions.request,
      ),
    );

    await expect(
      testClient().github.query(query, variables, schema.unknown()),
    ).rejects.toThrow(
      expect.objectContaining({
        kind: "not found",
        message:
          'GitHub answered POST /graphql with 404: {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}\n' +
          "Send the query to GitHub's GraphQL endpoint: https://docs.github.com/en/graphql/guides/forming-calls-with-graphql#the-graphql-endpoint",
        name: "GitHubError",
      }),
    );
  });
});
