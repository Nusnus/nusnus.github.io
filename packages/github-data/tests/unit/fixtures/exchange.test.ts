/**
 * @file Exchanges: a request a fake received read with its headers too; a
 * request recorded with its method, its URL and any JSON body; a response
 * recorded with its status, every header but the wire's, and its body as
 * JSON, as text or as none, with any address in a refusal replaced; and a
 * recorded response's body given back as the text its service sent.
 */

import { describe, expect, it } from "vitest";

import {
  bodyTextOf,
  receivedRequest,
  recordedRequest,
  recordedResponse,
} from "../../fixtures/exchange.ts";

describe("receivedRequest", () => {
  it("reads what an exchange records of a request, and its headers", () => {
    expect(
      receivedRequest(
        {
          headers: [["authorization", "Bearer test-token"]],
          method: "POST",
          url: "https://api.github.com/graphql",
        },
        '{"query":"{ viewer { login } }"}',
      ),
    ).toStrictEqual({
      headers: { authorization: "Bearer test-token" },
      method: "POST",
      url: "https://api.github.com/graphql",
      body: { query: "{ viewer { login } }" },
    });
  });
});

describe("recordedRequest", () => {
  it("keeps a request's method and URL, and no body for one without", () => {
    expect(
      recordedRequest(
        { method: "GET", url: "https://api.github.com/users/Nusnus" },
        "",
      ),
    ).toStrictEqual({
      method: "GET",
      url: "https://api.github.com/users/Nusnus",
    });
  });

  it("keeps a request's JSON body", () => {
    expect(
      recordedRequest(
        { method: "POST", url: "https://api.github.com/graphql" },
        '{"query":"{ viewer { login } }"}',
      ),
    ).toStrictEqual({
      method: "POST",
      url: "https://api.github.com/graphql",
      body: { query: "{ viewer { login } }" },
    });
  });
});

describe("recordedResponse", () => {
  it("keeps a response's status, its headers but those of the wire, and its JSON body", () => {
    expect(
      recordedResponse(
        {
          headers: [
            ["content-encoding", "gzip"],
            ["content-length", "18"],
            ["content-type", "application/json; charset=utf-8"],
            ["transfer-encoding", "chunked"],
            ["x-github-request-id", "C446:25D491"],
          ],
          ok: true,
          status: 200,
        },
        '{"login":"Nusnus"}',
      ),
    ).toStrictEqual({
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-github-request-id": "C446:25D491",
      },
      body: { login: "Nusnus" },
    });
  });

  it("keeps a body that is not JSON as its text", () => {
    expect(
      recordedResponse(
        {
          headers: [["content-type", "text/plain;charset=utf-8"]],
          ok: true,
          status: 200,
        },
        "Accessible for all.",
      ),
    ).toStrictEqual({
      status: 200,
      headers: { "content-type": "text/plain;charset=utf-8" },
      body: "Accessible for all.",
    });
  });

  it("keeps a body with no type as its text", () => {
    expect(
      recordedResponse(
        { headers: [], ok: true, status: 200 },
        '{"login":"Nusnus"}',
      ),
    ).toStrictEqual({ status: 200, headers: {}, body: '{"login":"Nusnus"}' });
  });

  it("keeps no body for a response without one", () => {
    expect(
      recordedResponse({ headers: [], ok: true, status: 204 }, ""),
    ).toStrictEqual({ status: 204, headers: {} });
  });

  it("replaces each address a refusal names with a documentation address", () => {
    expect(
      recordedResponse(
        {
          headers: [["content-type", "application/json"]],
          ok: false,
          status: 403,
        },
        '{"message":"API rate limit exceeded for 198.51.100.24, not 198.51.100.25."}',
      ),
    ).toStrictEqual({
      status: 403,
      headers: { "content-type": "application/json" },
      body: {
        message: "API rate limit exceeded for 203.0.113.7, not 203.0.113.7.",
      },
    });
  });

  it("keeps what looks like an address in a response that succeeded", () => {
    expect(
      recordedResponse(
        {
          headers: [["content-type", "application/json"]],
          ok: true,
          status: 200,
        },
        '{"tag_name":"v1.2.3.4"}',
      ),
    ).toStrictEqual({
      status: 200,
      headers: { "content-type": "application/json" },
      body: { tag_name: "v1.2.3.4" },
    });
  });
});

describe("bodyTextOf", () => {
  it("gives a JSON body back as JSON text", () => {
    expect(
      bodyTextOf({ status: 404, headers: {}, body: { message: "Not Found" } }),
    ).toBe('{"message":"Not Found"}');
  });

  it("gives a text body back as it was sent", () => {
    expect(
      bodyTextOf({ status: 200, headers: {}, body: "Accessible for all." }),
    ).toBe("Accessible for all.");
  });

  it("gives no body for a response without one", () => {
    expect(bodyTextOf({ status: 204, headers: {} })).toBeNull();
  });
});
