/**
 * @file The home page's sections, which its navigation and anchors share, in
 * page order, and the name of each by its id.
 */

import { describe, expect, it } from "vitest";

import { HOME_SECTIONS, homeSectionName } from "../../../src/home/sections.ts";

describe("HOME_SECTIONS", () => {
  it("lists each section in page order, with its name and its link label", () => {
    expect(HOME_SECTIONS).toStrictEqual([
      { id: "activity", name: "Activity overview", navLabel: "Contributions" },
      {
        id: "collaborations",
        name: "Collaborations and recognition",
        navLabel: "Collaborations",
      },
      {
        id: "activity-graph",
        name: "Activity graphs",
        navLabel: "Activity Graph",
      },
      { id: "projects", name: "Active projects", navLabel: "Active Projects" },
      {
        id: "celery-organization",
        name: "Celery Organization",
        navLabel: "Celery Organization",
      },
      { id: "writing", name: "Writing", navLabel: "Writing" },
      { id: "sponsoring", name: "Sponsor Celery", navLabel: "Sponsoring" },
    ]);
  });
});

describe("homeSectionName", () => {
  it("names the section with the id", () => {
    expect(homeSectionName("activity-graph")).toBe("Activity graphs");
  });
});
