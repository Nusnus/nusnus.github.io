/**
 * @file GitHub's failures: data in the shape the worker reads, or a misshapen
 * failure naming what broke; a body read as JSON, or a misshapen failure for a
 * body that is not; and each failed reply classified, as a transient server
 * error, a rate limit that names when GitHub allows requests again, from
 * `Retry-After`, the limit's reset or a minute on, a refused token, a path
 * GitHub does not have, or another refusal, each with its next step, and a
 * malformed header a misshapen failure.
 */

import type { Exchange } from "@nusnus/github-data/fixtures/exchange";

import * as schema from "@nusnus/github-data/schema";
import { describe, expect, it } from "vitest";

import {
  type FailedResponse,
  failureOf,
  parseGitHubData,
  parseJsonBody,
} from "../../../src/github/failures.ts";
import { recorded } from "../../fixtures/github/fake.ts";
import {
  MISSHAPEN_STEP,
  REFUSED_REQUEST_STEP,
  REFUSED_TOKEN_STEP,
  TRANSIENT_STEP,
} from "../../fixtures/next-steps.ts";

const RECEIVED_AT = new Date("2026-11-04T07:20:05Z");

const RATE_LIMITED = recorded("rest/users/Nusnus.rate-limited");
const RATE_LIMITED_BODY =
  '{"message":"API rate limit exceeded for 203.0.113.7. (But here\'s the good news: Authenticated requests get a higher rate limit. Check out the documentation for more details.)","documentation_url":"https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting"}';

function failedResponse({
  body,
  headers,
  status,
}: Pick<Exchange, "body" | "headers" | "status">): FailedResponse {
  return {
    body: JSON.stringify(body),
    headers: new Headers(headers),
    status,
  };
}

// GitHub's rate-limited reply, with the headers GitHub sends a client past
// its secondary limit: Retry-After, and requests left in the primary one. A
// secondary limit cannot be recorded on demand, since GitHub applies it for
// reasons it does not disclose:
// https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#about-secondary-rate-limits
function secondaryLimit(status: number, retryAfter?: string): FailedResponse {
  return failedResponse({
    body: RATE_LIMITED.body,
    headers: {
      ...RATE_LIMITED.headers,
      "x-ratelimit-remaining": "59",
      ...(retryAfter === undefined ? {} : { "retry-after": retryAfter }),
    },
    status,
  });
}

function failure(response: FailedResponse): unknown {
  const error = failureOf(
    "GET /users/Nusnus",
    response,
    RECEIVED_AT,
    "Set GITHUB_LOGIN to Tomer's login.",
  );
  return {
    kind: error.kind,
    message: error.message,
    name: error.name,
    retryAt: error.retryAt,
  };
}

describe("parseGitHubData", () => {
  const loginSchema = schema.object({ login: schema.string() });

  it("returns GitHub's data in the shape its schema reads", () => {
    expect(
      parseGitHubData(
        "reply to GET /users/Nusnus",
        loginSchema,
        recorded("rest/users/Nusnus").body,
      ),
    ).toStrictEqual({ login: "Nusnus" });
  });

  it("refuses data not in the shape its schema reads, naming it", () => {
    expect(() =>
      parseGitHubData("reply to GET /users/Nusnus", loginSchema, {}),
    ).toThrow(
      expect.objectContaining({
        kind: "misshapen",
        message:
          "GitHub's reply to GET /users/Nusnus is not in the shape the worker reads:\n" +
          "✖ Invalid input: expected string, received undefined\n  → at login\n" +
          MISSHAPEN_STEP,
        name: "GitHubError",
      }),
    );
  });
});

describe("parseJsonBody", () => {
  it("reads a body as JSON", () => {
    expect(parseJsonBody("GET /zen", 200, '{"login":"Nusnus"}')).toStrictEqual({
      login: "Nusnus",
    });
  });

  it.each([
    ["", "GitHub answered GET /zen with 200 and no body\n" + MISSHAPEN_STEP],
    [
      recorded("rest/zen").body,
      "GitHub answered GET /zen with 200 and a body that is not JSON: Accessible for all.\n" +
        MISSHAPEN_STEP,
    ],
  ])("refuses the body %j, which is not JSON", (body, message) => {
    expect(() => parseJsonBody("GET /zen", 200, String(body))).toThrow(
      expect.objectContaining({
        kind: "misshapen",
        message,
        name: "GitHubError",
      }),
    );
  });
});

