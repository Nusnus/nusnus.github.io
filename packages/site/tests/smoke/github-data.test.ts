/**
 * @file The built page's GitHub data, baked from the recorded worker replies:
 * each section and sidebar slot renders it, no island carries it in its props,
 * and the live refresh updates every value from the worker, flashing what
 * changed, or, when the worker fails, keeps the baked values and says so.
 */

import type { Locator, Page } from "@playwright/test";

import { bodyTextOf } from "@nusnus/github-data/fixtures/exchange";
import {
  profileReply,
  profileUnavailableExchange,
  repositoriesReply,
} from "@nusnus/github-data/fixtures/worker-replies";
import { WORKER_ROUTES } from "@nusnus/github-data/routes";

import { THEMES } from "../../src/theme/theme.ts";
import { WORKER_REPLAY } from "../fixtures/servers.ts";
import {
  expect,
  expectAccessible,
  test,
  VIEWPORTS,
} from "../fixtures/smoke-page.ts";

// Two hours after the oldest recorded reply was fetched.
const NOW = new Date("2026-11-04T09:20:00Z");

const [PHONE, , , DESKTOP] = VIEWPORTS;

const activityPanel = (page: Page) =>
  page.getByRole("complementary", { name: "Live activity panel" });

const contributionOverview = (page: Page) =>
  page.getByRole("region", { name: "Activity overview" });

const sidebar = (page: Page) => page.locator("aside").first();

async function untilHydrated(content: Locator): Promise<void> {
  await content.scrollIntoViewIfNeeded();
  await expect(
    content.locator("xpath=ancestor::astro-island[1]"),
  ).not.toHaveAttribute("ssr");
}

async function untilRefreshed(page: Page, status: string): Promise<void> {
  await expect(
    activityPanel(page).getByText(status, { exact: true }),
  ).toBeAttached();
}

async function boxOf(
  locator: Locator,
): Promise<{ height: number; width: number; x: number; y: number }> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error(`${String(locator)} has no box, since it is not visible.`);
  }
  return box;
}

function isWorkerRoute(url: URL): boolean {
  return Object.values(WORKER_ROUTES).some(({ path }) => url.pathname === path);
}

async function serveAsWorker(
  page: Page,
  path: string,
  reply: unknown,
): Promise<void> {
  await page.route(`**${path}`, (route) =>
    route.fulfill({
      headers: { "access-control-allow-origin": "*" },
      json: reply,
    }),
  );
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize(DESKTOP);
});

test("no island carries the GitHub data in its props", async ({ page }) => {
  await page.goto("/");

  const props = await page
    .locator("astro-island")
    .evaluateAll((islands) =>
      islands.map((island) => island.getAttribute("props")),
    );
  expect(new Set(props)).toStrictEqual(new Set(["{}"]));
});

test("the activity overview shows the heatmap, the year's counts and the achievements", async ({
  page,
}) => {
  await page.goto("/");
  const section = contributionOverview(page);

  await expect(
    section.getByRole("img", {
      name: "GitHub contribution graph showing 5465 contributions in the last year",
    }),
  ).toBeVisible();
  // The streak is rendered for the day the build ran, which the page's fixed
  // clock does not reach.
  await expect(section).toContainText(
    /5\.5Kcontributions.*day streak639commits85pull requests/,
  );
  await expect(section).toContainText(
    "Achievements⭐43KTotal Starsacross maintained repos🏆#4Contributorcelery/celery🏗️Creatorpytest-celeryoriginal author👀65Code Reviewsthis year👥120Followerson GitHub",
  );
});

