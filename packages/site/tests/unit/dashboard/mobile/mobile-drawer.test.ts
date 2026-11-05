/**
 * @file The mobile drawer opens as a modal from the menu button, and closes on
 * a tap on its backdrop, on a jump to a page section, and when the viewport
 * widens to Tailwind's `md` breakpoint, where the sidebar shows, keeping the
 * menu button's expanded state in step; it refuses a page that lacks the
 * drawer or the menu button.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import { MobileDrawer } from "../../../../src/dashboard/mobile/mobile-drawer.ts";
import {
  findElement,
  fireEvent,
  happyDOM,
} from "../../../fixtures/unit-page.ts";

const NARROW = 375;
const SIDEBAR_MIN_WIDTH = 768;

const BREAKPOINT_MD = /--breakpoint-md: ([^;]+);/;

const DRAWER_PAGE = `
  <button id="mobile-menu-button" aria-expanded="false"></button>
  <dialog id="mobile-drawer">
    <div>
      <p>CEO & Tech Lead</p>
      <a href="#writing"><span>Writing</span></a>
      <a href="https://github.com/Nusnus">GitHub</a>
    </div>
  </dialog>`;

const dialog = () =>
  findElement(document, "dialog", { type: HTMLDialogElement });
const menuButton = () => findElement(document, "#mobile-menu-button");

function renderDrawer(width: number): void {
  happyDOM.setViewport({ width });
  document.body.innerHTML = DRAWER_PAGE;
  MobileDrawer.attach(window);
}

// A test page never leaves for a link's target.
window.addEventListener("click", (event) => {
  event.preventDefault();
});

describe("MobileDrawer", () => {
  it("opens as a modal when the menu button is pressed, marking the button expanded", () => {
    renderDrawer(NARROW);

    fireEvent.click(menuButton());

    expect([
      dialog().open,
      menuButton().getAttribute("aria-expanded"),
    ]).toStrictEqual([true, "true"]);
  });

  it("closes on a tap on its backdrop, marking the menu button collapsed", () => {
    renderDrawer(NARROW);
    fireEvent.click(menuButton());

    fireEvent.click(dialog());

    expect([
      dialog().open,
      menuButton().getAttribute("aria-expanded"),
    ]).toStrictEqual([false, "false"]);
  });

  it("stays open on a tap on its content", () => {
    renderDrawer(NARROW);
    fireEvent.click(menuButton());

    fireEvent.click(findElement(document, "dialog p"));

    expect(dialog().open).toBe(true);
  });

  it("closes on a jump to a page section", () => {
    renderDrawer(NARROW);
    fireEvent.click(menuButton());

    fireEvent.click(findElement(document, 'a[href="#writing"] span'));

    expect(dialog().open).toBe(false);
  });

  it("stays open on a link to another site, which opens in a new tab", () => {
    renderDrawer(NARROW);
    fireEvent.click(menuButton());

    fireEvent.click(findElement(document, 'a[href^="https:"]'));

    expect(dialog().open).toBe(true);
  });

  it("watches for Tailwind's md breakpoint, which the design system leaves as Tailwind sets it", () => {
    const { resolve } = createRequire(import.meta.url);
    const breakpointIn = (stylesheet: string) =>
      BREAKPOINT_MD.exec(readFileSync(resolve(stylesheet), "utf8"))?.[1];

    expect([
      breakpointIn("../../../../src/design-system/design-system.css"),
      breakpointIn("tailwindcss/theme.css"),
      MobileDrawer.SIDEBAR_MEDIA_QUERY,
    ]).toStrictEqual([undefined, "48rem", "(width >= 48rem)"]);
  });

  it("closes when the viewport widens to show the sidebar", () => {
    renderDrawer(NARROW);
    fireEvent.click(menuButton());

    happyDOM.setViewport({ width: SIDEBAR_MIN_WIDTH });

    expect(dialog().open).toBe(false);
  });

  it("stays open when the viewport widens but stays too narrow for the sidebar", () => {
    renderDrawer(NARROW);
    fireEvent.click(menuButton());

    happyDOM.setViewport({ width: SIDEBAR_MIN_WIDTH - 1 });

    expect(dialog().open).toBe(true);
  });

  it("stays open when the viewport narrows", () => {
    renderDrawer(SIDEBAR_MIN_WIDTH);
    // happy-dom reports a media query's first change on the first resize,
    // whatever the query matched before; spend it while the drawer is closed.
    window.dispatchEvent(new Event("resize"));
    fireEvent.click(menuButton());

    happyDOM.setViewport({ width: NARROW });

    expect(dialog().open).toBe(true);
  });

  it("attaches to a page with the drawer and the menu button alone", () => {
    document.body.innerHTML =
      '<dialog id="mobile-drawer"></dialog><button id="mobile-menu-button"></button>';

    expect(MobileDrawer.attach(window)).toBeInstanceOf(MobileDrawer);
  });

  it.each([
    [
      "no drawer",
      '<button id="mobile-menu-button"></button>',
      'The page needs a HTMLDialogElement with id "mobile-drawer" but has none; render MobileDrawer.astro on it.',
    ],
    [
      "a div where the drawer goes",
      '<div id="mobile-drawer"></div><button id="mobile-menu-button"></button>',
      'The page needs a HTMLDialogElement with id "mobile-drawer" but has a div; render MobileDrawer.astro on it.',
    ],
    [
      "no menu button",
      '<dialog id="mobile-drawer"></dialog>',
      'The page needs a HTMLButtonElement with id "mobile-menu-button" but has none; render MobileHeader.astro on it.',
    ],
  ])("refuses a page with %s, naming what renders it", (_, html, message) => {
    document.body.innerHTML = html;

    expect(() => MobileDrawer.attach(window)).toThrow(new TypeError(message));
  });
});
