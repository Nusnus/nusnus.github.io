/**
 * @file The colour of a repository's language dot: the colour GitHub gives the
 * language, from Linguist's list at
 * https://github.com/github-linguist/linguist/blob/main/lib/linguist/languages.yml,
 * or muted grey for a language the list here does not hold.
 */

const LANGUAGE_COLORS: ReadonlyMap<string, string> = new Map([
  ["C", "#555555"],
  ["C++", "#f34b7d"],
  ["CSS", "#663399"],
  ["Go", "#00ADD8"],
  ["HTML", "#e34c26"],
  ["JavaScript", "#f1e05a"],
  ["Python", "#3572A5"],
  ["Rust", "#dea584"],
  ["Shell", "#89e051"],
  ["TypeScript", "#3178c6"],
]);

export function languageColor(language: string): string {
  return LANGUAGE_COLORS.get(language) ?? "var(--color-text-muted)";
}