for (const theme of THEMES) {
  test(`in the ${theme} theme, hovering a day of the heatmap shows its count just above it, inside the heatmap and accessibly`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/");
    const heatmap = contributionOverview(page).getByRole("img", {
      name: /^GitHub contribution graph/,
    });
    await untilHydrated(heatmap);
    const day = heatmap.locator("rect").last();

    await day.hover();

    const tooltip = page.getByText(/^24 contributionsNovember 4, 2026$/);
    const [dayBox, tooltipBox] = await Promise.all([
      boxOf(day),
      boxOf(tooltip),
    ]);
    // The tooltip's bottom sits 8px above the day, and its right edge on the
    // day's, within the rounding of their boxes.
    const bottomGap = tooltipBox.y + tooltipBox.height + 8 - dayBox.y;
    const rightOffset =
      tooltipBox.x + tooltipBox.width - (dayBox.x + dayBox.width);
    expect(Math.abs(bottomGap)).toBeLessThan(2);
    expect(Math.abs(rightOffset)).toBeLessThan(2);
    await expectAccessible(
      page,
      '[role="img"][aria-label^="GitHub contribution graph"]',
    );
  });
}

test("the activity graphs show the last 30 days and the monthly bars", async ({
  page,
}) => {
  await page.goto("/");
  const section = page.getByRole("region", { name: "Activity graphs" });

  await expect(
    section
      .getByRole("img", { name: "Daily contribution line chart" })
      .locator("circle"),
  ).toHaveCount(30);
  await expect(
    section
      .getByRole("img", { name: "Monthly GitHub activity chart" })
      .locator("rect[rx]"),
  ).toHaveCount(13);
});

test("the active projects and the Celery organization show a card per tracked repository", async ({
  page,
}) => {
  await page.goto("/");
  const projects = page.getByRole("region", { name: "Active projects" });
  const organization = page.getByRole("region", {
    name: "Celery Organization",
  });

  const commitsLinks = { name: /^Contributions to / };

  await expect(projects.getByRole("link", commitsLinks)).toHaveCount(3);
  await expect(organization.getByRole("link", commitsLinks)).toHaveCount(9);
  await expect(organization).toContainText(
    "Additional repositories I contribute to across the Celery organization",
  );
  await expect(projects).toContainText(
    "celery/celeryOwnerDistributed Task Queue (development branch)29Kstars5.3KforksPythonUpdated 11 hours ago#4 contributorContributions to celery/celery",
  );
});

test("the sidebar shows presence, the year's counts and the ranks", async ({
  page,
}) => {
  await page.goto("/");
  const rankings = sidebar(page).getByRole("list");
  await untilHydrated(rankings);

  await expect(sidebar(page).getByText("Active today")).toBeAttached();
  await expect(sidebar(page)).toContainText(
    "5.5K contributions this year639 commits85 PRs65 reviews0 issues",
  );
  await expect(rankings.getByRole("link")).toHaveText([
    "pytest-celery#1",
    "celery#4",
    "celeryproject#4",
    "billiard#5",
    "sphinx_celery#5",
    "vine#7",
    "kombu#8",
    "py-amqp#9",
    "django-celery-beat#19",
    "librabbitmq#25",
    "flower#25",
    "django-celery-results#33",
  ]);
});

test("the mobile drawer shows the year's total and the ranks", async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await page.goto("/");

  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const drawer = page.getByRole("dialog", { name: "Mobile navigation" });

  await expect(drawer).toContainText("5.5K contributions this year");
  await expect(drawer.getByRole("list").getByRole("link")).toHaveCount(12);
});

test("the activity panel lists the recent activity and says when it was updated", async ({
  page,
}) => {
  await page.goto("/");
  const panel = activityPanel(page);

  await untilRefreshed(page, "Live");
  await expect(
    panel
      .getByRole("list", { name: "Recent GitHub activity" })
      .getByRole("link"),
  ).toHaveCount(10);
  await expect(panel).toContainText("Updated 2 hours ago");
});

