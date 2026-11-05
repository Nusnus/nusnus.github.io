/**
 * @file Titles of the pages targets take theirs from, looked up by link in one
 * GraphQL query however many there are: a pull request's title, or a commit
 * message's first line, or for a commit whose first line is empty, the
 * reference GitHub writes for it. A page GitHub does not have gets no title.
 */

import type { GitHubUrl } from "@nusnus/github-data/github-links";

import { titleSchema } from "@nusnus/github-data/activity";
import * as schema from "@nusnus/github-data/schema";

import type { GitHubClient } from "../../github/client.ts";
import type { TitlePage, TitlePageTarget } from "./event-targets.ts";

import { GitHubError } from "../../github/failures.ts";

// GitHub answers `null` for a page it does not have.
export const githubResourcesSchema = schema.record(
  schema.string(),
  schema.nullable(
    schema.union([
      schema.object({ title: titleSchema }),
      schema.object({ message: schema.string() }),
    ]),
  ),
);

/** The pull requests and commits GitHub found, by their alias in the query. */
export type GitHubResources = schema.Infer<typeof githubResourcesSchema>;

/** A GraphQL query and its variables. */
export interface TitlesQuery {
  readonly query: string;
  readonly variables: Readonly<Record<string, GitHubUrl>>;
}

export async function lookUpTitles(
  github: GitHubClient,
  targets: readonly TitlePageTarget[],
): Promise<ReadonlyMap<GitHubUrl, string>> {
  const pages = uniquePages(targets);
  if (pages.length === 0) {
    return new Map();
  }
  const { query, variables } = titlesQuery(pages);
  return titlesFrom(
    pages,
    await github.query(query, variables, githubResourcesSchema),
  );
}

function uniquePages(targets: readonly TitlePageTarget[]): TitlePage[] {
  const pages = new Map(
    targets.map(({ reference, titlePageUrl }) => [
      titlePageUrl,
      { reference, titlePageUrl },
    ]),
  );
  return [...pages.values()];
}

export function titlesQuery(pages: readonly TitlePage[]): TitlesQuery {
  // Each link is a variable, so no link is ever spliced into the query.
  return {
    query:
      `query (${pages.map((_page, index) => `$${variableOf(index)}: URI!`).join(", ")}) {\n` +
      pages
        .map(
          (_page, index) =>
            `  ${aliasOf(index)}: resource(url: $${variableOf(index)}) { ... on PullRequest { title } ... on Commit { message } }\n`,
        )
        .join("") +
      "}",
    variables: Object.fromEntries(
      pages.map(({ titlePageUrl }, index) => [variableOf(index), titlePageUrl]),
    ),
  };
}

export function titlesFrom(
  pages: readonly TitlePage[],
  resources: GitHubResources,
): ReadonlyMap<GitHubUrl, string> {
  return new Map(
    pages.flatMap(({ reference, titlePageUrl }, index) => {
      const alias = aliasOf(index);
      const resource = resources[alias];
      if (resource === undefined) {
        throw GitHubError.misshapen(
          `GitHub's reply to the title lookup holds no ${alias}, for ${titlePageUrl}.`,
        );
      }
      if (resource === null) {
        return [];
      }
      const title =
        "title" in resource ? resource.title : firstLine(resource.message);
      return [[titlePageUrl, title === "" ? reference : title] as const];
    }),
  );
}

// The query's alias for each page's resource, which its reply is keyed by.
function aliasOf(index: number): string {
  return `resource${String(index)}`;
}

function variableOf(index: number): string {
  return `url${String(index)}`;
}

function firstLine(message: string): string {
  return message.replace(/\n.*/s, "");
}
