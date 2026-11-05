/**
 * @file Redaction: the site names Tomer's activity in a repository only when
 * the repository's owner is on the allowlist, matched case-insensitively as
 * GitHub matches owners, and hides the rest, showing it as a private project
 * that links to its owner's page.
 */

import { type FullName, parseFullName } from "./formats.ts";
import { type GitHubUrl, ownerUrl } from "./github-links.ts";
import { GITHUB_LOGIN } from "./profile.ts";

// In lower case, as `isAllowlisted` compares them.
const ALLOWLISTED_OWNERS: ReadonlySet<string> = new Set(
  [GITHUB_LOGIN, "celery", "mher"].map((owner) => owner.toLowerCase()),
);

export function isAllowlisted(fullName: FullName): boolean {
  return ALLOWLISTED_OWNERS.has(parseFullName(fullName).owner.toLowerCase());
}

export function redactedUrl(fullName: FullName): GitHubUrl {
  return ownerUrl(parseFullName(fullName).owner);
}
