/**
 * @file What the worker serves from the GitHub exchanges recorded in its
 * tests' fixtures, stamped with when GitHub answered the last of the requests
 * behind it: the reply to each route; the activity reply it serves from other
 * accounts' public events, each in a repository off the allowlist and so
 * redacted; and its whole exchange with a client for the replies other
 * packages read more of than the data, in the form the `exchange` module
 * defines. The profile route's carries the worker's access headers; its 502 is
 * its answer while GitHub refuses it with a rate limit and it has no cached
 * reply; its 404 is its answer to a path it has no route at. The worker's
 * entry-point test fails whenever what it serves differs from these files, and
 * `bun run update:worker-replies` rewrites them from what it serves.
 */

// Stryker cannot place its string mutant in a re-export's import attribute,
// `type: "json"`, and stops the whole run when it tries.
// Stryker disable StringLiteral
export { default as activityReply } from "./activity-reply.json" with { type: "json" };
export { default as contributionGraphReply } from "./contribution-graph-reply.json" with { type: "json" };
export { default as noSuchRouteExchange } from "./no-such-route-exchange.json" with { type: "json" };
export { default as profileExchange } from "./profile-exchange.json" with { type: "json" };
export { default as profileReply } from "./profile-reply.json" with { type: "json" };
export { default as profileUnavailableExchange } from "./profile-unavailable-exchange.json" with { type: "json" };
export { default as redactedActivityReply } from "./redacted-activity-reply.json" with { type: "json" };
export { default as repositoriesReply } from "./repositories-reply.json" with { type: "json" };
// Stryker restore StringLiteral
