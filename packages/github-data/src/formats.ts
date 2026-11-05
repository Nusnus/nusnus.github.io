/**
 * @file The value formats that several GitHub data replies share: counts of
 * things on GitHub, instants, and a repository's full name, its `owner/name`,
 * which `parseFullName` splits.
 *
 * An instant travels as an ISO 8601 UTC timestamp and is read as a `Date`,
 * through a zod codec, so no reader parses it again, and encoding the `Date`
 * writes the timestamp back.
 *
 * A format's type holds what the format promises wherever TypeScript can say
 * it: a full name is a string with a slash, so the project's own literals, such
 * as a tracked repository's, are full names as written. A count is a number
 * branded `Count`, since no TypeScript type holds "whole and never negative":
 * only `countSchema` makes one.
 */

import * as schema from "./schema.ts";

export const countSchema = schema
  .int()
  .check(schema.nonnegative())
  .brand<"Count">();

export const instantSchema = schema.codec(
  schema.iso.datetime(),
  schema.date(),
  {
    decode: (timestamp) => new Date(timestamp),
    encode: (instant) => instant.toISOString(),
  },
);

// An owner's or a repository's name, either side of the full name's slash.
// The template anchors its whole pattern, so a part's pattern needs no anchors.
const nameSchema = schema.string().check(schema.regex(/[^/]+/));

export const fullNameSchema = schema.templateLiteral(
  [nameSchema, "/", nameSchema],
  { error: "must be a repository's owner/name, such as celery/celery" },
);

export type FullName = schema.Infer<typeof fullNameSchema>;

export function parseFullName(fullName: FullName): {
  readonly name: string;
  readonly owner: string;
} {
  const slash = fullName.indexOf("/");
  return { name: fullName.slice(slash + 1), owner: fullName.slice(0, slash) };
}
