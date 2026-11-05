/**
 * @file The reading-progress bar at the top of an article's page: a bar that
 * grows from the left as the reader scrolls, full width at the end of the page.
 * It follows scrolling, and any resize of the window or of the page itself,
 * such as a late font's, that changes how far the page scrolls.
 */

import { elementById } from "../element-by-id.ts";

/**
 * Grows the reading-progress bar with how far the reader has scrolled the
 * article.
 */
export class ReadingProgress {
  static readonly ELEMENT_ID = "reading-progress";

  readonly #bar: HTMLElement;
  readonly #window: Window;

  constructor(bar: HTMLElement, window: Window) {
    this.#bar = bar;
    this.#window = window;
    const update = () => {
      this.#update();
    };
    window.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    new ResizeObserver(update).observe(window.document.documentElement);
    update();
  }

  static attach(window: Window): ReadingProgress {
    return new ReadingProgress(
      elementById(
        window.document,
        ReadingProgress.ELEMENT_ID,
        HTMLElement,
        "the article page's reading-progress bar",
      ),
      window,
    );
  }

  #update(): void {
    const scrollable =
      this.#window.document.documentElement.scrollHeight -
      this.#window.innerHeight;
    const progress =
      scrollable > 0 ? Math.min(this.#window.scrollY / scrollable, 1) : 0;
    this.#bar.style.scale = `${String(progress)} 1`;
  }
}
