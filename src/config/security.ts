/**
 * Security configuration — repo name redaction for privacy.
 *
 * Re-exports from the shared config that's also used by the Cloudflare Worker.
 */

export { isKnownPublicRepo, safeRepoName } from '../../shared/github-config';
