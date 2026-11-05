/**
 * @file The tracked repositories: which the site lists, in what order and with
 * what role, and the repositories reply, which holds GitHub's data for each
 * tracked repository and no other.
 */

import { describe, expect, it } from "vitest";

import { isAllowlisted } from "../../src/redaction.ts";
import { TRACKED_REPOSITORIES } from "../../src/repositories.ts";
import { WORKER_ROUTES, WorkerReplyError } from "../../src/routes.ts";
import { repositoriesReply } from "../fixtures/worker-replies.ts";

describe("TRACKED_REPOSITORIES", () => {
  it("lists the featured repositories, then the other ones Tomer contributes to", () => {
    expect(TRACKED_REPOSITORIES).toStrictEqual([
      { featured: true, fullName: "celery/celery", role: "owner" },
      { featured: true, fullName: "celery/pytest-celery", role: "creator" },
      { featured: true, fullName: "celery/kombu", role: "owner" },
      { featured: false, fullName: "celery/billiard", role: "owner" },
      { featured: false, fullName: "celery/django-celery-beat", role: "owner" },
      {
        featured: false,
        fullName: "celery/django-celery-results",
        role: "owner",
      },
      { featured: false, fullName: "celery/py-amqp", role: "owner" },
      { featured: false, fullName: "celery/librabbitmq", role: "owner" },
      { featured: false, fullName: "celery/vine", role: "owner" },
      { featured: false, fullName: "celery/sphinx_celery", role: "owner" },
      { featured: false, fullName: "celery/celeryproject", role: "owner" },
      { featured: false, fullName: "mher/flower", role: "contributor" },
    ]);
  });

  it("are all allowlisted, so the site names Tomer's activity in them", () => {
    expect(
      TRACKED_REPOSITORIES.filter(({ fullName }) => !isAllowlisted(fullName)),
    ).toStrictEqual([]);
  });
});

describe("repositories reply", () => {
  const celery = repositoriesReply.data["celery/celery"];

  it("holds GitHub's data for every tracked repository", () => {
    const route = WORKER_ROUTES.repositories;

    expect(
      route.encodeReply(route.parseReply(repositoriesReply)),
    ).toStrictEqual(repositoriesReply);
  });

  it("freezes the record and each repository's data", () => {
    const { data } = WORKER_ROUTES.repositories.parseReply(repositoriesReply);

    expect([data, data["celery/celery"]].map(Object.isFrozen)).toStrictEqual([
      true,
      true,
    ]);
  });

  it("accepts what GitHub leaves empty as null", () => {
    const reply = {
      ...repositoriesReply,
      data: {
        ...repositoriesReply.data,
        "celery/celery": {
          ...celery,
          contributorRank: null,
          description: null,
          language: null,
        },
      },
    };

    const route = WORKER_ROUTES.repositories;

    expect(route.encodeReply(route.parseReply(reply))).toStrictEqual(reply);
  });

  it("refuses a reply that leaves out a tracked repository", () => {
    const data = Object.fromEntries(
      Object.entries(repositoriesReply.data).filter(
        ([fullName]) => fullName !== "mher/flower",
      ),
    );

    expect(() =>
      WORKER_ROUTES.repositories.parseReply({ ...repositoriesReply, data }),
    ).toThrow(
      new WorkerReplyError(
        "The worker's /repositories reply breaks the github-data contract:\n" +
          "✖ Invalid input: expected object, received undefined\n" +
          '  → at data["mher/flower"]\n' +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });

  it("refuses a repository the site does not track", () => {
    expect(() =>
      WORKER_ROUTES.repositories.parseReply({
        ...repositoriesReply,
        data: { ...repositoriesReply.data, "celery/kombu-fernet": celery },
      }),
    ).toThrow(
      new WorkerReplyError(
        "The worker's /repositories reply breaks the github-data contract:\n" +
          '✖ Unrecognized key: "celery/kombu-fernet"\n' +
          "  → at data\n" +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });

  it("refuses a contributor rank below 1", () => {
    expect(() =>
      WORKER_ROUTES.repositories.parseReply({
        ...repositoriesReply,
        data: {
          ...repositoriesReply.data,
          "celery/celery": { ...celery, contributorRank: 0 },
        },
      }),
    ).toThrow(
      new WorkerReplyError(
        "The worker's /repositories reply breaks the github-data contract:\n" +
          "✖ Too small: expected number to be >0\n" +
          '  → at data["celery/celery"].contributorRank\n' +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });

  it("refuses a field the site does not render", () => {
    expect(() =>
      WORKER_ROUTES.repositories.parseReply({
        ...repositoriesReply,
        data: {
          ...repositoriesReply.data,
          "celery/celery": { ...celery, openIssues: 738 },
        },
      }),
    ).toThrow(
      new WorkerReplyError(
        "The worker's /repositories reply breaks the github-data contract:\n" +
          '✖ Unrecognized key: "openIssues"\n' +
          '  → at data["celery/celery"]\n' +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });
});
