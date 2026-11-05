/**
 * @file Finding an element a component renders for a script to wire up, by its
 * id: it fails, naming what the page should render, when the page lacks it or
 * has another kind of element there.
 */

export function elementById<T extends Element>(
  document: Document,
  id: string,
  type: abstract new () => T,
  renderedBy: string,
): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) {
    throw new TypeError(
      `The page needs a ${type.name} with id "${id}" but has ${element === null ? "none" : `a ${element.tagName.toLowerCase()}`}; render ${renderedBy} on it.`,
    );
  }
  return element;
}
