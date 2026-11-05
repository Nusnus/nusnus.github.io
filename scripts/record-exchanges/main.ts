/**
 * @file The services' recorder: records the exchanges the scripts' fake
 * network replays, in `tests/fixtures/services/`, from the real services, each
 * sent as the expiry check sends its requests. Run it as
 * `GH_TOKEN=$(gh auth token) bun run record:services [name …]`, naming
 * exchanges as their files are named, or none to record every one it can.
 *
 * Each exchange asks what RECORDINGS says, with the token it names, which is
 * sent and never recorded. GitHub's rate limit for a caller with no token is
 * recorded by spending it, so its two exchanges are recorded together: the
 * last request the hour's limit allows, then the refusal that follows.
 */

import {
  type Exchange,
  recordedRequest,
  recordedResponse,
} from "@nusnus/github-data/fixtures/exchange";
import { GITHUB_API_ORIGIN } from "@nusnus/github-data/github-links";
import { readdirSync } from "node:fs";
import path from "node:path";

import {
  UNAUTHENTICATED_LIMIT,
  writeExchangeFile,
} from "../../packages/worker/scripts/recording.ts";
import { TOKEN_VERIFICATION_URL } from "../expiries/cloudflare.ts";
import {
  openPullRequestsUrl,
  SUPPORTED_VERSIONS_URL,
} from "../expiries/github.ts";
import { RELEASE_SCHEDULE_URL } from "../expiries/node.ts";
import { serviceRequest } from "../expiries/request.ts";

/** How the recorder asks for one exchange: the URL and the token it sends. */
interface Recording {
  readonly token?: string;
  readonly url: string;
}

const EXCHANGES_FOLDER = path.join(
  import.meta.dirname,
  "../../tests/fixtures/services",
);

const githubToken = process.env["GH_TOKEN"];
if (githubToken === undefined || githubToken === "") {
  throw new Error(
    "The recorder needs a GitHub token in GH_TOKEN; run it as GH_TOKEN=$(gh auth token) bun run record:services.",
  );
}

// A repository whose updates Renovate proposes, and which the token in
// GH_TOKEN cannot push to.
const RENOVATE_REPOSITORY = "unjs/c12";

// Cloudflare looks up a token as long as those it issues, 40 characters, and
// refuses a shorter one as a malformed header, as its replies to these two
// show.
const UNISSUED_CLOUDFLARE_TOKEN = "unissued-token-in-cloudflare-format-0000";

const RECORDINGS: Readonly<Record<string, Recording>> = {
  "cloudflare/verify-malformed-token": {
    token: "not-a-cloudflare-token",
    url: TOKEN_VERIFICATION_URL,
  },
  "cloudflare/verify-unknown-token": {
    token: UNISSUED_CLOUDFLARE_TOKEN,
    url: TOKEN_VERIFICATION_URL,
  },
  "github/collaborators-of-unjs-c12.forbidden": {
    token: githubToken,
    url: `${GITHUB_API_ORIGIN}/repos/${RENOVATE_REPOSITORY}/collaborators`,
  },
  "github/pulls-of-unjs-c12": {
    token: githubToken,
    url: openPullRequestsUrl(RENOVATE_REPOSITORY),
  },
  "github/versions": { token: githubToken, url: SUPPORTED_VERSIONS_URL },
  "github/versions.unauthorized": {
    token: "not-a-github-token",
    url: SUPPORTED_VERSIONS_URL,
  },
  "node/missing-file": {
    url: new URL("missing-file.json", RELEASE_SCHEDULE_URL).href,
  },
  "node/schedule": { url: RELEASE_SCHEDULE_URL },
};

const LAST_REQUEST_EXCHANGE = "github/versions.last-request";
const RATE_LIMITED_EXCHANGE = "github/versions.rate-limited";
const RATE_LIMIT_EXCHANGES: ReadonlySet<string> = new Set([
  LAST_REQUEST_EXCHANGE,
  RATE_LIMITED_EXCHANGE,
]);

// The exchanges no one can record on demand, each with its reason.
const UNRECORDABLE: Readonly<Record<string, string>> = {
  // Cloudflare's API reference shows the example, without headers:
  // https://developers.cloudflare.com/api/resources/user/subresources/tokens/methods/verify/
  "cloudflare/verify-token-reference-example":
    "verifying a valid Cloudflare token needs the project's secret, which only CI holds, so the exchange holds the example reply in Cloudflare's API reference instead",
};

const names = process.argv.slice(2);
const toRecord = names.length > 0 ? names : recordedNames();
for (const name of toRecord.filter((name) => !RATE_LIMIT_EXCHANGES.has(name))) {
  await write(name, await recordedExchange(recordingOf(name)));
}
// Last, since it spends the hour's limit and fails if an earlier run did.
if (toRecord.some((name) => RATE_LIMIT_EXCHANGES.has(name))) {
  await recordRateLimit();
}

function recordedNames(): string[] {
  return readdirSync(EXCHANGES_FOLDER, { encoding: "utf8", recursive: true })
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""))
    .filter((name) => !(name in UNRECORDABLE));
}

function recordingOf(name: string): Recording {
  const recording = RECORDINGS[name];
  if (recording !== undefined) {
    return recording;
  }
  const reason = UNRECORDABLE[name];
  throw new Error(
    reason === undefined
      ? `${name} names no exchange the recorder knows: name one of ${[...Object.keys(RECORDINGS), ...RATE_LIMIT_EXCHANGES].join(", ")}, or add its request to RECORDINGS.`
      : `${name} cannot be recorded on demand: ${reason}.`,
  );
}

async function recordedExchange({ token, url }: Recording): Promise<Exchange> {
  const request = serviceRequest(url, token);
  const recorded = recordedRequest(request, await request.text());
  const response = await fetch(request);
  return {
    request: recorded,
    ...recordedResponse(response, await response.text()),
  };
}

async function recordRateLimit(): Promise<void> {
  for (let attempt = 1; attempt <= UNAUTHENTICATED_LIMIT; attempt += 1) {
    const exchange = await recordedExchange({ url: SUPPORTED_VERSIONS_URL });
    if (exchange.status !== 200) {
      throw new Error(
        `GitHub refused a request with no token with ${String(exchange.status)} before the recorder saw the hour's last one, as when an earlier run spent the limit; record ${LAST_REQUEST_EXCHANGE} and ${RATE_LIMITED_EXCHANGE} again after ${resetOf(exchange)}.`,
      );
    }
    if (exchange.headers["x-ratelimit-remaining"] === "0") {
      await write(LAST_REQUEST_EXCHANGE, exchange);
      await write(
        RATE_LIMITED_EXCHANGE,
        await recordedExchange({ url: SUPPORTED_VERSIONS_URL }),
      );
      return;
    }
  }
  throw new Error(
    `GitHub answered ${String(UNAUTHENTICATED_LIMIT)} requests with no token without spending its limit; check its limit at the link beside UNAUTHENTICATED_LIMIT.`,
  );
}

function resetOf({ headers }: Exchange): string {
  const reset = headers["x-ratelimit-reset"];
  return reset === undefined
    ? "an hour"
    : new Date(Number(reset) * 1000).toISOString();
}

async function write(name: string, exchange: Exchange): Promise<void> {
  await writeExchangeFile(
    path.join(EXCHANGES_FOLDER, `${name}.json`),
    exchange,
  );
  console.log(
    `${name}: GET ${exchange.request.url} → ${String(exchange.status)}`,
  );
}
