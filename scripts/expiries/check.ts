/**
 * @file The expiry check: learns when each thing the site relies on expires,
 * from the service that knows, and reports each, failing once one is due or
 * cannot be learned. It learns the worker's GitHub token and GitHub's support
 * for the API version the worker requests from the worker's reply and GitHub's
 * API, the Cloudflare API token that deploys the worker from Cloudflare, the
 * support for the Node.js release it runs on from the Node.js project, and
 * whether each of Renovate's updates still open is stuck from GitHub's API.
 * It reads its environment variables, CLOUDFLARE_API_TOKEN, GH_TOKEN and
 * GITHUB_REPOSITORY, and the Node.js version it runs on.
 */

import { fullNameSchema } from "@nusnus/github-data/formats";
import * as schema from "@nusnus/github-data/schema";

import { fetchFailureOf } from "../fetch-failure.ts";
import { WORKER_PROFILE_URL } from "../worker-profile.ts";
import {
  cloudflareTokenExpiry,
  parseTokenVerification,
  TOKEN_VERIFICATION_URL,
} from "./cloudflare.ts";
import { ExpiryCheckError } from "./expiry.ts";
import {
  apiVersionExpiry,
  defaultApiVersionExpiry,
  githubPullRequestsSchema,
  githubSupportedVersionsSchema,
  openPullRequestsUrl,
  parseGitHubReply,
  stuckUpdateExpiries,
  SUPPORTED_VERSIONS_URL,
  workerTokenExpiry,
} from "./github.ts";
import {
  nodeExpiry,
  parseReleaseSchedule,
  RELEASE_SCHEDULE_URL,
} from "./node.ts";
import { NEXT_RUN, type ReceivedResponse } from "./reply.ts";
import {
  asExpiryCheckError,
  type Outcome,
  outcomeOf,
  type Report,
  reportOutcomes,
} from "./report.ts";
import { serviceRequest } from "./request.ts";
import { parseWorkerAccess } from "./worker.ts";

const environmentVariablesSchema = schema.object({
  CLOUDFLARE_API_TOKEN: schema.string().check(schema.minLength(1)),
  GH_TOKEN: schema.string().check(schema.minLength(1)),
  GITHUB_REPOSITORY: fullNameSchema,
});

type EnvironmentVariables = schema.Infer<typeof environmentVariablesSchema>;

// Each service answers within a second or two; ten covers a slow day.
const REQUEST_TIMEOUT_SECONDS = 10;

export async function checkExpiries(
  nodeVersion: string,
  env: NodeJS.ProcessEnv,
  now: Date,
): Promise<Report> {
  let variables: EnvironmentVariables;
  try {
    variables = parseEnvironmentVariables(env);
  } catch (error) {
    return reportOutcomes([asExpiryCheckError(error)], now);
  }
  return reportOutcomes(await learnOutcomes(nodeVersion, variables), now);
}

function parseEnvironmentVariables(
  env: NodeJS.ProcessEnv,
): EnvironmentVariables {
  return schema.parse(
    environmentVariablesSchema,
    env,
    (issues) =>
      new ExpiryCheckError(
        `The check's environment variables are missing or invalid:\n${issues}\n` +
          "Set CLOUDFLARE_API_TOKEN to the Cloudflare API token that deploys the worker; " +
          "GH_TOKEN to a GitHub token, which in CI is the workflow's token; " +
          "and GITHUB_REPOSITORY to the repository as owner/name.",
      ),
  );
}

async function learnOutcomes(
  nodeVersion: string,
  { CLOUDFLARE_API_TOKEN, GH_TOKEN, GITHUB_REPOSITORY }: EnvironmentVariables,
): Promise<Outcome[]> {
  // The check names no API version, so GitHub answers with its default one,
  // whose support defaultApiVersionExpiry reports.
  const [access, versions, verification, schedule, pullRequests] =
    await Promise.allSettled([
      receive(WORKER_PROFILE_URL).then(parseWorkerAccess),
      receive(SUPPORTED_VERSIONS_URL, GH_TOKEN).then((response) =>
        parseGitHubReply(response, githubSupportedVersionsSchema),
      ),
      receive(TOKEN_VERIFICATION_URL, CLOUDFLARE_API_TOKEN).then(
        parseTokenVerification,
      ),
      receive(RELEASE_SCHEDULE_URL).then(parseReleaseSchedule),
      receive(openPullRequestsUrl(GITHUB_REPOSITORY), GH_TOKEN).then(
        (response) => parseGitHubReply(response, githubPullRequestsSchema),
      ),
    ]);
  return [
    outcomeOf(access, ({ tokenExpiresAt }) => [
      workerTokenExpiry(tokenExpiresAt),
    ]),
    outcomeOf(versions, (supportedVersions) => [
      // Without the worker's reply, the version it requests is unknown, and
      // the outcome above already says why.
      ...(access.status === "fulfilled"
        ? [apiVersionExpiry(access.value.apiVersion, supportedVersions)]
        : []),
      defaultApiVersionExpiry(supportedVersions),
    ]),
    outcomeOf(verification, (tokenVerification) => [
      cloudflareTokenExpiry(tokenVerification),
    ]),
    outcomeOf(schedule, (releaseSchedule) => [
      nodeExpiry(nodeVersion, releaseSchedule),
    ]),
    outcomeOf(pullRequests, stuckUpdateExpiries),
  ];
}

async function receive(url: string, token?: string): Promise<ReceivedResponse> {
  try {
    // The deadline covers reading the body too.
    const response = await fetch(serviceRequest(url, token), {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_SECONDS * 1000),
    });
    return {
      body: await response.text(),
      headers: response.headers,
      status: response.status,
      url,
    };
  } catch (error) {
    throw new ExpiryCheckError(
      fetchFailureOf(error) === "timeout"
        ? `GET ${url} got no answer within ${String(REQUEST_TIMEOUT_SECONDS)} seconds. ${NEXT_RUN}.`
        : `GET ${url} failed: ${String(error)}. ${NEXT_RUN}.`,
    );
  }
}
