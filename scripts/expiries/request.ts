/**
 * @file The request the expiry check sends a service: a GET of the service's
 * URL, carrying a bearer token where the service needs one. The services'
 * recorder sends the same, so the exchanges it records are the check's own.
 */

export function serviceRequest(url: string, token?: string): Request {
  return new Request(
    url,
    token === undefined
      ? {}
      : { headers: { Authorization: `Bearer ${token}` } },
  );
}
