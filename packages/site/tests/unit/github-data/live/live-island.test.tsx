/**
 * @file Live islands render the page's live data and follow each change to it.
 * The server renders the initial data, and so does hydration, which then moves
 * on to the live data without a mismatch.
 */

import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, onTestFinished } from "vitest";

import type { Freshness } from "../../../../src/github-data/live/live-data-store.ts";

import { liveIsland } from "../../../../src/github-data/live/live-island.tsx";
import { pageStore } from "../../../../src/github-data/live/page-store.ts";
import { act, render, screen } from "../../../fixtures/unit-page.ts";

function FreshnessText({ freshness }: { freshness: Freshness }) {
  return <p>{freshness}</p>;
}

const LiveFreshness = liveIsland(FreshnessText, ({ freshness }) => ({
  freshness,
}));

function publishFreshness(freshness: Freshness): void {
  pageStore().publish({ ...pageStore().read(), freshness });
}

afterEach(() => {
  pageStore().publish(pageStore().readInitial());
});

describe("liveIsland", () => {
  it("renders the live data and follows each change", () => {
    publishFreshness("live");
    render(<LiveFreshness />);

    act(() => {
      publishFreshness("stale");
    });

    expect(screen.getByRole("paragraph").textContent).toBe("stale");
  });

  it("renders the initial data on the server", () => {
    publishFreshness("live");

    expect(renderToString(<LiveFreshness />)).toBe("<p>baked</p>");
  });

  it("hydrates the server's initial HTML, then shows the live data", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<LiveFreshness />);
    publishFreshness("live");

    const root = await act(async () => {
      const hydrated = hydrateRoot(container, <LiveFreshness />);
      await Promise.resolve();
      return hydrated;
    });
    onTestFinished(() => {
      root.unmount();
    });

    expect(container.innerHTML).toBe("<p>live</p>");
  });
});
