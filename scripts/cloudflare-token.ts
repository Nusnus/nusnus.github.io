/**
 * @file How to create or renew the Cloudflare API token that deploys the
 * worker, which both the repository's setup script and the expiry check print.
 */

export const CLOUDFLARE_TOKEN_RENEWAL =
  'Create a token from the "Edit Cloudflare Workers" template at https://dash.cloudflare.com/profile/api-tokens, ' +
  "or roll the current one there, then store it with `gh secret set CLOUDFLARE_API_TOKEN --env cloudflare`.";
