/**
 * @file Schemas: the one home of the schema library, zod's mini build, which
 * every package builds its schemas from and parses outside data through. It
 * gives the builders the project uses; its own types: `Schema`, `Infer` for
 * the data a schema reads and `Encoded` for the JSON it reads it from; `parse`,
 * which returns the data a schema reads from JSON, and `parseOrUndefined`,
 * which returns none for JSON the schema refuses; and `encode`, which turns
 * that data back into its JSON. `parse` and `encode` throw the caller's own
 * error, built from zod's account of every way the data breaks the schema, in
 * English.
 */

import * as z from "zod/mini";

// zod/mini ships no error messages; English ones say what each value got wrong.
z.config(z.locales.en());

export type Schema<Output> = z.ZodMiniType<Output>;

export type Infer<S extends Schema<unknown>> = z.output<S>;

export type Encoded<S extends Schema<unknown>> = z.input<S>;

export function parse<Output>(
  schema: Schema<Output>,
  json: unknown,
  toError: (issues: string) => Error,
): Output {
  const result = schema.safeParse(json);
  if (!result.success) {
    throw toError(z.prettifyError(result.error));
  }
  return result.data;
}

export function parseOrUndefined<Output>(
  schema: Schema<Output>,
  json: unknown,
): Output | undefined {
  const result = schema.safeParse(json);
  return result.success ? result.data : undefined;
}

export function encode<S extends Schema<unknown>>(
  schema: S,
  data: Infer<S>,
  toError: (issues: string) => Error,
): Encoded<S> {
  const result = z.safeEncode(schema, data);
  if (!result.success) {
    throw toError(z.prettifyError(result.error));
  }
  return result.data;
}

export {
  array,
  codec,
  date,
  discriminatedUnion,
  enum,
  int,
  iso,
  literal,
  maxLength,
  minLength,
  nonnegative,
  nullable,
  object,
  optional,
  pipe,
  positive,
  readonly,
  record,
  refine,
  regex,
  startsWith,
  strictObject,
  string,
  templateLiteral,
  transform,
  tuple,
  union,
  unknown,
  url,
} from "zod/mini";
