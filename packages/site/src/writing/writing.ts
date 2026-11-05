/**
 * @file Tomer's writing as a whole: the summary of what it is about, which the
 * home page's Writing section gives, and as a sentence, the Writing page's
 * description and the feed's; the title of its feed; and the paths of the feed
 * and the Writing page, which links to them name.
 */

import { SITE_NAME } from "../site.ts";

const SUMMARY =
  "Thoughts on distributed systems, open source leadership, and software engineering philosophy";

export const WRITING = {
  description: `${SUMMARY}.`,
  // Astro serves each page at its file's path under pages/: these are
  // rss.xml.ts's and blog.astro's, which the smoke tests request.
  feedPath: "/rss.xml",
  feedTitle: `${SITE_NAME} — Writing`,
  pagePath: "/blog/",
  summary: SUMMARY,
} as const;
