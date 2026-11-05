/**
 * @file Tailwind class strings held outside markup, such as a variant's classes
 * in a table: `tw` marks each, so Prettier orders its classes as it does in a
 * `class` attribute. It returns the string as written.
 */

export function tw(
  classes: TemplateStringsArray,
  ...interpolated: readonly string[]
): string {
  return String.raw({ raw: classes }, ...interpolated);
}
