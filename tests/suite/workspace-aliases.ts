/**
 * @file The aliases that resolve each workspace package's exports to the
 * package's folder in the checkout Vitest runs from, as its `exports` map
 * them, rather than through the links in node_modules. Stryker runs the tests
 * in a sandbox copy whose node_modules links to the project's, where those
 * links lead to the unmutated packages, so without these aliases a mutant in
 * one package would meet only that package's own tests.
 *
 * Each export must be a subpath pattern, such as
 * `"./fixtures/*": "./tests/fixtures/*.ts"`, which an alias carries over
 * prefix for prefix, leaving the extension to Vite's resolver.
 */

import { globSync, readFileSync } from "node:fs";
import path from "node:path";

/** A Vite alias: imports that start with `find` start with `replacement`. */
export interface WorkspaceAlias {
  readonly find: string;
  readonly replacement: string;
}

/** The fields of a package.json these aliases read. */
interface Manifest {
  readonly exports?: Readonly<Record<string, string>>;
  readonly name: string;
  readonly workspaces?: readonly string[];
}

const SUBPATH_PATTERN = /^\.(?<prefix>(?:\/[^*]+)?)\/\*$/;
const TARGET_PATTERN = /^\.(?<prefix>\/[^*]+)\/\*\.[a-z]+$/;

export function workspaceAliases(root: string): WorkspaceAlias[] {
  const { workspaces } = readManifest(path.join(root, "package.json"));
  if (workspaces === undefined) {
    return [];
  }
  return (
    globSync(
      workspaces.map((workspace) => `${workspace}/package.json`),
      { cwd: root },
    )
      .flatMap((manifestPath) => {
        const packageFolder = path.join(root, path.dirname(manifestPath));
        const { exports = {}, name } = readManifest(
          path.join(root, manifestPath),
        );
        return Object.entries(exports).map(([subpath, target]) =>
          exportAlias(name, packageFolder, subpath, target),
        );
      })
      // Vite takes the first alias whose find an import starts with, so a
      // package's longer subpaths come before its shorter ones.
      .toSorted((first, second) => second.find.length - first.find.length)
  );
}

function readManifest(manifestPath: string): Manifest {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
}

function exportAlias(
  name: string,
  packageFolder: string,
  subpath: string,
  target: string,
): WorkspaceAlias {
  const subpathGroups = SUBPATH_PATTERN.exec(subpath)?.groups;
  const targetGroups = TARGET_PATTERN.exec(target)?.groups;
  const subpathPrefix = subpathGroups?.["prefix"];
  const targetPrefix = targetGroups?.["prefix"];
  if (subpathPrefix === undefined || targetPrefix === undefined) {
    throw new Error(
      `${name} exports "${subpath}": ${JSON.stringify(target)}, which no alias carries over: write each export as "./<path>/*": "./<path>/*.<ext>", or teach workspaceAliases its shape.`,
    );
  }
  return {
    find: `${name}${subpathPrefix}`,
    replacement: path.join(packageFolder, targetPrefix),
  };
}
