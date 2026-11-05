/**
 * @file GitHub's links: the origins of github.com and of GitHub's API, the
 * format of a link to a page on github.com, and that link built for each page
 * the project names: an owner's profile, a repository, a pull request, a
 * commit, a person's commits to a repository, and the form that creates a
 * fine-grained personal access token. A link's type is a string that starts
 * with github.com's origin, so every link built here is one as written.
 */

import { type FullName } from "./formats.ts";
import * as schema from "./schema.ts";

const GITHUB_ORIGIN = "https://github.com";

export const GITHUB_API_ORIGIN = "https://api.github.com";

export const githubUrlSchema = schema.templateLiteral(
  [`${GITHUB_ORIGIN}/`, schema.string()],
  {
    error: `must be a link to a page on github.com, such as ${GITHUB_ORIGIN}/celery`,
  },
);

export type GitHubUrl = schema.Infer<typeof githubUrlSchema>;

export function ownerUrl(owner: string): GitHubUrl {
  return `${GITHUB_ORIGIN}/${owner}`;
}

export function repositoryUrl(fullName: FullName): GitHubUrl {
  return `${GITHUB_ORIGIN}/${fullName}`;
}

export function pullRequestUrl(fullName: FullName, number: number): GitHubUrl {
  return `${repositoryUrl(fullName)}/pull/${String(number)}`;
}

export function commitUrl(fullName: FullName, sha: string): GitHubUrl {
  return `${repositoryUrl(fullName)}/commit/${sha}`;
}

export function commitsByAuthorUrl(
  fullName: FullName,
  login: string,
): GitHubUrl {
  return `${repositoryUrl(fullName)}/commits?author=${encodeURIComponent(login)}`;
}

// The form's fields take their values from the query string:
// https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#pre-filling-fine-grained-personal-access-token-details-using-url-parameters
export function personalAccessTokenUrl(
  name: string,
  expiresIn: "none" | number,
): GitHubUrl {
  return `${GITHUB_ORIGIN}/settings/personal-access-tokens/new?name=${encodeURIComponent(name)}&expires_in=${String(expiresIn)}`;
}
