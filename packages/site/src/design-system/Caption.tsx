/**
 * @file A caption above a group of figures, such as a chart or a list of
 * ranks: small, muted, spaced capitals. Islands render it, and so do Astro
 * components, as static HTML.
 */

import type { ReactNode } from "react";

export function Caption({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <p
      className={`text-xs font-medium tracking-wider text-text-muted uppercase ${className}`}
    >
      {children}
    </p>
  );
}
