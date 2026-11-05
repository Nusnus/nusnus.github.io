/**
 * @file What the pinned-tools check decides, from mise's list of the tools
 * `mise.toml` pins, each with the version mise installs and where. Node.js and
 * Bun, which run `check`, must be their pinned versions: Node.js names its own,
 * and Bun names its version in the npm user agent it gives each script it
 * runs. Every other tool must be the one mise installs, found first on PATH,
 * or mise's shim of it. And TypeScript must target the pinned Node.js major,
 * through the `@tsconfig/node<major>` and `@types/node` that `package.json`
 * declares.
 */

import * as schema from "@nusnus/github-data/schema";
import path from "node:path";

/**
 * A tool `mise.toml` pins: the version mise installs, and the folder it
 * installs it in.
 */
export interface Pin {
  readonly installPath: string;
  readonly version: string;
}

/** The tools `mise.toml` pins: the runtimes that run `check`, and the rest. */
export interface Pins {
  readonly runtimes: Readonly<Record<Runtime, Pin>>;
  readonly tools: Readonly<Record<string, Pin>>;
}

/**
 * Where PATH finds a tool: the file a shell runs, and its real path, which for
 * mise's shim of the tool is mise itself.
 */
export interface FoundTool {
  readonly file: string;
  readonly realPath: string;
}

type Runtime = (typeof RUNTIMES)[number]["tool"];

/** A check that cannot compare the pins, saying how to make it able to. */
export class PinCheckError extends Error {
  override name = "PinCheckError";
}

const RUNTIMES = [
  { name: "Bun", tool: "bun" },
  { name: "Node.js", tool: "node" },
] as const;

// `mise ls --project --json` lists each tool the project's mise.toml pins, with
// the version mise installs, as mise.lock resolves it, and where it does.
const miseToolsSchema = schema.record(
  schema.string(),
  schema.tuple([
    schema.object({ install_path: schema.string(), version: schema.string() }),
  ]),
);

const devDependenciesSchema = schema.object({
  devDependencies: schema.record(schema.string(), schema.string()),
});

// npm's user agent format, `<name>/<version> …`, which Bun gives each script
// it runs, as npm does: https://docs.npmjs.com/cli/using-npm/config#user-agent
const BUN_USER_AGENT = /^bun\/(\S+) /;

const TSCONFIG_PREFIX = "@tsconfig/node";
const NODE_TYPES = "@types/node";
const FLOOR = ">=";

const ACTIVATE_MISE =
  "Run `mise install`, then run `check` with mise active: activate it in your shell (https://mise.jdx.dev/getting-started.html#activate-mise), or run `mise exec -- bun run check`.";

export function parsePins(json: unknown): Pins {
  const pins = new Map(
    Object.entries(
      schema.parse(
        miseToolsSchema,
        json,
        (issues) =>
          new PinCheckError(
            `mise.toml must pin exactly one version of each tool, but mise lists:\n${issues}\n` +
              'Pin each as `<tool> = "<version>"` in its [tools].',
          ),
      ),
    ).map(([tool, [{ install_path, version }]]) => [
      tool,
      { installPath: install_path, version },
    ]),
  );
  const unpinned = RUNTIMES.filter(({ tool }) => !pins.has(tool));
  if (unpinned.length > 0) {
    throw new PinCheckError(
      `mise.toml pins no ${unpinned.map(({ name }) => name).join(" or ")}, which \`check\` runs on. ` +
        `Pin ${unpinned.map(({ tool }) => `\`${tool} = "<version>"\``).join(" and ")} in its [tools].`,
    );
  }
  const runtimes = RUNTIMES.map(({ tool }) => [tool, pins.get(tool)] as const);
  for (const [tool] of runtimes) {
    pins.delete(tool);
  }
  return {
    // Each runtime's pin is present, as the check above makes sure.
    runtimes: Object.fromEntries(runtimes) as Record<Runtime, Pin>,
    tools: Object.fromEntries(pins),
  };
}

export function runningBunVersion(env: NodeJS.ProcessEnv): string {
  const userAgent = env["npm_config_user_agent"] ?? "";
  const bunVersion = BUN_USER_AGENT.exec(userAgent)?.[1];
  if (bunVersion === undefined) {
    throw new PinCheckError(
      `Bun does not run this check, since the npm user agent is "${userAgent}". Run it with \`bun run check:pinned-tools\`.`,
    );
  }
  return bunVersion;
}

export function describeRuntimeMismatches(
  runtimes: Pins["runtimes"],
  running: Readonly<Record<Runtime, string>>,
): string[] {
  return RUNTIMES.filter(
    ({ tool }) => running[tool] !== runtimes[tool].version,
  ).map(
    ({ name, tool }) =>
      `${name} ${running[tool]} runs \`check\`, but mise.toml pins ${runtimes[tool].version}. ${ACTIVATE_MISE}`,
  );
}

export function describeToolMismatch(
  tool: string,
  pin: Pin,
  found: FoundTool | undefined,
): string[] {
  if (found === undefined) {
    return [
      `No ${tool} is on PATH, so \`check\` cannot run mise.toml's ${tool} ${pin.version}. ${ACTIVATE_MISE}`,
    ];
  }
  // mise's shims are links to mise, which runs the pinned version of the tool
  // a shim is named for: https://mise.jdx.dev/dev-tools/shims.html
  const isMiseShim = path.basename(found.realPath) === "mise";
  return found.file.startsWith(`${pin.installPath}${path.sep}`) || isMiseShim
    ? []
    : [
        `PATH finds ${tool} at ${found.file}, not mise.toml's ${tool} ${pin.version}, which mise installs in ${pin.installPath}. ${ACTIVATE_MISE}`,
      ];
}

export function describeNodeTargetMismatch(
  nodePin: Pin,
  packageJson: unknown,
): string[] {
  const { devDependencies } = schema.parse(
    devDependenciesSchema,
    packageJson,
    (issues) =>
      new PinCheckError(
        `package.json has no devDependencies to read the Node.js TypeScript targets from:\n${issues}`,
      ),
  );
  const tsconfigs = Object.keys(devDependencies).filter((name) =>
    name.startsWith(TSCONFIG_PREFIX),
  );
  const [tsconfig, ...otherTsconfigs] = tsconfigs;
  const nodeTypes = devDependencies[NODE_TYPES] ?? "";
  if (
    tsconfig === undefined ||
    otherTsconfigs.length > 0 ||
    !nodeTypes.startsWith(FLOOR)
  ) {
    throw new PinCheckError(
      `package.json must declare one ${TSCONFIG_PREFIX}<major>, and ${NODE_TYPES} as ${FLOOR}<version>, ` +
        `but declares ${JSON.stringify(tsconfigs)}, and ${NODE_TYPES} as "${nodeTypes}".`,
    );
  }
  const major = majorOf(nodePin.version);
  return majorOf(tsconfig.slice(TSCONFIG_PREFIX.length)) === major &&
    majorOf(nodeTypes.slice(FLOOR.length)) === major
    ? []
    : [
        `mise.toml pins Node.js ${nodePin.version}, but package.json declares ${tsconfig} and ${NODE_TYPES} ${nodeTypes}, so TypeScript targets another Node.js. ` +
          `Declare ${TSCONFIG_PREFIX}${String(major)} in package.json and extend it in tsconfig.node.json, and raise ${NODE_TYPES} to its newest ${String(major)} release.`,
      ];
}

function majorOf(version: string): number {
  return Number.parseInt(version, 10);
}
