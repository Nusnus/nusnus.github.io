/**
 * @file How the activity feed shows an event: its title, the repository it
 * names, the label for its type, and its type's icon, coloured for the type. A
 * named event's title is what it acted on, prefixed where the type alone would
 * not say how, as in "Review: Fix the retry loop". A redacted event names
 * neither its repository nor what it acted on, only its type, in words.
 */

import type { ActivityEvent, EventType } from "@nusnus/github-data/activity";
import type { ReactElement } from "react";

import { parseFullName } from "@nusnus/github-data/formats";

import {
  Activity,
  CircleCheck,
  CirclePlus,
  GitCommitHorizontal,
  GitPullRequest,
  type LucideIcon,
  MessageSquare,
} from "../../design-system/icons.ts";
import { tw } from "../../design-system/tailwind.ts";

/** What the activity feed shows of one event. */
export interface EventDisplay {
  readonly icon: ReactElement;
  readonly repositoryName: string;
  readonly title: string;
  readonly typeLabel: string;
}

/**
 * How the activity feed shows every event of one type: its icon and the icon's
 * colour, its label, and the prefix of a named event's title.
 */
interface TypeDisplay {
  readonly colorClass: string;
  readonly Icon: LucideIcon;
  readonly label: string;
  readonly titlePrefix?: "Comment" | "Review";
}

const REDACTED_REPOSITORY_NAME = "Private Project";

const TYPE_DISPLAYS = {
  CommitCommentEvent: {
    colorClass: tw`text-purple-400`,
    Icon: MessageSquare,
    label: "Commented",
    titlePrefix: "Comment",
  },
  CreateEvent: {
    colorClass: tw`text-status-active`,
    Icon: CirclePlus,
    label: "Created",
  },
  DeleteEvent: {
    colorClass: tw`text-red-400`,
    Icon: Activity,
    label: "Deleted",
  },
  DiscussionEvent: {
    colorClass: tw`text-text-secondary`,
    Icon: Activity,
    label: "Discussion",
  },
  ForkEvent: {
    colorClass: tw`text-text-secondary`,
    Icon: Activity,
    label: "Forked",
  },
  GollumEvent: {
    colorClass: tw`text-text-secondary`,
    Icon: Activity,
    label: "Wiki",
  },
  IssueCommentEvent: {
    colorClass: tw`text-purple-400`,
    Icon: MessageSquare,
    label: "Commented",
    titlePrefix: "Comment",
  },
  IssuesEvent: {
    colorClass: tw`text-orange-400`,
    Icon: Activity,
    label: "Issue",
  },
  MemberEvent: {
    colorClass: tw`text-text-secondary`,
    Icon: Activity,
    label: "Member",
  },
  PublicEvent: {
    colorClass: tw`text-text-secondary`,
    Icon: Activity,
    label: "Made public",
  },
  PullRequestEvent: {
    colorClass: tw`text-status-active`,
    Icon: GitPullRequest,
    label: "Pull Request",
  },
  PullRequestReviewCommentEvent: {
    colorClass: tw`text-blue-400`,
    Icon: CircleCheck,
    label: "Reviewed",
    titlePrefix: "Review",
  },
  PullRequestReviewEvent: {
    colorClass: tw`text-blue-400`,
    Icon: CircleCheck,
    label: "Reviewed",
    titlePrefix: "Review",
  },
  PushEvent: {
    colorClass: tw`text-accent`,
    Icon: GitCommitHorizontal,
    label: "Pushed",
  },
  ReleaseEvent: {
    colorClass: tw`text-accent`,
    Icon: Activity,
    label: "Released",
  },
  WatchEvent: {
    colorClass: tw`text-text-secondary`,
    Icon: Activity,
    label: "Starred",
  },
} as const satisfies Record<EventType, TypeDisplay>;

export function displayEvent(event: ActivityEvent): EventDisplay {
  const display: TypeDisplay = TYPE_DISPLAYS[event.type];
  const { colorClass, Icon, label, titlePrefix } = display;
  const icon = <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${colorClass}`} />;
  if (event.redacted) {
    return {
      icon,
      repositoryName: REDACTED_REPOSITORY_NAME,
      title: typeName(event.type),
      typeLabel: label,
    };
  }
  return {
    icon,
    repositoryName: parseFullName(event.repository).name,
    title:
      titlePrefix === undefined
        ? event.title
        : `${titlePrefix}: ${event.title}`,
    typeLabel: label,
  };
}

// GitHub names each type in PascalCase with an "Event" suffix, such as
// `PullRequestEvent`, which reads as "Pull Request".
function typeName(type: EventType): string {
  return type.slice(0, -"Event".length).replaceAll(/(?<=[a-z])(?=[A-Z])/g, " ");
}
