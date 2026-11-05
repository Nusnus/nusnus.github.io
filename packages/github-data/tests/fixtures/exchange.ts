/**
 * @file An exchange: one request sent to a service, such as GitHub's API or
 * the worker, and the response that carried the service's reply, recorded
 * from the real service, so tests replay real replies offline. Every
 * package's tests record and replay exchanges in this one form:
 * `recordedRequest` and `recordedResponse` record a fetch request and
 * response, and `bodyTextOf` gives a recorded response's body back as the text
 * the service sent. A fake service hands each test the requests it received,
 * read by `receivedRequest`: what an exchange records of each, and its
 * headers, which no exchange records.
 *
 * A request keeps its method, its URL and its body, and never its headers, so
 * no token is recorded. A response keeps its status, every header the service
 * sent but those that describe the bytes on the wire, Content-Encoding,
 * Content-Length and Transfer-Encoding, since a replay encodes the body anew,
 * and its body: JSON where the service sent JSON, the text it sent otherwise,
 * and none when it sent none. A string body therefore replays as text, so a
 * reply whose JSON is a lone string cannot be recorded; no service the project
 * asks sends one. In a refusal, any IPv4 address, such as the caller's that a
 * rate limit names, becomes the documentation address 203.0.113.7 (RFC 5737);
 * GitHub's API has no IPv6 address, so no caller's is recorded.
 */

/** A request to a service, as an exchange records it. */
export interface ExchangeRequest {
  readonly method: string;
  readonly url: string;
  readonly body?: unknown;
}

/** The response that carried a service's reply, as an exchange records it. */
export interface ExchangeResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: unknown;
}

/** One request to a service, and the response that carried its reply. */
export interface Exchange extends ExchangeResponse {
  readonly request: ExchangeRequest;
}

/**
 * A request a fake service received: what an exchange records of it, and its
 * headers, by lower-case name, from which a test reads what the client sent,
 * such as its token.
 */
export interface ReceivedRequest extends ExchangeRequest {
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * What a fake service reads of a fetch request besides its body: its method,
 * its URL, and its headers, by lower-case name, as a fetch request lists them.
 */
interface ReadableRequest {
  readonly headers: Iterable<readonly [name: string, value: string]>;
  readonly method: string;
  readonly url: string;
}

/**
 * What an exchange records of a fetch response besides its body: its status,
 * whether that is a success, and its headers, by lower-case name, as a fetch
 * response lists them.
 */
interface RecordableResponse {
  readonly headers: Iterable<readonly [name: string, value: string]>;
  readonly ok: boolean;
  readonly status: number;
}

const WIRE_HEADERS: ReadonlySet<string> = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
]);

const DOCUMENTATION_ADDRESS = "203.0.113.7";

export function receivedRequest(
  { headers, method, url }: ReadableRequest,
  bodyText: string,
): ReceivedRequest {
  return {
    headers: Object.fromEntries(headers),
    ...recordedRequest({ method, url }, bodyText),
  };
}

export function recordedRequest(
  { method, url }: { readonly method: string; readonly url: string },
  bodyText: string,
): ExchangeRequest {
  return {
    method,
    url,
    ...(bodyText === "" ? {} : { body: JSON.parse(bodyText) as unknown }),
  };
}

export function recordedResponse(
  { headers, ok, status }: RecordableResponse,
  bodyText: string,
): ExchangeResponse {
  const recordedHeaders = Object.fromEntries(
    [...headers].filter(([name]) => !WIRE_HEADERS.has(name)),
  );
  const text = ok
    ? bodyText
    : bodyText.replaceAll(
        /\b\d{1,3}(?:\.\d{1,3}){3}\b/g,
        DOCUMENTATION_ADDRESS,
      );
  return {
    status,
    headers: recordedHeaders,
    ...(text === ""
      ? {}
      : {
          body: recordedHeaders["content-type"]?.startsWith("application/json")
            ? (JSON.parse(text) as unknown)
            : text,
        }),
  };
}

export function bodyTextOf({ body }: ExchangeResponse): null | string {
  if (body === undefined) {
    return null;
  }
  return typeof body === "string" ? body : JSON.stringify(body);
}
