/**
 * @file The expiry Cloudflare sets: the API token that deploys the worker,
 * read from Cloudflare's verification of the token.
 */

import { instantSchema } from "@nusnus/github-data/formats";
import * as schema from "@nusnus/github-data/schema";

import { CLOUDFLARE_TOKEN_RENEWAL } from "../cloudflare-token.ts";
import { Expiry, ExpiryCheckError } from "./expiry.ts";
import { parseBody, parseReply, type ReceivedResponse } from "./reply.ts";

// Cloudflare's verification of the token a request carries:
// https://developers.cloudflare.com/api/resources/user/subresources/tokens/methods/verify/
export const TOKEN_VERIFICATION_URL =
  "https://api.cloudflare.com/client/v4/user/tokens/verify";

export const tokenVerificationSchema = schema.object({
  result: schema.object({
    expires_on: schema.optional(instantSchema),
    status: schema.enum(["active", "disabled", "expired"]),
  }),
});

// A refusal names its errors in the envelope every reply of Cloudflare's API
// shares, as the reference above shows. Cloudflare refuses a malformed token
// with 400 and one it never issued with 401, as the tests' exchanges show.
const REFUSAL_STATUSES: ReadonlySet<number> = new Set([400, 401]);

const refusalSchema = schema.object({
  errors: schema.array(schema.object({ message: schema.string() })),
});

export function parseTokenVerification(
  response: ReceivedResponse,
): schema.Infer<typeof tokenVerificationSchema> {
  if (REFUSAL_STATUSES.has(response.status)) {
    const { errors } = parseBody(response, refusalSchema);
    throw new ExpiryCheckError(
      `Cloudflare refused CLOUDFLARE_API_TOKEN with ${String(response.status)}: ` +
        `${errors.map(({ message }) => message).join("; ")}. ${CLOUDFLARE_TOKEN_RENEWAL}`,
    );
  }
  return parseReply(response, tokenVerificationSchema);
}

export function cloudflareTokenExpiry(
  verification: schema.Infer<typeof tokenVerificationSchema>,
): Expiry {
  const { expires_on, status } = verification.result;
  if (status !== "active") {
    throw new ExpiryCheckError(
      `Cloudflare reports CLOUDFLARE_API_TOKEN as ${status}. ${CLOUDFLARE_TOKEN_RENEWAL}`,
    );
  }
  return new Expiry(
    "The Cloudflare API token that deploys the worker",
    expires_on ?? "never",
    CLOUDFLARE_TOKEN_RENEWAL,
  );
}
