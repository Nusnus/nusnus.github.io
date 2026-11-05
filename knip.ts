/**
 * @file knip: fails on any file, export, dependency or binary that nothing
 * uses, in every workspace.
 */

import type { KnipConfig } from "knip";

export default {
  // Binaries no package.json installs: mise, which the pinned-tools check
  // asks, and the tools mise.toml pins that package.json's scripts run.
  // ShellCheck, which lint:shell runs through xargs, knip does not see.
  ignoreBinaries: ["actionlint", "mise", "zizmor"],
  // The contract's package exports every module, so each is an entry file,
  // whose exports knip checks only when told to.
  includeEntryExports: true,
} satisfies KnipConfig;
