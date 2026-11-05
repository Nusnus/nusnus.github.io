/**
 * @file A status light: a coloured dot, pulsing where the status is ongoing,
 * and its meaning in words for screen readers, such as the live indicator's;
 * and a status's display, its colour and meaning, which an island keeps for
 * each status it shows.
 */

/** What a status light shows for one status: its colour and its meaning. */
export interface StatusDisplay {
  readonly colorClass: string;
  readonly text: string;
}

export function StatusLight({
  colorClass,
  pulses,
  sizeClass,
  text,
}: StatusDisplay & { pulses: boolean; sizeClass: string }) {
  return (
    <span className={`relative flex ${sizeClass}`}>
      {pulses && (
        <span
          aria-hidden="true"
          className={`absolute inline-flex h-full w-full animate-pulse-dot rounded-full opacity-75 motion-reduce:hidden ${colorClass}`}
        />
      )}
      <span
        aria-hidden="true"
        className={`relative inline-flex rounded-full ${sizeClass} ${colorClass}`}
      />
      <span className="sr-only">{text}</span>
    </span>
  );
}