test("the live refresh updates every value from the worker and flashes what changed", async ({
  page,
}) => {
  // No later fetch can be recorded on demand, so these edit the recorded
  // replies by hand into what the worker would serve once the data changed.
  await serveAsWorker(page, WORKER_ROUTES.profile.path, {
    data: { ...profileReply.data, followers: 121 },
    fetchedAt: "2026-11-04T09:18:00Z",
  });
  await serveAsWorker(page, WORKER_ROUTES.repositories.path, {
    data: {
      ...repositoriesReply.data,
      "celery/celery": {
        ...repositoriesReply.data["celery/celery"],
        stars: 31_000,
      },
      "celery/kombu": {
        ...repositoriesReply.data["celery/kombu"],
        contributorRank: 2,
      },
    },
    fetchedAt: "2026-11-04T09:18:00Z",
  });
  await page.goto("/");
  const section = contributionOverview(page);
  await untilHydrated(section.getByText("Total Stars"));
  await untilHydrated(sidebar(page).getByRole("list"));

  await untilRefreshed(page, "Live");

  const celeryStars = sidebar(page).locator('[data-live="celeryStars"]');
  const totalCommits = sidebar(page).locator('[data-live="totalCommits"]');
  await expect(celeryStars).toHaveText("31K");
  await expect(celeryStars).toHaveAttribute("data-refreshed");
  await expect(celeryStars).toHaveCSS("animation-name", "data-refresh");
  await expect(totalCommits).not.toHaveAttribute("data-refreshed");
  await expect(totalCommits).toHaveCSS("animation-name", "none");
  await expect(section).toContainText("45KTotal Stars");
  await expect(section).toContainText("121Followers");
  await expect(
    sidebar(page).getByRole("list").getByRole("link").nth(1),
  ).toHaveText("kombu#2");
});

test.describe("when the worker fails", () => {
  const failedLoad =
    "console.error: Failed to load resource: the server responded with a status of 502 (Bad Gateway)";
  const workerSays =
    "it says: GitHub data for /profile is unavailable, and the worker has no cached reply to serve: " +
    'GitHub answered GET /users/Nusnus with 403: {"message":"API rate limit exceeded for 203.0.113.7. ' +
    "(But here's the good news: Authenticated requests get a higher rate limit. Check out the documentation for more details.)\"," +
    '"documentation_url":"https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting"}\n' +
    "GitHub allows requests again at 2026-11-04T08:20:04.000Z.\n" +
    "The worker asks GitHub again at 2026-11-04T08:20:04.000Z.";

  test.use({
    // Each route fails once, since an error the worker sent is final, and
    // the refresh warns of each route's failure in the worker's words.
    expectedProblems: [
      failedLoad,
      failedLoad,
      failedLoad,
      failedLoad,
      `console.warning: Live GitHub data is unavailable, so the page shows older data: The worker answered ${WORKER_REPLAY.url}/activity with HTTP 502; ${workerSays}`,
      `console.warning: Live GitHub data is unavailable, so the page shows older data: The worker answered ${WORKER_REPLAY.url}/contribution-graph with HTTP 502; ${workerSays}`,
      `console.warning: Live GitHub data is unavailable, so the page shows older data: The worker answered ${WORKER_REPLAY.url}/profile with HTTP 502; ${workerSays}`,
      `console.warning: Live GitHub data is unavailable, so the page shows older data: The worker answered ${WORKER_REPLAY.url}/repositories with HTTP 502; ${workerSays}`,
    ],
  });

  test("the page keeps the baked values and says the live data is unavailable", async ({
    page,
  }) => {
    // A row fading in mid-animation is not low in contrast once it settles;
    // axe judges the settled panel.
    await page.emulateMedia({ reducedMotion: "reduce" });
    // The worker's recorded 502, sent while GitHub refused it and it had no
    // cached reply, for every route.
    await page.route(isWorkerRoute, (route) =>
      route.fulfill({
        ...profileUnavailableExchange,
        body: bodyTextOf(profileUnavailableExchange) ?? "",
      }),
    );
    await page.goto("/");
    const panel = activityPanel(page);

    await untilRefreshed(page, "Live data unavailable, showing older data");

    await expect(panel).toContainText("Updated 2 hours ago");
    await expect(sidebar(page).locator('[data-live="celeryStars"]')).toHaveText(
      "29K",
    );
    await expect(
      panel
        .getByRole("list", { name: "Recent GitHub activity" })
        .getByRole("link"),
    ).toHaveCount(10);
    await expectAccessible(page, '[aria-label="Live activity panel"]');
  });
});
