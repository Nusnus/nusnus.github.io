/**
 * Security configuration — repo name redaction for privacy.
 *
 * Defense-in-depth filter for activity events. Even though we use
 * /events/public (which only returns public events), this ensures
 * private repo names can never leak through the API.
 */

const KNOWN_PUBLIC_OWNERS: ReadonlySet<string> = new Set(['nusnus', 'celery', 'mher']);

/** Check if a repo full name (owner/repo) belongs to a known public owner. */
export function isKnownPublicRepo(repoFullName: string): boolean {
  const owner = repoFullName.split('/')[0]?.toLowerCase() ?? '';
  return KNOWN_PUBLIC_OWNERS.has(owner);
}

/** Redact a repo name if it's not from a known public owner. */
export function safeRepoName(repoFullName: string): string {
  return isKnownPublicRepo(repoFullName) ? repoFullName : 'Private Project';
}
