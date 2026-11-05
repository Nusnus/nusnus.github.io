/**
 * @file The activity feed: a list of the recent events, each a link to what it
 * acted on that opens in a new tab, with its title, repository, type and age,
 * a redacted event in a private project, sliding in one after another; a note
 * when there are none; and, as an island, the page's activity by the page's
 * clock.
 */

import { redactedActivityReply } from "@nusnus/github-data/fixtures/worker-replies";
import { WORKER_ROUTES } from "@nusnus/github-data/routes";
import { describe, expect, it } from "vitest";

import ActivityFeedIsland, {
  ActivityFeed,
} from "../../../../src/github-data/activity/ActivityFeed.tsx";
import { Clock } from "../../../../src/github-data/time/clock.ts";
import { baked } from "../../../fixtures/baked-github-data.ts";
import { render, screen, within } from "../../../fixtures/unit-page.ts";

const CLOCK = new Clock(new Date("2026-11-04T08:20:00Z"), "UTC");

function rows(): HTMLElement[] {
  return within(
    screen.getByRole("list", { name: "Recent GitHub activity" }),
  ).getAllByRole("link");
}

describe("ActivityFeed", () => {
  it("lists each event as a link to what it acted on, with its details", () => {
    render(
      <ActivityFeed clock={CLOCK} events={baked.snapshot.activity.data} />,
    );

    // The first row, a push titled by its commit, and two of the pull
    // requests below it, the last among them.
    expect(
      [rows()[0], rows()[7], rows()[9]].map((row) => [
        row?.textContent,
        row?.getAttribute("href"),
        row?.getAttribute("target"),
      ]),
    ).toStrictEqual([
      [
        "chore(release): 0.0.2 (#35)nustack·Pushed·6 hours ago",
        "https://github.com/Nusnus/nustack/commit/4a4971bbf03f31c673ebe5c23bd8e32918e6cc61",
        "_blank",
      ],
      [
        "feat: Cybernus refactor — single model, direct-to-chat, sub-agents, rich cardsnusnus.github.io·Pull Request·7 hours ago",
        "https://github.com/Nusnus/nusnus.github.io/pull/20",
        "_blank",
      ],
      [
        "feat: Cybernus — replace /chat with Matrix-themed AI digital selfnusnus.github.io·Pull Request·7 hours ago",
        "https://github.com/Nusnus/nusnus.github.io/pull/11",
        "_blank",
      ],
    ]);
  });

  it("lists a redacted event as its type alone, in a private project, linking to its owner", () => {
    const { data } = WORKER_ROUTES.activity.parseReply(redactedActivityReply);

    render(<ActivityFeed clock={CLOCK} events={data.slice(0, 1)} />);

    expect(
      rows().map((row) => [row.textContent, row.getAttribute("href")]),
    ).toStrictEqual([
      [
        "PushPrivate Project·Pushed·4 hours ago",
        "https://github.com/lucasdj-sampaio",
      ],
    ]);
  });

  it("dates each event by its creation instant", () => {
    render(
      <ActivityFeed clock={CLOCK} events={baked.snapshot.activity.data} />,
    );

    expect(screen.getAllByRole("time")[0]?.getAttribute("datetime")).toBe(
      "2026-11-04T02:21:56.000Z",
    );
  });

  it("slides each row in 50ms after the one above it", () => {
    render(
      <ActivityFeed clock={CLOCK} events={baked.snapshot.activity.data} />,
    );

    expect(
      rows()
        .slice(0, 3)
        .map((row) => row.style.animationDelay),
    ).toStrictEqual(["0ms", "50ms", "100ms"]);
  });

  it("says so when there is no recent activity", () => {
    render(<ActivityFeed clock={CLOCK} events={[]} />);

    expect([
      screen.queryByRole("list"),
      screen.getByText("No recent activity").tagName,
    ]).toStrictEqual([null, "P"]);
  });

  it("lists the page's activity as an island", () => {
    render(<ActivityFeedIsland />);

    expect(rows()).toHaveLength(10);
  });
});
