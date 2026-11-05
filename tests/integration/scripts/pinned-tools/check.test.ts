/**
 * @file The pinned-tools check asks the real mise for the tools a project's
 * mise.toml pins, with mise's installs kept in the project's temporary folder,
 * and finds each tool on the project's PATH: it passes when the runtimes are
 * the pinned versions, each other tool is mise's install or shim, and
 * TypeScript targets the pinned Node.js; it reports each that differs, and
 * fails; it says how to install mise when PATH lacks it; and any other failure
 * of mise escapes.
 */

import { chmodSync, mkdirSync, symlinkSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  checkPinnedTools,
  findOnPath,
} from "../../../../scripts/pinned-tools/check.ts";
import { temporaryFolder } from "../../../fixtures/temporary-folder.ts";

const PINS =
  '[tools]\nactionlint = "1.7.12"\nbun = "1.4.4"\nnode = "26.13.0"\n';
const NODE_26_PACKAGE = JSON.stringify({
  devDependencies: {
    "@tsconfig/node26": ">=26.0.1",
    "@types/node": ">=26.6.6",
  },
});
// The folders a project's PATH may find actionlint in: mise's install of the
// pinned version, mise's shims, and another install. Each project's PATH ends
// with a folder that holds only mise.
const MISE_INSTALL = "mise-data/installs/actionlint/1.7.12";
const MISE_SHIMS = "mise-data/shims";
const ELSEWHERE = "elsewhere";
const MISE_ONLY = "mise-only";
const REAL_MISE = findOnPath("mise", String(process.env["PATH"]))?.realPath;

function createProject({
  miseToml = PINS,
  packageJson = NODE_26_PACKAGE,
  pathFolders = [MISE_INSTALL],
}: {
  readonly miseToml?: string;
  readonly packageJson?: string;
  readonly pathFolders?: readonly string[];
}): { env: NodeJS.ProcessEnv; root: string } {
  if (REAL_MISE === undefined) {
    throw new Error("Run the tests where PATH finds mise, as `check` does.");
  }
  const root = temporaryFolder("pinned-tools", {
    [`${ELSEWHERE}/actionlint`]: "#!/bin/sh\n",
    [`${MISE_INSTALL}/actionlint`]: "#!/bin/sh\n",
    "mise.toml": miseToml,
    "package.json": packageJson,
  });
  chmodSync(path.join(root, ELSEWHERE, "actionlint"), 0o755);
  chmodSync(path.join(root, MISE_INSTALL, "actionlint"), 0o755);
  for (const link of [`${MISE_SHIMS}/actionlint`, `${MISE_ONLY}/mise`]) {
    mkdirSync(path.dirname(path.join(root, link)), { recursive: true });
    symlinkSync(REAL_MISE, path.join(root, link));
  }
  return {
    env: {
      ...process.env,
      // mise keeps its installs, and a record of each project it reads, in
      // these folders: https://mise.jdx.dev/directories.html
      MISE_DATA_DIR: path.join(root, "mise-data"),
      MISE_STATE_DIR: path.join(root, "mise-state"),
      PATH: [...pathFolders, MISE_ONLY]
        .map((folder) => path.join(root, folder))
        .join(path.delimiter),
      npm_config_user_agent: "bun/1.4.4 npm/? node/v26.13.0 darwin arm64",
    },
    root,
  };
}

function runCheck({ env, root }: { env: NodeJS.ProcessEnv; root: string }): {
  exitCode: number;
  reports: string[];
} {
  const reports: string[] = [];
  const exitCode = checkPinnedTools(root, env, "26.13.0", (line) =>
    reports.push(line),
  );
  return { exitCode, reports };
}

describe("checkPinnedTools", () => {
  it.each([[MISE_INSTALL], [MISE_SHIMS]])(
    "passes when the runtimes are the pinned versions, PATH finds each other tool in %s, and TypeScript targets the pinned Node.js",
    (folder) => {
      expect(runCheck(createProject({ pathFolders: [folder] }))).toStrictEqual({
        exitCode: 0,
        reports: [],
      });
    },
  );

  it("reports each tool that differs from its pin, and fails", () => {
    const project = createProject({
      miseToml:
        '[tools]\nactionlint = "1.7.12"\nbun = "1.4.4"\nnode = "26.14.0"\n',
      packageJson: JSON.stringify({
        devDependencies: {
          "@tsconfig/node25": ">=25.0.0",
          "@types/node": ">=26.6.6",
        },
      }),
      pathFolders: [ELSEWHERE, MISE_INSTALL],
    });

    expect(runCheck(project)).toStrictEqual({
      exitCode: 1,
      reports: [
        "Node.js 26.13.0 runs `check`, but mise.toml pins 26.14.0. Run `mise install`, then run `check` with mise active: activate it in your shell (https://mise.jdx.dev/getting-started.html#activate-mise), or run `mise exec -- bun run check`.",
        `PATH finds actionlint at ${path.join(project.root, "elsewhere/actionlint")}, not mise.toml's actionlint 1.7.12, which mise installs in ${path.join(project.root, "mise-data/installs/actionlint/1.7.12")}. Run \`mise install\`, then run \`check\` with mise active: activate it in your shell (https://mise.jdx.dev/getting-started.html#activate-mise), or run \`mise exec -- bun run check\`.`,
        "mise.toml pins Node.js 26.14.0, but package.json declares @tsconfig/node25 and @types/node >=26.6.6, so TypeScript targets another Node.js. Declare @tsconfig/node26 in package.json and extend it in tsconfig.node.json, and raise @types/node to its newest 26 release.",
      ],
    });
  });

  it("reports a tool PATH does not find, and fails", () => {
    expect(runCheck(createProject({ pathFolders: [] }))).toStrictEqual({
      exitCode: 1,
      reports: [
        "No actionlint is on PATH, so `check` cannot run mise.toml's actionlint 1.7.12. Run `mise install`, then run `check` with mise active: activate it in your shell (https://mise.jdx.dev/getting-started.html#activate-mise), or run `mise exec -- bun run check`.",
      ],
    });
  });

  it("reports a mise.toml that pins no Bun, and fails", () => {
    expect(
      runCheck(createProject({ miseToml: '[tools]\nnode = "26.13.0"\n' })),
    ).toStrictEqual({
      exitCode: 1,
      reports: [
        'mise.toml pins no Bun, which `check` runs on. Pin `bun = "<version>"` in its [tools].',
      ],
    });
  });

  it("says how to install mise when PATH lacks it, and fails", () => {
    const project = createProject({});

    expect(
      runCheck({ ...project, env: { ...project.env, PATH: project.root } }),
    ).toStrictEqual({
      exitCode: 1,
      reports: [
        "mise, which installs the tools mise.toml pins, is not on PATH. Install it (https://mise.jdx.dev/installing-mise.html), then run `mise install`.",
      ],
    });
  });

  it("lets any other failure of mise escape", () => {
    expect(() => runCheck(createProject({ miseToml: "[tools\n" }))).toThrow(
      // mise's own error output follows, naming the temporary folder and
      // mise's version.
      expect.objectContaining({
        message: expect.stringMatching(
          /^Command failed: mise ls --project --json\n/,
        ) as unknown,
        name: "Error",
      }),
    );
  });
});
