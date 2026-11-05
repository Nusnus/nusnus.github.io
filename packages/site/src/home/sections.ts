/**
 * @file The home page's sections below the hero, in page order: each one's
 * anchor id, which stays as published since links point there, the name
 * screen readers announce for it, and the label its navigation link shows.
 */

export const HOME_SECTIONS = [
  { id: "activity", name: "Activity overview", navLabel: "Contributions" },
  {
    id: "collaborations",
    name: "Collaborations and recognition",
    navLabel: "Collaborations",
  },
  { id: "activity-graph", name: "Activity graphs", navLabel: "Activity Graph" },
  { id: "projects", name: "Active projects", navLabel: "Active Projects" },
  {
    id: "celery-organization",
    name: "Celery Organization",
    navLabel: "Celery Organization",
  },
  { id: "writing", name: "Writing", navLabel: "Writing" },
  { id: "sponsoring", name: "Sponsor Celery", navLabel: "Sponsoring" },
] as const;

export type HomeSectionId = (typeof HOME_SECTIONS)[number]["id"];

// Object.fromEntries types its keys as any string, though HOME_SECTIONS
// gives one for every id.
const SECTION_NAMES = Object.fromEntries(
  HOME_SECTIONS.map(({ id, name }) => [id, name]),
) as Readonly<Record<HomeSectionId, string>>;

export function homeSectionName(id: HomeSectionId): string {
  return SECTION_NAMES[id];
}
