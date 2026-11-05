/**
 * @file Event targets: for each GitHub event type the contract holds, a target
 * reader, which reads the part of the event's payload the worker needs and
 * returns the event's target, what it acted on.
 *
 * A target has a link, and either a title from the payload or, for an event on
 * a pull request or a commit, the page whose title it takes, the pull request's
 * title or the commit message's first line, which the Events API does not send:
 * https://docs.github.com/en/rest/using-the-rest-api/github-event-types. Such a
 * target also holds the reference GitHub writes for its page in text, a pull
 * request's `#` and number or a commit's short hash, for a commit whose message
 * gives no title.
 */

import { type EventType, titleSchema } from "@nusnus/github-data/activity";
import {
  type FullName,
  fullNameSchema,
  instantSchema,
} from "@nusnus/github-data/formats";
import {
  commitUrl,
  type GitHubUrl,
  githubUrlSchema,
  pullRequestUrl,
  repositoryUrl,
} from "@nusnus/github-data/github-links";
import * as schema from "@nusnus/github-data/schema";

import { parseGitHubData } from "../../github/failures.ts";

export const githubEventSchema = schema.object({
  created_at: instantSchema,
  id: schema.string(),
  payload: schema.unknown(),
  repo: schema.object({ name: fullNameSchema }),
  type: schema.string(),
});

/**
 * An event as GitHub's Events API lists it, its payload not yet read, of one
 * of `Type`'s event types.
 */
export type GitHubEvent<Type extends string = string> = Omit<
  schema.Infer<typeof githubEventSchema>,
  "type"
> & { readonly type: Type };

/**
 * What an event acted on: its link, and either its title or the page whose
 * title it takes, with the reference GitHub writes for that page.
 */
export type ActivityTarget =
  | {
      readonly reference: string;
      readonly titlePageUrl: GitHubUrl;
      readonly url: GitHubUrl;
    }
  | { readonly title: string; readonly url: GitHubUrl };

/** A target whose title is that of the page it links to. */
export type TitlePageTarget = Extract<
  ActivityTarget,
  { titlePageUrl: unknown }
>;

/**
 * The page whose title a target takes, and the reference GitHub writes for
 * it.
 */
export type TitlePage = Omit<TitlePageTarget, "url">;

/** Reads one event type's target from an event's payload. */
interface TargetReader {
  read(event: GitHubEvent<EventType>): ActivityTarget;
}

const githubPageSchema = schema.object({
  html_url: githubUrlSchema,
  title: titleSchema,
});
const githubPullRequestSchema = schema.object({
  number: schema.int().check(schema.positive()),
});
const githubLinkSchema = schema.object({ html_url: githubUrlSchema });

const TARGET_READERS: Readonly<Record<EventType, TargetReader>> = {
  CommitCommentEvent: targetReader(
    schema.object({
      comment: schema.object({
        commit_id: schema.string(),
        html_url: githubUrlSchema,
      }),
    }),
    ({ comment }, repository) => ({
      ...commitPage(repository, comment.commit_id),
      url: comment.html_url,
    }),
  ),
  CreateEvent: targetReader(
    // A created repository has no ref; a created branch or tag does.
    schema.object({ ref: schema.nullable(titleSchema) }),
    ({ ref }, repository) => ({
      title: ref ?? repository,
      url: repositoryUrl(repository),
    }),
  ),
  DeleteEvent: targetReader(
    schema.object({ ref: titleSchema }),
    ({ ref }, repository) => ({ title: ref, url: repositoryUrl(repository) }),
  ),
  DiscussionEvent: targetReader(
    schema.object({ discussion: githubPageSchema }),
    ({ discussion }) => ({ title: discussion.title, url: discussion.html_url }),
  ),
  ForkEvent: repositoryTargetReader(),
  GollumEvent: targetReader(
    schema.object({
      pages: schema.tuple([githubPageSchema], githubPageSchema),
    }),
    ({ pages: [page] }) => ({ title: page.title, url: page.html_url }),
  ),
  IssueCommentEvent: targetReader(
    schema.object({
      comment: githubLinkSchema,
      issue: schema.object({ title: titleSchema }),
    }),
    ({ comment, issue }) => ({ title: issue.title, url: comment.html_url }),
  ),
  IssuesEvent: targetReader(
    schema.object({ issue: githubPageSchema }),
    ({ issue }) => ({ title: issue.title, url: issue.html_url }),
  ),
  MemberEvent: targetReader(
    schema.object({
      member: schema.object({ html_url: githubUrlSchema, login: titleSchema }),
    }),
    ({ member }) => ({ title: member.login, url: member.html_url }),
  ),
  PublicEvent: repositoryTargetReader(),
  PullRequestEvent: targetReader(
    schema.object({ pull_request: githubPullRequestSchema }),
    ({ pull_request }, repository) =>
      linkedToItself(pullRequestPage(repository, pull_request.number)),
  ),
  PullRequestReviewCommentEvent: targetReader(
    schema.object({
      comment: githubLinkSchema,
      pull_request: githubPullRequestSchema,
    }),
    ({ comment, pull_request }, repository) => ({
      ...pullRequestPage(repository, pull_request.number),
      url: comment.html_url,
    }),
  ),
  PullRequestReviewEvent: targetReader(
    schema.object({
      pull_request: githubPullRequestSchema,
      review: githubLinkSchema,
    }),
    ({ pull_request, review }, repository) => ({
      ...pullRequestPage(repository, pull_request.number),
      url: review.html_url,
    }),
  ),
  PushEvent: targetReader(
    schema.object({ head: schema.string() }),
    ({ head }, repository) => linkedToItself(commitPage(repository, head)),
  ),
  ReleaseEvent: targetReader(
    schema.object({
      release: schema.object({
        html_url: githubUrlSchema,
        name: schema.nullable(schema.string()),
        tag_name: titleSchema,
      }),
    }),
    ({ release }) => ({
      // A release published without a title has an empty or null name, and
      // GitHub shows its tag instead.
      title:
        release.name === null || release.name === ""
          ? release.tag_name
          : release.name,
      url: release.html_url,
    }),
  ),
  WatchEvent: repositoryTargetReader(),
};

export function readTarget(event: GitHubEvent<EventType>): ActivityTarget {
  return TARGET_READERS[event.type].read(event);
}

function repositoryTargetReader(): TargetReader {
  return targetReader(schema.object({}), (_payload, repository) => ({
    title: repository,
    url: repositoryUrl(repository),
  }));
}

function targetReader<Payload>(
  payloadSchema: schema.Schema<Payload>,
  read: (payload: Payload, repository: FullName) => ActivityTarget,
): TargetReader {
  return {
    read({ id, payload, repo, type }) {
      return read(
        parseGitHubData(`${type} ${id} payload`, payloadSchema, payload),
        repo.name,
      );
    },
  };
}

// GitHub writes a commit as its first seven hex digits, and a pull request as
// `#` and its number: https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/autolinked-references-and-urls
function commitPage(repository: FullName, sha: string): TitlePage {
  return {
    reference: sha.slice(0, 7),
    titlePageUrl: commitUrl(repository, sha),
  };
}

function pullRequestPage(repository: FullName, number: number): TitlePage {
  return {
    reference: `#${String(number)}`,
    titlePageUrl: pullRequestUrl(repository, number),
  };
}

function linkedToItself(page: TitlePage): TitlePageTarget {
  return { ...page, url: page.titlePageUrl };
}
