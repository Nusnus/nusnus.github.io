const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const dtf = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

/**
 * Returns a human-readable relative time string (e.g. "3 hours ago", "yesterday").
 */
export function relativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = d.getTime() - Date.now();
  const absDiff = Math.abs(diff);

  if (absDiff < MINUTE) return rtf.format(Math.round(diff / SECOND), 'second');
  if (absDiff < HOUR) return rtf.format(Math.round(diff / MINUTE), 'minute');
  if (absDiff < DAY) return rtf.format(Math.round(diff / HOUR), 'hour');
  if (absDiff < 30 * DAY) return rtf.format(Math.round(diff / DAY), 'day');

  return dtf.format(d);
}

/**
 * Formats a date as "March 3, 2026".
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return dtf.format(d);
}

/**
 * Calculates the current contribution streak (consecutive days with count > 0).
 * Counts backwards from today or yesterday.
 */
export function calculateStreak(days: { date: string; contributionCount: number }[]): number {
  if (days.length === 0) return 0;

  const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const day of sorted) {
    const d = new Date(day.date);
    d.setHours(0, 0, 0, 0);

    const diffDays = Math.round((today.getTime() - d.getTime()) / DAY);

    // Allow starting from today or yesterday
    if (diffDays > streak + 1) break;
    if (day.contributionCount > 0) {
      streak++;
    } else if (diffDays > 0) {
      // A zero-contribution day that isn't today breaks the streak
      break;
    }
  }

  return streak;
}

/** Format a number with commas (e.g. 1234 → "1,234"). */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Formats a number with compact notation (e.g. 24000 → "24k").
 */
const cnf = new Intl.NumberFormat('en', { notation: 'compact' });

export function formatCompactNumber(n: number): string {
  return cnf.format(n);
}

/** Short month names for chart/graph labels. */
export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
