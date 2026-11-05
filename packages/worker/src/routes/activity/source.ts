/**
 * @file The activity route's source: Tomer's latest public events, from
 * GitHub's Events API, as `recent-events.ts` picks, names or redacts them, with
 * the titles the Events API lacks looked up in one GraphQL query.
 *
 * GitHub can add event types, and can lose a pull request or a commit an event
 * acted on; such an event is skipped, and logged, rather than failing the whole
 * activity reply.
 */

import type { ActivityEvent } from "@nusnus/github-data/activity";

import { GITHUB_LOGIN } from "@nusnus/github-data/profile";
import { WORKER_ROUTES } from "@nusnus/github-data/routes";

import {
  NEXT_STEP_IF_LOGIN_NOT_FOUND,
  type RouteSource,
} from "../route-source.ts";
import {
  githubEventsSchema,
  recentEvents,
  titledEvents,
  titlePageTargets,
} from "./recent-events.ts";
import { lookUpTitles } from "./titles.ts";

export const activitySource: RouteSource<readonly ActivityEvent[]> = {
  // Recent activity changes the most often of the routes, and a refresh costs
  // one request, plus one when a recent event lacks its title.
  freshForSeconds: 60,
  route: WORKER_ROUTES.activity,
  async fetchData(github) {
    // GitHub's default page of events leaves room for skipped ones:
    // https://docs.github.com/en/rest/activity/events#list-public-events-for-a-user
    const recent = recentEvents(
      await github.get({
        nextStepIfNotFound: NEXT_STEP_IF_LOGIN_NOT_FOUND,
        pathAndQuery: `/users/${GITHUB_LOGIN}/events/public`,
        replySchema: githubEventsSchema,
      }),
    );
    if (recent.skippedTypes.length > 0) {
      console.warn(
        `Skipped GitHub events of types the github-data contract does not hold: ${recent.skippedTypes.join(", ")}. ` +
          "Add each type to the contract and the site to show it.",
      );
    }
    const { events, missingPages } = titledEvents(
      recent,
      await lookUpTitles(github, titlePageTargets(recent)),
    );
    if (missingPages.length > 0) {
      console.warn(
        `Skipped recent events on pull requests or commits GitHub no longer has: ${missingPages.join(", ")}.`,
      );
    }
    return events;
  },
};
