/**
 * @file What the pinned-tools check decides, and the error, which names itself,
 * that says why it could not. mise's list of pins reads into the runtimes and
 * the other tools, refusing a tool pinned twice and a list without Node.js or
 * Bun. Bun's version reads from the npm user agent Bun gives, and anything else
 * refuses to run the check. Each runtime must be its pinned version, and each
 * other tool must be mise's install of its pin, or mise's shim of it, found
 * first on PATH. TypeScript must target the pinned Node.js major, and a
 * package.json it cannot read that from fails.
 */

import { describe, expect, it } from "vitest";

import {
  describeNodeTargetMismatch,
  describeRuntimeMismatches,
  describeToolMismatch,
  parsePins,
  PinCheckError,
  runningBunVersion,
} from "../../../../scripts/pinned-tools/mismatches.ts";

const MISE = "/home/tomer/.local/share/mise";
const BUN = { installPath: `${MISE}/installs/bun/1.4.4`, version: "1.4.4" };
const NODE = {
  installPath: `${MISE}/installs/node/26.13.0`,
  version: "26.13.0",
};
const ACTIONLINT = {
  installPath: `${MISE}/installs/actionlint/1.7.12`,
  version: "1.7.12",
};

function listed(installPath: string, version: string) {
  return [{ install_path: installPath, version }];
}

describe("PinCheckError", () => {
  it("names itself where it prints", () => {
    expect(String(new PinCheckError("probe"))).toBe("PinCheckError: probe");
  });
});

describe("parsePins", () => {
  it("reads the runtimes apart from the other tools", () => {
    expect(
      parsePins({
        actionlint: listed(ACTIONLINT.installPath, "1.7.12"),
        bun: listed(BUN.installPath, "1.4.4"),
        node: listed(NODE.installPath, "26.13.0"),
      }),
    ).toStrictEqual({
      runtimes: { bun: BUN, node: NODE },
      tools: { actionlint: ACTIONLINT },
    });
  });

  it("refuses a tool pinned to two versions, saying how to pin it", () => {
    expect(() =>
      parsePins({
        bun: listed(BUN.installPath, "1.4.4"),
        node: [
          ...listed(NODE.installPath, "26.13.0"),
          ...listed(NODE.installPath, "26.12.1"),
        ],
      }),
    ).toThrow(
      new PinCheckError(
        "mise.toml must pin exactly one version of each tool, but mise lists:\n" +
          "✖ Too big: expected array to have <=1 items\n  → at node\n" +
          'Pin each as `<tool> = "<version>"` in its [tools].',
      ),
    );
  });

  it("refuses a list without Bun, saying how to pin it", () => {
    expect(() =>
      parsePins({ node: listed(NODE.installPath, "26.13.0") }),
    ).toThrow(
      new PinCheckError(
        'mise.toml pins no Bun, which `check` runs on. Pin `bun = "<version>"` in its [tools].',
      ),
    );
  });

  it("refuses a list without either runtime, naming both", () => {
    expect(() =>
      parsePins({ actionlint: listed(ACTIONLINT.installPath, "1.7.12") }),
    ).toThrow(
      new PinCheckError(
        'mise.toml pins no Bun or Node.js, which `check` runs on. Pin `bun = "<version>"` and `node = "<version>"` in its [tools].',
      ),
    );
  });
});

describe("runningBunVersion", () => {
  it("reads Bun's version from the npm user agent Bun gives", () => {
    expect(
      runningBunVersion({
        npm_config_user_agent: "bun/1.4.4 npm/? node/v26.13.0 darwin arm64",
      }),
    ).toBe("1.4.4");
  });

  it.each([
    [
      "npm/11.6.0 node/v26.13.0 darwin arm64",
      'Bun does not run this check, since the npm user agent is "npm/11.6.0 node/v26.13.0 darwin arm64". Run it with `bun run check:pinned-tools`.',
    ],
    [
      "npm/11.6.0 bun/1.4.4 darwin arm64",
      'Bun does not run this check, since the npm user agent is "npm/11.6.0 bun/1.4.4 darwin arm64". Run it with `bun run check:pinned-tools`.',
    ],
  ])(
    "refuses to run under the package manager the user agent %j names first, saying how to run it",
    (userAgent, refusal) => {
      expect(() =>
        runningBunVersion({ npm_config_user_agent: userAgent }),
      ).toThrow(new PinCheckError(refusal));
    },
  );

  it("refuses to run without a package manager, saying how to run it", () => {
    expect(() => runningBunVersion({})).toThrow(
      new PinCheckError(
        'Bun does not run this check, since the npm user agent is "". Run it with `bun run check:pinned-tools`.',
      ),
    );
  });
});

describe("describeRuntimeMismatches", () => {
  it("accepts the runtimes mise.toml pins", () => {
    expect(
      describeRuntimeMismatches(
        { bun: BUN, node: NODE },
        { bun: "1.4.4", node: "26.13.0" },
      ),
    ).toStrictEqual([]);
  });

  it("refuses a Bun other than the pinned one, naming both versions and the next step", () => {
    expect(
      describeRuntimeMismatches(
        { bun: BUN, node: NODE },
        { bun: "1.3.14", node: "26.13.0" },
      ),
    ).toStrictEqual([
      "Bun 1.3.14 runs `check`, but mise.toml pins 1.4.4. Run `mise install`, then run `check` with mise active: activate it in your shell (https://mise.jdx.dev/getting-started.html#activate-mise), or run `mise exec -- bun run check`.",
    ]);
  });

  it("refuses a Node.js other than the pinned one, naming both versions and the next step", () => {
    expect(
      describeRuntimeMismatches(
        { bun: BUN, node: NODE },
        { bun: "1.4.4", node: "26.12.1" },
      ),
    ).toStrictEqual([
      "Node.js 26.12.1 runs `check`, but mise.toml pins 26.13.0. Run `mise install`, then run `check` with mise active: activate it in your shell (https://mise.jdx.dev/getting-started.html#activate-mise), or run `mise exec -- bun run check`.",
    ]);
  });
});

