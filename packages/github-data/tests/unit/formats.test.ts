/**
 * @file The shared value formats: counts are whole and never negative, instants
 * travel as UTC timestamps and are read as dates, and a full name is one owner
 * and one name, which `parseFullName` splits.
 */

import { describe, expect, it } from "vitest";

import {
  countSchema,
  fullNameSchema,
  instantSchema,
  parseFullName,
} from "../../src/formats.ts";
import { encode, parse } from "../../src/schema.ts";

function parseOrThrow(schema: Parameters<typeof parse>[0], value: unknown) {
  return parse(schema, value, (issues) => new Error(issues));
}

describe("countSchema", () => {
  it.each([0, 29_133])("accepts %i", (value) => {
    expect(parseOrThrow(countSchema, value)).toBe(value);
  });

  it.each([
    { issues: "✖ Too small: expected number to be >=0", value: -1 },
    { issues: "✖ Invalid input: expected int, received number", value: 1.5 },
  ])("refuses $value", ({ issues, value }) => {
    expect(() => parseOrThrow(countSchema, value)).toThrow(new Error(issues));
  });
});

describe("instantSchema", () => {
  it.each([
    {
      instant: new Date(Date.UTC(2026, 10, 3, 22, 13, 28)),
      timestamp: "2026-11-03T22:13:28Z",
    },
    {
      instant: new Date(Date.UTC(2026, 10, 4, 0, 49, 21, 278)),
      timestamp: "2026-11-04T00:49:21.278Z",
    },
  ])("reads $timestamp as the instant it names", ({ instant, timestamp }) => {
    expect(parseOrThrow(instantSchema, timestamp)).toStrictEqual(instant);
  });

  it("writes an instant as a UTC timestamp", () => {
    expect(
      encode(
        instantSchema,
        new Date(Date.UTC(2026, 10, 3, 22, 13, 28)),
        (issues) => new Error(issues),
      ),
    ).toBe("2026-11-03T22:13:28.000Z");
  });

  it.each(["2026-11-03", "2026-11-04T00:13:28+02:00"])(
    "refuses %s, which is not a UTC timestamp",
    (value) => {
      expect(() => parseOrThrow(instantSchema, value)).toThrow(
        new Error("✖ Invalid ISO datetime"),
      );
    },
  );
});

describe("fullNameSchema", () => {
  it.each(["celery/celery", "Nusnus/nusnus.github.io"])(
    "accepts %s",
    (value) => {
      expect(parseOrThrow(fullNameSchema, value)).toBe(value);
    },
  );

  it.each(["celery", "celery/", "/kombu", "celery/kombu/docs"])(
    "refuses %s, which is not one owner and one name",
    (value) => {
      expect(() => parseOrThrow(fullNameSchema, value)).toThrow(
        new Error("✖ must be a repository's owner/name, such as celery/celery"),
      );
    },
  );
});

describe("parseFullName", () => {
  it("splits a full name into its owner and its name", () => {
    expect(parseFullName("Nusnus/nusnus.github.io")).toStrictEqual({
      name: "nusnus.github.io",
      owner: "Nusnus",
    });
  });
});
