/**
 * @file Schemas: `parse` returns the data a schema reads, and `encode` turns it
 * back into JSON; each refuses data that breaks the schema with the caller's
 * own error, which names every issue in English. `parseOrUndefined` returns the
 * data a schema reads, and none for data that breaks it.
 */

import { describe, expect, it } from "vitest";

import * as schema from "../../src/schema.ts";

const starsSchema = schema.strictObject({
  repository: schema.string(),
  stars: schema.int(),
});

/** The caller's own error, which a refusal throws. */
class CallerError extends Error {
  override name = "CallerError";
}

describe("parse", () => {
  it("returns the data the schema reads", () => {
    expect(
      schema.parse(
        starsSchema,
        { repository: "celery/celery", stars: 29_133 },
        (issues) => new CallerError(issues),
      ),
    ).toStrictEqual({ repository: "celery/celery", stars: 29_133 });
  });

  it("refuses data that breaks the schema with the caller's error, naming every issue in English", () => {
    expect(() =>
      schema.parse(
        starsSchema,
        { stars: 1.5 },
        (issues) => new CallerError(issues),
      ),
    ).toThrow(
      new CallerError(
        "✖ Invalid input: expected string, received undefined\n" +
          "  → at repository\n" +
          "✖ Invalid input: expected int, received number\n" +
          "  → at stars",
      ),
    );
  });
});

describe("parseOrUndefined", () => {
  it("returns the data the schema reads", () => {
    expect(
      schema.parseOrUndefined(starsSchema, {
        repository: "celery/celery",
        stars: 29_133,
      }),
    ).toStrictEqual({ repository: "celery/celery", stars: 29_133 });
  });

  it("returns none for data that breaks the schema", () => {
    expect(
      schema.parseOrUndefined(starsSchema, {
        repository: "celery/celery",
        stars: "many",
      }),
    ).toBeUndefined();
  });
});

describe("encode", () => {
  const instantSchema = schema.codec(schema.iso.datetime(), schema.date(), {
    decode: (timestamp) => new Date(timestamp),
    encode: (instant) => instant.toISOString(),
  });

  it("returns the JSON the schema reads the data from", () => {
    expect(
      schema.encode(
        instantSchema,
        new Date(Date.UTC(2026, 10, 4)),
        (issues) => new CallerError(issues),
      ),
    ).toBe("2026-11-04T00:00:00.000Z");
  });

  it("refuses data that breaks the schema with the caller's error, naming every issue in English", () => {
    expect(() =>
      schema.encode(
        instantSchema,
        new Date(Number.NaN),
        (issues) => new CallerError(issues),
      ),
    ).toThrow(new CallerError("✖ Invalid input: expected date, received Date"));
  });
});
