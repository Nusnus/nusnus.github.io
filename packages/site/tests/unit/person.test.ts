/**
 * @file The person: his job title is his role at the organization he leads,
 * and his accounts point at him.
 */

import { describe, expect, it } from "vitest";

import { PERSON } from "../../src/person.ts";

describe("PERSON", () => {
  it("holds his job title as his role at his organization", () => {
    expect([PERSON.role, PERSON.organization, PERSON.jobTitle]).toStrictEqual([
      "CEO & Tech Lead",
      "Celery Organization",
      "CEO & Tech Lead, Celery Organization",
    ]);
  });

  it("is emailed at his Gmail address", () => {
    expect(PERSON.emailUrl).toBe("mailto:tomer.nosrati@gmail.com");
  });

  it("is on GitHub as Nusnus", () => {
    expect([PERSON.githubLogin, PERSON.githubUrl]).toStrictEqual([
      "Nusnus",
      "https://github.com/Nusnus",
    ]);
  });

  it("is on X as @smilingnosrati", () => {
    expect([PERSON.xHandle, PERSON.xUrl]).toStrictEqual([
      "@smilingnosrati",
      "https://x.com/smilingnosrati",
    ]);
  });
});
