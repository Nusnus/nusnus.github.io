/**
 * @file Astro: builds the static site at its public URL with React islands,
 * Tailwind and a sitemap, baking in the GitHub data the worker serves at build
 * time.
 */

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

import {
  bakedGitHubDataPlugin,
  parseWorkerOrigin,
} from "./src/github-data/snapshot/baked-github-data.ts";
import {
  SYSTEM_TIMING,
  WorkerClient,
} from "./src/github-data/snapshot/worker-client.ts";
import { SITE_URL } from "./src/site.ts";

export default defineConfig({
  integrations: [react(), sitemap()],
  site: SITE_URL.href,
  vite: {
    plugins: [
      tailwindcss(),
      bakedGitHubDataPlugin(
        new WorkerClient(
          parseWorkerOrigin(process.env["WORKER_ORIGIN"]),
          fetch,
          SYSTEM_TIMING,
        ),
        () => new Date(),
      ),
    ],
  },
});