describe("failureOf", () => {
  // GitHub's server errors cannot be recorded on demand, so these bodies are
  // empty.
  it.each([
    [500, `GitHub answered GET /users/Nusnus with 500: \n${TRANSIENT_STEP}`],
    [502, `GitHub answered GET /users/Nusnus with 502: \n${TRANSIENT_STEP}`],
    [503, `GitHub answered GET /users/Nusnus with 503: \n${TRANSIENT_STEP}`],
    [504, `GitHub answered GET /users/Nusnus with 504: \n${TRANSIENT_STEP}`],
  ])(
    "finds a %i, a server error of GitHub's own, a transient failure",
    (status, message) => {
      expect(
        failure({ body: "", headers: new Headers(), status }),
      ).toStrictEqual({
        kind: "transient",
        message,
        name: "GitHubError",
        retryAt: undefined,
      });
    },
  );

  it("takes the wait a server error's Retry-After asks for", () => {
    expect(
      failure({
        body: "",
        headers: new Headers({ "Retry-After": "30" }),
        status: 503,
      }),
    ).toStrictEqual({
      kind: "transient",
      message: `GitHub answered GET /users/Nusnus with 503: \n${TRANSIENT_STEP}`,
      name: "GitHubError",
      retryAt: new Date("2026-11-04T07:20:35Z"),
    });
  });

  it("finds a primary rate limit, until its reset", () => {
    expect(failure(failedResponse(RATE_LIMITED))).toStrictEqual({
      kind: "rate limited",
      message:
        `GitHub answered GET /users/Nusnus with 403: ${RATE_LIMITED_BODY}\n` +
        "GitHub allows requests again at 2026-11-04T08:20:04.000Z.",
      name: "GitHubError",
      retryAt: new Date("2026-11-04T08:20:04Z"),
    });
  });

  it.each([
    {
      message:
        `GitHub answered GET /users/Nusnus with 403: ${RATE_LIMITED_BODY}\n` +
        "GitHub allows requests again at 2026-11-04T07:20:06.000Z.",
      retryAfter: "1",
      retryAt: new Date("2026-11-04T07:20:06Z"),
      status: 403,
    },
    {
      message:
        `GitHub answered GET /users/Nusnus with 429: ${RATE_LIMITED_BODY}\n` +
        "GitHub allows requests again at 2026-11-04T07:20:06.000Z.",
      retryAfter: "1",
      retryAt: new Date("2026-11-04T07:20:06Z"),
      status: 429,
    },
    {
      message:
        `GitHub answered GET /users/Nusnus with 403: ${RATE_LIMITED_BODY}\n` +
        "GitHub allows requests again at 2026-11-04T07:21:00.000Z.",
      retryAfter: "Wed, 04 Nov 2026 07:21:00 GMT",
      retryAt: new Date("2026-11-04T07:21:00Z"),
      status: 403,
    },
  ])(
    "finds a $status with Retry-After: $retryAfter a rate limit until then",
    ({ message, retryAfter, retryAt, status }) => {
      expect(failure(secondaryLimit(status, retryAfter))).toStrictEqual({
        kind: "rate limited",
        message,
        name: "GitHubError",
        retryAt,
      });
    },
  );

  it("finds a 429 without either header a rate limit for a minute, whatever its message", () => {
    // GitHub answers 429 only past a rate limit, which no token the recorder
    // holds reaches on demand without either header; the refused token's
    // recorded message stands in, under 429.
    const unauthorized = recorded("rest/users/Nusnus.unauthorized");

    expect(
      failure(failedResponse({ ...unauthorized, status: 429 })),
    ).toStrictEqual({
      kind: "rate limited",
      message:
        'GitHub answered GET /users/Nusnus with 429: {"message":"Bad credentials","documentation_url":"https://docs.github.com/rest","status":"401"}\n' +
        "GitHub allows requests again at 2026-11-04T07:21:05.000Z.",
      name: "GitHubError",
      retryAt: new Date("2026-11-04T07:21:05Z"),
    });
  });

  it("finds a 403 without either header, whose message names a rate limit, a rate limit for a minute", () => {
    expect(failure(secondaryLimit(403))).toStrictEqual({
      kind: "rate limited",
      message:
        `GitHub answered GET /users/Nusnus with 403: ${RATE_LIMITED_BODY}\n` +
        "GitHub allows requests again at 2026-11-04T07:21:05.000Z.",
      name: "GitHubError",
      retryAt: new Date("2026-11-04T07:21:05Z"),
    });
  });

  it("finds a 403 without either header, whose message names no rate limit, a refusal", () => {
    // GitHub answers 403 for access the token lacks, which no token the
    // recorder holds is refused, since each reads all public data; the
    // refused token's recorded message stands in.
    const unauthorized = recorded("rest/users/Nusnus.unauthorized");

    expect(
      failure(failedResponse({ ...unauthorized, status: 403 })),
    ).toStrictEqual({
      kind: "refused",
      message:
        'GitHub answered GET /users/Nusnus with 403: {"message":"Bad credentials","documentation_url":"https://docs.github.com/rest","status":"401"}\n' +
        REFUSED_REQUEST_STEP,
      name: "GitHubError",
      retryAt: undefined,
    });
  });

  it.each([
    [
      "soon",
      "GitHub's Retry-After header for GET /users/Nusnus is neither seconds nor an IMF-fixdate: soon\n" +
        MISSHAPEN_STEP,
    ],
    [
      "30s",
      "GitHub's Retry-After header for GET /users/Nusnus is neither seconds nor an IMF-fixdate: 30s\n" +
        MISSHAPEN_STEP,
    ],
    [
      "in 30",
      "GitHub's Retry-After header for GET /users/Nusnus is neither seconds nor an IMF-fixdate: in 30\n" +
        MISSHAPEN_STEP,
    ],
    [
      "2.5",
      "GitHub's Retry-After header for GET /users/Nusnus is neither seconds nor an IMF-fixdate: 2.5\n" +
        MISSHAPEN_STEP,
    ],
  ])(
    "refuses Retry-After: %s, which is neither seconds nor an IMF-fixdate, naming it",
    (retryAfter, message) => {
      expect(() => failure(secondaryLimit(403, retryAfter))).toThrow(
        expect.objectContaining({
          kind: "misshapen",
          message,
          name: "GitHubError",
        }),
      );
    },
  );

  it.each([
    [
      "not in seconds",
      "in an hour",
      "GitHub's X-RateLimit-Reset header for GET /users/Nusnus is not seconds since the Unix epoch: in an hour\n" +
        MISSHAPEN_STEP,
    ],
    [
      "seconds after a word",
      "at 1793780404",
      "GitHub's X-RateLimit-Reset header for GET /users/Nusnus is not seconds since the Unix epoch: at 1793780404\n" +
        MISSHAPEN_STEP,
    ],
    [
      "seconds before a word",
      "1793780404 UTC",
      "GitHub's X-RateLimit-Reset header for GET /users/Nusnus is not seconds since the Unix epoch: 1793780404 UTC\n" +
        MISSHAPEN_STEP,
    ],
    [
      "missing",
      undefined,
      "GitHub's X-RateLimit-Reset header for GET /users/Nusnus is not seconds since the Unix epoch: null\n" +
        MISSHAPEN_STEP,
    ],
  ])(
    "refuses a rate limit whose reset is %s, naming it",
    (_case, reset, message) => {
      const headers = Object.fromEntries(
        Object.entries(RATE_LIMITED.headers).filter(
          ([name]) => name !== "x-ratelimit-reset",
        ),
      );

      expect(() =>
        failure(
          failedResponse({
            body: RATE_LIMITED.body,
            headers: {
              ...headers,
              ...(reset === undefined ? {} : { "x-ratelimit-reset": reset }),
            },
            status: 403,
          }),
        ),
      ).toThrow(
        expect.objectContaining({
          kind: "misshapen",
          message,
          name: "GitHubError",
        }),
      );
    },
  );

  it("finds a refused token, saying how to store a valid one", () => {
    expect(
      failure(failedResponse(recorded("rest/users/Nusnus.unauthorized"))),
    ).toStrictEqual({
      kind: "refused",
      message:
        'GitHub answered GET /users/Nusnus with 401: {"message":"Bad credentials","documentation_url":"https://docs.github.com/rest","status":"401"}\n' +
        REFUSED_TOKEN_STEP,
      name: "GitHubError",
      retryAt: undefined,
    });
  });

  it("finds a path GitHub does not have, with the caller's next step", () => {
    expect(
      failure(failedResponse(recorded("rest/repos/celery/no-such-repository"))),
    ).toStrictEqual({
      kind: "not found",
      message:
        'GitHub answered GET /users/Nusnus with 404: {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}\n' +
        "Set GITHUB_LOGIN to Tomer's login.",
      name: "GitHubError",
      retryAt: undefined,
    });
  });

  it("finds a path GitHub does not have on the last request a rate limit allows, not a rate limit", () => {
    const notFound = recorded("rest/repos/celery/no-such-repository");

    expect(
      failure(
        failedResponse({
          ...notFound,
          headers: { ...notFound.headers, "x-ratelimit-remaining": "0" },
        }),
      ),
    ).toStrictEqual({
      kind: "not found",
      message:
        'GitHub answered GET /users/Nusnus with 404: {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}\n' +
        "Set GITHUB_LOGIN to Tomer's login.",
      name: "GitHubError",
      retryAt: undefined,
    });
  });

  it("finds any other refusal, saying to fix the request as GitHub says", () => {
    expect(
      failure(failedResponse(recorded("rest/search/repositories.invalid"))),
    ).toStrictEqual({
      kind: "refused",
      message:
        'GitHub answered GET /users/Nusnus with 422: {"message":"Validation Failed","errors":[{"resource":"Search","field":"q","code":"missing"}],"documentation_url":"https://docs.github.com/v3/search","status":"422"}\n' +
        REFUSED_REQUEST_STEP,
      name: "GitHubError",
      retryAt: undefined,
    });
  });
});
