/**
 * @file The reading-progress bar scales to the share of the page scrolled past,
 * from the first paint, as the reader scrolls, and as a resize of the window
 * or of the page changes how far the page scrolls; it stays empty on a page too
 * short to scroll.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReadingProgress } from "../../../src/writing/reading-progress.ts";
import { findElement, happyDOM } from "../../fixtures/unit-page.ts";

const VIEWPORT_HEIGHT = 800;

const bar = () =>
  findElement(document, "#reading-progress", { type: HTMLElement });

function layOut(pageHeight: number, scrolledTo: number): void {
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: pageHeight,
  });
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value: scrolledTo,
  });
}

beforeEach(() => {
  happyDOM.setViewport({ height: VIEWPORT_HEIGHT, width: 1024 });
  document.body.innerHTML = '<div id="reading-progress"></div>';
});

describe("ReadingProgress", () => {
  it("shows how far the page is scrolled as soon as it is attached", () => {
    layOut(VIEWPORT_HEIGHT + 400, 100);

    ReadingProgress.attach(window);

    expect(bar().style.scale).toBe("0.25 1");
  });

  it("follows the reader's scrolling, full at the end of the page", () => {
    layOut(VIEWPORT_HEIGHT + 400, 0);
    ReadingProgress.attach(window);

    layOut(VIEWPORT_HEIGHT + 400, 400);
    window.dispatchEvent(new Event("scroll"));

    expect(bar().style.scale).toBe("1 1");
  });

  it("stays full when the page overscrolls past its end", () => {
    layOut(VIEWPORT_HEIGHT + 400, 500);

    ReadingProgress.attach(window);

    expect(bar().style.scale).toBe("1 1");
  });

  it("follows a resize that changes how far the page scrolls", () => {
    layOut(VIEWPORT_HEIGHT + 400, 200);
    ReadingProgress.attach(window);

    layOut(VIEWPORT_HEIGHT + 800, 200);
    window.dispatchEvent(new Event("resize"));

    expect(bar().style.scale).toBe("0.25 1");
  });

  it("follows a change in the page's own height, which no window event reports", () => {
    // happy-dom lays nothing out, so its ResizeObserver never reports.
    let reportResize = () => undefined;
    const observe = vi.fn<(target: Element) => void>();
    vi.stubGlobal(
      "ResizeObserver",
      vi.fn(function (callback: () => undefined) {
        reportResize = callback;
        return { observe };
      }),
    );
    layOut(VIEWPORT_HEIGHT + 400, 200);
    ReadingProgress.attach(window);

    layOut(VIEWPORT_HEIGHT + 800, 200);
    reportResize();

    expect([observe.mock.calls, bar().style.scale]).toStrictEqual([
      [[document.documentElement]],
      "0.25 1",
    ]);
  });

  it("stays empty on a page too short to scroll", () => {
    layOut(VIEWPORT_HEIGHT, 0);

    ReadingProgress.attach(window);

    expect(bar().style.scale).toBe("0 1");
  });

  it("refuses to attach to a page without the bar, naming what renders it", () => {
    document.body.innerHTML = "";

    expect(() => ReadingProgress.attach(window)).toThrow(
      new TypeError(
        'The page needs a HTMLElement with id "reading-progress" but has none; render the article page\'s reading-progress bar on it.',
      ),
    );
  });
});
