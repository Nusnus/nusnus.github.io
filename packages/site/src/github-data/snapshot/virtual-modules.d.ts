/**
 * @file The modules the build's plugins generate, which no file holds. A module
 * name here must be a literal, so it repeats `BAKED_GITHUB_DATA_MODULE`; should
 * the two drift apart, the build fails to resolve the module's import.
 */

declare module "virtual:baked-github-data" {
  const baked: import("./baked-github-data.ts").EncodedBakedGitHubData;
  export default baked;
}
