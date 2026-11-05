/**
 * @file The deployed worker's profile route, which the scripts ask: the expiry
 * check reads the worker's access to GitHub from its reply, and the deploy
 * waits until its reply names the version it deployed.
 */

import { WORKER_ORIGIN, WORKER_ROUTES } from "@nusnus/github-data/routes";

export const WORKER_PROFILE_URL =
  WORKER_ROUTES.profile.urlAt(WORKER_ORIGIN).href;
