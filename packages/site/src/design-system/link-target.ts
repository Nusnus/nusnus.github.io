/**
 * @file Where a link opens: a link to another site opens in a new tab, without
 * giving that site a handle on this one; a link within the site opens in place.
 */

/** A link's `rel` and `target`: both set for a new tab, or neither. */
export type LinkTarget =
  | { readonly rel: "noopener noreferrer"; readonly target: "_blank" }
  | { readonly rel?: never; readonly target?: never };

export function linkTarget(href: string): LinkTarget {
  return /^https?:\/\//.test(href)
    ? { rel: "noopener noreferrer", target: "_blank" }
    : {};
}
