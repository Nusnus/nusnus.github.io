/**
 * @file The version of GitHub's REST API the worker requests, pinned so a new
 * default cannot change GitHub's replies under it. The tests' exchanges were
 * recorded under it, and the scheduled expiry check warns before GitHub
 * retires it.
 */

export const GITHUB_API_VERSION = "2026-03-10";
