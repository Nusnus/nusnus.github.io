/**
 * @file The page the site's unit tests render into, happy-dom's: its window's
 * controls, such as its viewport; Testing Library, the one home of the
 * library, whose renders it removes after each test; and `findElement`, which
 * finds an element or fails naming what it looked for.
 */

import type { Window as HappyDOMWindow } from "happy-dom";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

export { act, fireEvent, render, screen, within } from "@testing-library/react";

// Vitest's globals are off, so Testing Library cannot register its own cleanup:
// https://testing-library.com/docs/react-testing-library/api#cleanup
afterEach(() => {
  cleanup();
});

// happy-dom gives its window's controls, such as the viewport, through a
// property the DOM's own Window type lacks.
export const { happyDOM } = window as unknown as HappyDOMWindow;

export function findElement<T extends Element = Element>(
  root: ParentNode,
  selector: string,
  { index = 0, type }: { index?: number; type?: abstract new () => T } = {},
): T {
  const found = root.querySelectorAll(selector)[index];
  if (found === undefined || (type !== undefined && !(found instanceof type))) {
    throw new TypeError(
      `The test page has no ${type?.name ?? "element"} at ${selector}, match ${String(index)}.`,
    );
  }
  return found as T;
}
