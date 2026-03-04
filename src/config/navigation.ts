/**
 * Navigation configuration.
 *
 * Single source of truth for page section links used in both
 * the desktop Sidebar and MobileNav components.
 */

export interface NavLink {
  href: string;
  label: string;
}

/** Main page section navigation links. */
export const NAV_LINKS: readonly NavLink[] = [
  { href: '#activity', label: 'Contributions' },
  { href: '#collaborations', label: 'Collaborations' },
  { href: '#activity-graph', label: 'Activity Graph' },
  { href: '#projects', label: 'Active Projects' },
  { href: '#celery-organization', label: 'Celery Organization' },
  { href: '#writing', label: 'Writing' },
  { href: '#sponsoring', label: 'Sponsoring' },
] as const;
