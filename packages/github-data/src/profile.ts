/**
 * @file Tomer's GitHub account, by its login, and the part of his GitHub
 * profile the site renders: his avatar, served from GitHub's avatar host, and
 * his follower count.
 */

import { countSchema } from "./formats.ts";
import * as schema from "./schema.ts";

export const GITHUB_LOGIN = "Nusnus";

export const avatarUrlSchema = schema
  .url()
  .check(schema.startsWith("https://avatars.githubusercontent.com/"));

export const profileSchema = schema.readonly(
  schema.strictObject({ avatarUrl: avatarUrlSchema, followers: countSchema }),
);

/** Tomer's GitHub profile: his avatar and his follower count. */
export type Profile = schema.Infer<typeof profileSchema>;
