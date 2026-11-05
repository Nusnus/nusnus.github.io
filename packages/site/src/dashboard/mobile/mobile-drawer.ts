/**
 * @file The mobile drawer: the navigation that slides in from the right below
 * the `md` breakpoint when the mobile header's menu button is pressed.
 *
 * The drawer is a `<dialog>` shown as a modal, so the browser keeps focus
 * inside it and the page behind it inert while it is open, removes it from the
 * page while it is closed, and closes it on Escape.
 */

import { elementById } from "../../element-by-id.ts";

/**
 * Opens the mobile drawer from the menu button, and closes it where the browser
 * does not: on a tap on its backdrop, a jump to a page section, or a viewport
 * wide enough for the sidebar.
 */
export class MobileDrawer {
  static readonly DRAWER_ID = "mobile-drawer";
  static readonly MENU_BUTTON_ID = "mobile-menu-button";
  // Tailwind's `md` breakpoint, from which the sidebar replaces the drawer;
  // the drawer's unit test fails once the two differ.
  static readonly SIDEBAR_MEDIA_QUERY = "(width >= 48rem)";

  readonly #dialog: HTMLDialogElement;
  readonly #menuButton: HTMLButtonElement;

  constructor(
    dialog: HTMLDialogElement,
    menuButton: HTMLButtonElement,
    sidebarMedia: MediaQueryList,
  ) {
    this.#dialog = dialog;
    this.#menuButton = menuButton;
    menuButton.addEventListener("click", () => {
      this.open();
    });
    dialog.addEventListener("click", (event) => {
      if (this.#closesDrawer(event.target)) {
        dialog.close();
      }
    });
    dialog.addEventListener("close", () => {
      menuButton.setAttribute("aria-expanded", "false");
    });
    sidebarMedia.addEventListener("change", ({ matches }) => {
      if (matches) {
        dialog.close();
      }
    });
  }

  static attach(window: Window): MobileDrawer {
    return new MobileDrawer(
      elementById(
        window.document,
        MobileDrawer.DRAWER_ID,
        HTMLDialogElement,
        "MobileDrawer.astro",
      ),
      elementById(
        window.document,
        MobileDrawer.MENU_BUTTON_ID,
        HTMLButtonElement,
        "MobileHeader.astro",
      ),
      window.matchMedia(MobileDrawer.SIDEBAR_MEDIA_QUERY),
    );
  }

  open(): void {
    this.#dialog.showModal();
    this.#menuButton.setAttribute("aria-expanded", "true");
  }

  #closesDrawer(target: EventTarget | null): boolean {
    return (
      this.#isBackdrop(target) ||
      (target instanceof Element && target.closest('a[href^="#"]') !== null)
    );
  }

  #isBackdrop(target: EventTarget | null): boolean {
    // The drawer's content fills the dialog, so a click whose target is the
    // dialog itself landed on its backdrop.
    return target === this.#dialog;
  }
}
