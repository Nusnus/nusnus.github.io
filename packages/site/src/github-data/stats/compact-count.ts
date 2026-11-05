/**
 * @file A count as the site shows it where space is short, such as a star count
 * or a contribution total: compact, such as "29K" or "5.3K".
 */

import { SITE_LOCALE } from "../../locale.ts";

const COMPACT = new Intl.NumberFormat(SITE_LOCALE, { notation: "compact" });

export function compactCount(count: number): string {
  return COMPACT.format(count);
}
