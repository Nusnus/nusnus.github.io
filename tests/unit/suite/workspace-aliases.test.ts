/**
 * @file workspaceAliases carries each workspace package's subpath exports over
 * to aliases of the package's folder, the longest first, so a more specific
 * export wins, and refuses an export no alias can carry over.
 */

import path from "node:path";
import { describe, expect, it } from "vitest";

import { temporaryFolder } from "../../fixtures/temporary-folder.ts";
import { workspaceAliases } from "../../suite/workspace-aliases.ts";

function createWorkspace(manifests: Readonly<Record<string, object>>): string {
  return temporaryFolder(
    "workspace-aliases",
    Object.fromEntries(
      Object.entries(manifests).map(([folder, manifest]) => [
        path.join(folder, "package.json"),
        JSON.stringify(manifest),
      ]),
    ),
  );
}

function workspaceWithExports(exports: Readonly<Record<string, string>>) {
  return createWorkspace({
    ".": { name: "root", workspaces: ["packages/*"] },
    "packages/contract": { exports, name: "@example/contract" },
    "packages/site": { name: "@example/site" },
  });
}

describe("workspaceAliases", () => {
  it("aliases each subpath export of each workspace package to its folder, the longest first", () => {
    const root = workspaceWithExports({
      "./*": "./src/*.ts",
      "./fixtures/*": "./tests/fixtures/*.ts",
    });

    expect(workspaceAliases(root)).toStrictEqual([
      {
        find: "@example/contract/fixtures",
        replacement: path.join(root, "packages/contract/tests/fixtures"),
      },
      {
        find: "@example/contract",
        replacement: path.join(root, "packages/contract/src"),
      },
    ]);
  });

  it("aliases nothing in a repository with no workspaces", () => {
    expect(
      workspaceAliases(createWorkspace({ ".": { name: "root" } })),
    ).toStrictEqual([]);
  });

  it.each([
    [
      { "./schema": "./src/*.ts" },
      '@example/contract exports "./schema": "./src/*.ts", which no alias carries over: write each export as "./<path>/*": "./<path>/*.<ext>", or teach workspaceAliases its shape.',
    ],
    [
      { "../fixtures/*": "./tests/fixtures/*.ts" },
      '@example/contract exports "../fixtures/*": "./tests/fixtures/*.ts", which no alias carries over: write each export as "./<path>/*": "./<path>/*.<ext>", or teach workspaceAliases its shape.',
    ],
    [
      { "./fixtures/*.ts": "./tests/fixtures/*.ts" },
      '@example/contract exports "./fixtures/*.ts": "./tests/fixtures/*.ts", which no alias carries over: write each export as "./<path>/*": "./<path>/*.<ext>", or teach workspaceAliases its shape.',
    ],
    [
      { "./*": "./src/*" },
      '@example/contract exports "./*": "./src/*", which no alias carries over: write each export as "./<path>/*": "./<path>/*.<ext>", or teach workspaceAliases its shape.',
    ],
    [
      { "./*": "../src/*.ts" },
      '@example/contract exports "./*": "../src/*.ts", which no alias carries over: write each export as "./<path>/*": "./<path>/*.<ext>", or teach workspaceAliases its shape.',
    ],
    [
      { "./*": "./src/*.d.ts" },
      '@example/contract exports "./*": "./src/*.d.ts", which no alias carries over: write each export as "./<path>/*": "./<path>/*.<ext>", or teach workspaceAliases its shape.',
    ],
  ] as const)(
    "refuses the export %j, which no alias carries over",
    (exports, message) => {
      const root = workspaceWithExports(exports);

      expect(() => workspaceAliases(root)).toThrow(new Error(message));
    },
  );
});
