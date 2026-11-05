/**
 * @file Presence: active when the newest event fell on the visitor's today,
 * recent when it fell yesterday, away otherwise or with no events, the newest
 * event being the activity reply's first.
 */

import type { ActivityEvent } from "@nusnus/github-data/activity";

import { describe, expect, it } from "vitest";

import { presence } from "../../../../../src/github-data/activity/presence/presence.ts";
import { Clock } from "../../../../../src/github-data/time/clock.ts";
import { baked } from "../../../../fixtures/baked-github-data.ts";

const MORNING = new Clock(new Date("2026-11-04T08:00:00Z"), "UTC");

function recordedEventsCreatedAt(...createdAts: string[]): ActivityEvent[] {
  return baked.snapshot.activity.data
    .slice(0, createdAts.length)
    .map((event, index) => ({
      ...event,
      createdAt: new Date(createdAts[index] ?? ""),
    }));
}

describe("presence", () => {
  it.each([
    { createdAt: "2026-11-04T00:10:00Z", expected: "active", when: "today" },
    {
      createdAt: "2026-11-04T09:00:00Z",
      expected: "active",
      when: "after now, by a clock running behind",
    },
    {
      createdAt: "2026-11-03T23:50:00Z",
      expected: "recent",
      when: "yesterday",
    },
    {
      createdAt: "2026-11-02T23:50:00Z",
      expected: "away",
      when: "two days ago",
    },
  ])(
    "is $expected when the newest event fell $when",
    ({ createdAt, expected }) => {
      expect(presence(recordedEventsCreatedAt(createdAt), MORNING)).toBe(
        expected,
      );
    },
  );

  it("is away with no events", () => {
    expect(presence([], MORNING)).toBe("away");
  });

  it("judges by the reply's first event, the newest", () => {
    expect(
      presence(
        recordedEventsCreatedAt("2026-11-04T07:00:00Z", "2026-11-01T10:00:00Z"),
        MORNING,
      ),
    ).toBe("active");
  });

  it("reads the day in the visitor's time zone", () => {
    const events = recordedEventsCreatedAt("2026-11-03T22:30:00Z");

    expect([
      presence(events, MORNING),
      presence(events, new Clock(MORNING.now, "Asia/Jerusalem")),
    ]).toStrictEqual(["recent", "active"]);
  });
});