describe("describeToolMismatch", () => {
  it("accepts mise's install of the pinned version, found first on PATH", () => {
    const file = `${ACTIONLINT.installPath}/actionlint`;

    expect(
      describeToolMismatch("actionlint", ACTIONLINT, { file, realPath: file }),
    ).toStrictEqual([]);
  });

  it("accepts mise's shim of the tool, which runs the pinned version", () => {
    expect(
      describeToolMismatch("actionlint", ACTIONLINT, {
        file: `${MISE}/shims/actionlint`,
        realPath: "/usr/local/bin/mise",
      }),
    ).toStrictEqual([]);
  });

  it.each([
    "/opt/homebrew/bin/actionlint",
    `${MISE}/installs/actionlint/1.7.12-rc/actionlint`,
  ])(
    "refuses the tool PATH finds at %s, saying where mise installs the pinned one",
    (file) => {
      expect(
        describeToolMismatch("actionlint", ACTIONLINT, {
          file,
          realPath: file,
        }),
      ).toStrictEqual([
        `PATH finds actionlint at ${file}, not mise.toml's actionlint 1.7.12, which mise installs in ${MISE}/installs/actionlint/1.7.12. Run \`mise install\`, then run \`check\` with mise active: activate it in your shell (https://mise.jdx.dev/getting-started.html#activate-mise), or run \`mise exec -- bun run check\`.`,
      ]);
    },
  );

  it("refuses a tool PATH does not find, naming the pinned version", () => {
    expect(
      describeToolMismatch("actionlint", ACTIONLINT, undefined),
    ).toStrictEqual([
      "No actionlint is on PATH, so `check` cannot run mise.toml's actionlint 1.7.12. Run `mise install`, then run `check` with mise active: activate it in your shell (https://mise.jdx.dev/getting-started.html#activate-mise), or run `mise exec -- bun run check`.",
    ]);
  });
});

describe("describeNodeTargetMismatch", () => {
  it("accepts TypeScript settings for the pinned Node.js major", () => {
    expect(
      describeNodeTargetMismatch(NODE, {
        devDependencies: {
          "@tsconfig/node26": ">=26.0.1",
          "@types/node": ">=26.6.6",
          typescript: "~6.0.3",
        },
      }),
    ).toStrictEqual([]);
  });

  it.each([
    [
      { "@tsconfig/node26": ">=26.0.1", "@types/node": ">=27.0.0" },
      "mise.toml pins Node.js 26.13.0, but package.json declares @tsconfig/node26 and @types/node >=27.0.0, so TypeScript targets another Node.js. Declare @tsconfig/node26 in package.json and extend it in tsconfig.node.json, and raise @types/node to its newest 26 release.",
    ],
    [
      { "@tsconfig/node25": ">=25.0.0", "@types/node": ">=26.6.6" },
      "mise.toml pins Node.js 26.13.0, but package.json declares @tsconfig/node25 and @types/node >=26.6.6, so TypeScript targets another Node.js. Declare @tsconfig/node26 in package.json and extend it in tsconfig.node.json, and raise @types/node to its newest 26 release.",
    ],
  ])(
    "refuses settings for another major, %j, saying what to move",
    (devDependencies, refusal) => {
      expect(
        describeNodeTargetMismatch(NODE, { devDependencies }),
      ).toStrictEqual([refusal]);
    },
  );

  it.each([
    [
      { "@types/node": ">=26.6.6" },
      'package.json must declare one @tsconfig/node<major>, and @types/node as >=<version>, but declares [], and @types/node as ">=26.6.6".',
    ],
    [
      {
        "@tsconfig/node24": ">=24.0.0",
        "@tsconfig/node26": ">=26.0.1",
        "@types/node": ">=26.6.6",
      },
      'package.json must declare one @tsconfig/node<major>, and @types/node as >=<version>, but declares ["@tsconfig/node24","@tsconfig/node26"], and @types/node as ">=26.6.6".',
    ],
    [
      { "@tsconfig/node26": ">=26.0.1" },
      'package.json must declare one @tsconfig/node<major>, and @types/node as >=<version>, but declares ["@tsconfig/node26"], and @types/node as "".',
    ],
    [
      { "@tsconfig/node26": ">=26.0.1", "@types/node": "^26.6.6" },
      'package.json must declare one @tsconfig/node<major>, and @types/node as >=<version>, but declares ["@tsconfig/node26"], and @types/node as "^26.6.6".',
    ],
  ])(
    "refuses devDependencies it cannot read the target from, %j",
    (devDependencies, refusal) => {
      expect(() =>
        describeNodeTargetMismatch(NODE, { devDependencies }),
      ).toThrow(new PinCheckError(refusal));
    },
  );

  it("refuses a package.json without devDependencies", () => {
    expect(() => describeNodeTargetMismatch(NODE, {})).toThrow(
      new PinCheckError(
        "package.json has no devDependencies to read the Node.js TypeScript targets from:\n" +
          "✖ Invalid input: expected record, received undefined\n  → at devDependencies",
      ),
    );
  });
});
