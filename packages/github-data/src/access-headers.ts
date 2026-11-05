/**
 * @file The access headers: on each reply, the worker says how long its access
 * to GitHub lasts, so a check outside it can warn before that access lapses.
 */

export const ACCESS_HEADERS = {
  // The GitHub REST API version the worker requests, under the name of the
  // request header that carries it to GitHub, which retires each version on a
  // schedule: https://docs.github.com/en/rest/about-the-rest-api/api-versions
  apiVersion: "X-GitHub-Api-Version",
  // When the token that fetched the reply's data expires, relayed verbatim
  // from GitHub, which sends it only for a token that expires:
  // https://github.blog/changelog/2021-07-26-expiration-options-for-personal-access-tokens/
  tokenExpiry: "GitHub-Authentication-Token-Expiration",
} as const;
