/**
 * @file The site's identity: its public URL, which every absolute URL the site
 * gives builds on and which its package.json's `homepage` holds; its name,
 * which page titles and the feed carry; the description a page without its own
 * gives; and the path of its sitemap.
 */

import project from "../package.json" with { type: "json" };
import { PERSON } from "./person.ts";

export const SITE_URL = new URL(project.homepage);

export const SITE_NAME = `${PERSON.name} (${PERSON.githubLogin})`;

export const SITE_DESCRIPTION = `${PERSON.description} Artist who codes.`;

// Where @astrojs/sitemap writes the sitemap's index:
// https://docs.astro.build/en/guides/integrations-guide/sitemap/#usage
export const SITEMAP_PATH = "/sitemap-index.xml";
