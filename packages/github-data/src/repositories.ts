/**
 * @file The tracked repositories: the Celery repositories the site lists, each
 * with Tomer's role in it, and the GitHub data the site shows for each.
 *
 * A tracked repository's role and whether it is featured are Tomer's own
 * facts, held here; everything else comes from GitHub, through the worker.
 */

import { countSchema, type FullName, instantSchema } from "./formats.ts";
import * as schema from "./schema.ts";

/** Tomer's part in a repository, which its card shows as a badge. */
export type RepositoryRole = "contributor" | "creator" | "lead" | "owner";

/**
 * A repository the site lists. A featured one is among the repositories Tomer
 * works on most; the rest are the other repositories of Celery and its
 * ecosystem he contributes to.
 */
export interface TrackedRepository {
  readonly featured: boolean;
  readonly fullName: FullName;
  readonly role: RepositoryRole;
}

// In the order the site lists them.
export const TRACKED_REPOSITORIES = [
  { featured: true, fullName: "celery/celery", role: "owner" },
  { featured: true, fullName: "celery/pytest-celery", role: "creator" },
  { featured: true, fullName: "celery/kombu", role: "owner" },
  { featured: false, fullName: "celery/billiard", role: "owner" },
  { featured: false, fullName: "celery/django-celery-beat", role: "owner" },
  { featured: false, fullName: "celery/django-celery-results", role: "owner" },
  { featured: false, fullName: "celery/py-amqp", role: "owner" },
  { featured: false, fullName: "celery/librabbitmq", role: "owner" },
  { featured: false, fullName: "celery/vine", role: "owner" },
  { featured: false, fullName: "celery/sphinx_celery", role: "owner" },
  { featured: false, fullName: "celery/celeryproject", role: "owner" },
  { featured: false, fullName: "mher/flower", role: "contributor" },
] as const satisfies readonly TrackedRepository[];

export type TrackedFullName = (typeof TRACKED_REPOSITORIES)[number]["fullName"];

const repositorySchema = schema.readonly(
  schema.strictObject({
    contributorRank: schema.nullable(schema.int().check(schema.positive())),
    description: schema.nullable(schema.string()),
    forks: countSchema,
    language: schema.nullable(schema.string()),
    lastPush: instantSchema,
    stars: countSchema,
  }),
);

/**
 * What GitHub says about a tracked repository, including Tomer's rank among
 * its contributors, 1 for the top. A field GitHub leaves empty, such as a
 * missing description or a rank he does not hold, is `null`.
 */
export type Repository = schema.Infer<typeof repositorySchema>;

export const repositoriesSchema = schema.readonly(
  schema.record(
    schema.enum(TRACKED_REPOSITORIES.map(({ fullName }) => fullName)),
    repositorySchema,
  ),
);

/** The GitHub data of every tracked repository, by its full name. */
export type Repositories = schema.Infer<typeof repositoriesSchema>;
