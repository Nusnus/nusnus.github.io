/**
 * @file Prettier: formats every file kind the project holds, and orders CSS
 * declarations and the site's Tailwind classes.
 */

import type { Config } from "prettier";

export default {
  // prettier-plugin-astro recommends naming the parser for compatibility across
  // package managers.
  overrides: [{ files: "*.astro", options: { parser: "astro" } }],
  // prettier-plugin-tailwindcss must come last, after every plugin whose files
  // it sorts classes in.
  plugins: [
    "prettier-plugin-astro",
    "prettier-plugin-css-order",
    "prettier-plugin-sh",
    "prettier-plugin-toml",
    "prettier-plugin-tailwindcss",
  ],
  // `tw` marks the class strings held outside markup.
  tailwindFunctions: ["tw"],
  tailwindStylesheet: "./packages/site/src/design-system/design-system.css",
} satisfies Config;
