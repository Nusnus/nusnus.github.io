/**
 * @file The person the site is about: Tomer Nosrati, his role at the
 * organization he leads, and his accounts on other sites. The dashboard, the
 * head's structured data and the sections read him from here.
 */

import { ownerUrl } from "@nusnus/github-data/github-links";
import { GITHUB_LOGIN } from "@nusnus/github-data/profile";

const ROLE = "CEO & Tech Lead";
const ORGANIZATION = "Celery Organization";
const X_ACCOUNT_NAME = "smilingnosrati";

export const PERSON = {
  celeryOrganizationUrl: ownerUrl("celery"),
  description:
    "Software engineer and open source leader. Creator of pytest-celery, top contributor to Celery.",
  emailUrl: "mailto:tomer.nosrati@gmail.com",
  githubLogin: GITHUB_LOGIN,
  githubUrl: ownerUrl(GITHUB_LOGIN),
  jobTitle: `${ROLE}, ${ORGANIZATION}`,
  knowsAbout: [
    "Distributed Systems",
    "Open Source",
    "Python",
    "Celery",
    "Software Testing",
    "End-to-End Testing",
  ],
  linkedinUrl: "https://www.linkedin.com/in/tomernosrati",
  name: "Tomer Nosrati",
  organization: ORGANIZATION,
  role: ROLE,
  staticAvatarUrl: "https://avatars.githubusercontent.com/u/4662342?v=4",
  xHandle: `@${X_ACCOUNT_NAME}`,
  xUrl: `https://x.com/${X_ACCOUNT_NAME}`,
} as const;
