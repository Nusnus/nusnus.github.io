/**
 * @file The repositories Tomer holds a rank in, best first, ties in the order
 * the site lists them, leaving out those he holds none in.
 */

import { describe, expect, it } from "vitest";

import { rankedRepositories } from "../../../../src/github-data/repositories/ranked-repositories.ts";
import { baked } from "../../../fixtures/baked-github-data.ts";

describe("rankedRepositories", () => {
  it("lists the repositories Tomer holds a rank in, best first, ties in the site's order", () => {
    const repositories = baked.snapshot.repositories.data;

    expect(
      rankedRepositories({
        ...repositories,
        "celery/vine": {
          ...repositories["celery/vine"],
          contributorRank: null,
        },
      }).map(
        ({ contributorRank, fullName }) =>
          `${fullName} #${String(contributorRank)}`,
      ),
    ).toStrictEqual([
      "celery/pytest-celery #1",
      "celery/celery #4",
      "celery/celeryproject #4",
      "celery/billiard #5",
      "celery/sphinx_celery #5",
      "celery/kombu #8",
      "celery/py-amqp #9",
      "celery/django-celery-beat #19",
      "celery/librabbitmq #25",
      "mher/flower #25",
      "celery/django-celery-results #33",
    ]);
  });
});
