/**
 * @file ESLint: lints every TypeScript, Astro and React file with zero
 * warnings, type-checked, accessible, documented and in one order, keeps each
 * third-party library and child processes in their homes and the deciding
 * modules free of I/O, and lints each package.json, JSON, YAML, TOML,
 * Markdown and CSS file. In every file, an exemption from a rule names the
 * rule and states its reason.
 */

import type { Linter } from "eslint";

import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import eslintReact from "@eslint-react/eslint-plugin";
import css from "@eslint/css";
import js from "@eslint/js";
import markdown from "@eslint/markdown";
import astro from "eslint-plugin-astro";
import jsdoc from "eslint-plugin-jsdoc";
import jsonc from "eslint-plugin-jsonc";
// The jsx-a11y fork that supports ESLint 10; eslint-plugin-astro accepts
// either.
import jsxA11y from "eslint-plugin-jsx-a11y-x";
import n from "eslint-plugin-n";
import packageJson from "eslint-plugin-package-json";
import perfectionist from "eslint-plugin-perfectionist";
import reactHooks from "eslint-plugin-react-hooks";
import toml from "eslint-plugin-toml";
import yml from "eslint-plugin-yml";
import { defineConfig, includeIgnoreFile } from "eslint/config";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { tailwind4 } from "tailwind-csstree";
import tseslint from "typescript-eslint";

// The schema wrangler.jsonc names, whose key order is Wrangler's own. It sits
// beside the package.json of the Wrangler the worker installs, which exports
// no path to it.
const WRANGLER_SCHEMA = JSON.parse(
  readFileSync(
    path.join(
      path.dirname(
        createRequire(
          path.join(import.meta.dirname, "packages/worker/package.json"),
        ).resolve("wrangler/package.json"),
      ),
      "config-schema.json",
    ),
    "utf8",
  ),
) as { definitions: { RawConfig: { properties: Record<string, unknown> } } };

// A module's docstring, as eslint-plugin-jsdoc's comment selectors match it.
const MODULE_DOCSTRING = ':has(JsdocTag[tag="file"])';

// Each third-party library's home, the module named for its role, which every
// other module goes through, so an upgrade or a swap touches one place; and
// the modules that start child processes, so git runs through scripts/git.ts,
// which keeps a commit hook's repository from a child git. The frameworks the
// code runs in are no library's home.
const IMPORT_HOMES: Readonly<Record<string, readonly string[]>> = {
  "@axe-core/playwright": ["packages/site/tests/fixtures/smoke-page.ts"],
  "@msw/cloudflare": ["packages/worker/tests/fixtures/github/fake.ts"],
  "@testing-library/react": ["packages/site/tests/fixtures/unit-page.ts"],
  "lucide-react": ["packages/site/src/design-system/icons.ts"],
  msw: [
    "packages/worker/tests/fixtures/github/fake.ts",
    "tests/fixtures/services/network.ts",
  ],
  "node:child_process": [
    "scripts/git.ts",
    "scripts/pinned-tools/check.ts",
    "tests/fixtures/node-script.ts",
  ],
  zod: ["packages/github-data/src/schema.ts"],
};

// A deciding module's refusal of the clock, which two rules share.
const NO_CLOCK =
  "A deciding module does not read the clock: take the time as an argument.";

// A key order names the keys it places first; the rest follow in ascending
// order, as do the keys of every object no order names.
const REST_ASCENDING = { order: { type: "asc" } } as const;
const ANY_OTHER_OBJECT_ASCENDING = { ...REST_ASCENDING, pathPattern: ".*" };

// A step's keys, in the workflow syntax reference's order, which a composite
// action's steps follow too.
const STEP_KEYS = [
  "id",
  "if",
  "name",
  "uses",
  "run",
  "working-directory",
  "shell",
  "with",
  "env",
  "continue-on-error",
  "timeout-minutes",
  "background",
  "wait",
  "wait-all",
  "cancel",
  "parallel",
];
// A job's path: eslint-plugin-yml writes a job id that is not an identifier,
// such as check-expiries, in brackets.
const JOB_PATH = String.raw`jobs(?:\.[^.[]+|\["[^"]+"\])`;

// The workflow syntax reference's order at each level:
// https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
const WORKFLOW_KEY_ORDER = [
  {
    order: [
      "name",
      "run-name",
      "on",
      "permissions",
      "env",
      "defaults",
      "concurrency",
      "cache-mode",
      "jobs",
      REST_ASCENDING,
    ],
    pathPattern: "^$",
  },
  {
    order: [
      "types",
      "branches",
      "branches-ignore",
      "tags",
      "tags-ignore",
      "paths",
      "paths-ignore",
      "inputs",
      "outputs",
      "secrets",
      "workflows",
      REST_ASCENDING,
    ],
    pathPattern: String.raw`^on\.[^.]+$`,
  },
  {
    order: ["group", "cancel-in-progress", REST_ASCENDING],
    pathPattern: String.raw`^(${JOB_PATH}\.)?concurrency$`,
  },
  {
    order: ["shell", "working-directory", REST_ASCENDING],
    pathPattern: String.raw`^(${JOB_PATH}\.)?defaults\.run$`,
  },
  // The jobs, in the order they run.
  { order: { type: "ignore" }, pathPattern: "^jobs$" },
  {
    order: [
      "name",
      "permissions",
      "needs",
      "if",
      "runs-on",
      "snapshot",
      "environment",
      "concurrency",
      "cache-mode",
      "outputs",
      "env",
      "defaults",
      "steps",
      "timeout-minutes",
      "strategy",
      "continue-on-error",
      "container",
      "services",
      "uses",
      "with",
      "secrets",
      REST_ASCENDING,
    ],
    pathPattern: String.raw`^${JOB_PATH}$`,
  },
  {
    order: ["name", "url", "deployment", REST_ASCENDING],
    pathPattern: String.raw`^${JOB_PATH}\.environment$`,
  },
  {
    order: ["matrix", "fail-fast", "max-parallel", REST_ASCENDING],
    pathPattern: String.raw`^${JOB_PATH}\.strategy$`,
  },
  {
    order: [...STEP_KEYS, REST_ASCENDING],
    pathPattern: String.raw`^${JOB_PATH}\.steps\[\d+\]$`,
  },
  ANY_OTHER_OBJECT_ASCENDING,
];

// The metadata syntax reference's order, with the workflow's step order:
// https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax
const ACTION_KEY_ORDER = [
  {
    order: [
      "name",
      "author",
      "description",
      "inputs",
      "outputs",
      "runs",
      "branding",
      REST_ASCENDING,
    ],
    pathPattern: "^$",
  },
  {
    order: [
      "using",
      "main",
      "pre",
      "pre-if",
      "post",
      "post-if",
      "steps",
      REST_ASCENDING,
    ],
    pathPattern: "^runs$",
  },
  {
    order: [...STEP_KEYS, REST_ASCENDING],
    pathPattern: String.raw`^runs\.steps\[\d+\]$`,
  },
  ANY_OTHER_OBJECT_ASCENDING,
];

// lefthook's configuration reference's order:
// https://lefthook.dev/configuration/
const LEFTHOOK_KEY_ORDER = [
  {
    order: [
      "files",
      "parallel",
      "piped",
      "follow",
      "fail_on_changes",
      "fail_on_changes_diff",
      "exclude_tags",
      "exclude",
      "skip",
      "only",
      "jobs",
      "commands",
      "scripts",
      REST_ASCENDING,
    ],
    pathPattern: "^[^.]+$",
  },
  {
    order: [
      "name",
      "run",
      "script",
      "runner",
      "args",
      "group",
      "skip",
      "only",
      "tags",
      "glob",
      "files",
      "file_types",
      "env",
      "root",
      "exclude",
      "fail_text",
      "stage_fixed",
      "interactive",
      "use_stdin",
      REST_ASCENDING,
    ],
    pathPattern: String.raw`\.jobs\[\d+\]$`,
  },
  ANY_OTHER_OBJECT_ASCENDING,
];

// TypeScript's reference orders the root fields as below; it groups the
// compiler options by category, which no tool can read, so they go in
// ascending order: https://www.typescriptlang.org/tsconfig/
const TSCONFIG_KEY_ORDER = [
  {
    order: [
      "$schema",
      "files",
      "extends",
      "include",
      "exclude",
      "references",
      "compilerOptions",
      "watchOptions",
      "typeAcquisition",
      REST_ASCENDING,
    ],
    pathPattern: "^$",
  },
  ANY_OTHER_OBJECT_ASCENDING,
];

// Wrangler's own schema's order.
const WRANGLER_KEY_ORDER = [
  {
    order: [
      ...Object.keys(WRANGLER_SCHEMA.definitions.RawConfig.properties),
      REST_ASCENDING,
    ],
    pathPattern: "^$",
  },
  ANY_OTHER_OBJECT_ASCENDING,
];

// Any other JSON or YAML file: `$schema` first, then the rest ascending.
const SCHEMA_FIRST_KEY_ORDER = [
  { order: ["$schema", REST_ASCENDING], pathPattern: "^$" },
  ANY_OTHER_OBJECT_ASCENDING,
];

export default defineConfig(
  includeIgnoreFile(path.join(import.meta.dirname, ".gitignore")),
  {
    extends: [comments.recommended],
    rules: { "@eslint-community/eslint-comments/require-description": "error" },
  },
  {
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      perfectionist.configs["recommended-natural"],
    ],
    files: ["**/*.{ts,tsx,astro}"],
    languageOptions: { parserOptions: { projectService: true } },
    plugins: { jsdoc, n },
    rules: {
      // Each module opens with a docstring, tagged `@file` so the rule finds
      // it, each class has one, and nothing else does but a type, which may
      // define a domain record. Whether a docstring says what a reader needs,
      // in domain terms, and whether a type defines a domain record, are for
      // review.
      "jsdoc/no-restricted-syntax": [
        "error",
        {
          contexts: [
            // A docstring on an exported value sits on its export.
            "ExportDefaultDeclaration:not(:has(> ClassDeclaration))",
            "ExportNamedDeclaration:has(> VariableDeclaration)",
            "FunctionDeclaration",
            "MethodDefinition",
            "Property",
            "PropertyDefinition",
            "TSDeclareFunction",
            "TSEnumMember",
            "TSMethodSignature",
            "TSPropertySignature",
            "VariableDeclaration",
          ]
            .map((context) => ({
              comment: `JsdocBlock:not(${MODULE_DOCSTRING})`,
              context,
              message:
                "Only a module, a class or a domain record has a docstring: a function, method, field or constant is documented by its name and type. Rename it until it needs none, and keep a fact from outside the code as a `//` comment.",
            }))
            .concat({
              // A docstring that touches the next statement belongs to it, so
              // perfectionist would carry it along when it sorts the imports.
              comment: `JsdocBlock${MODULE_DOCSTRING}`,
              context: ":statement",
              message:
                "Leave a blank line after the module's docstring, so it stays the module's and does not attach to the statement after it.",
            }),
        },
      ],
      "jsdoc/require-file-overview": "error",
      "jsdoc/require-jsdoc": [
        "error",
        { require: { ClassDeclaration: true, FunctionDeclaration: false } },
      ],
      // Node, which runs the scripts and the contract by stripping types,
      // resolves a relative import only by its full file name.
      "n/file-extension-in-import": ["error", "always"],
      // One form for every step of a counter, `+= 1`.
      "no-plusplus": "error",
      // perfectionist keeps each type's and module's groups in order, state
      // before behaviour, but not alphabetical inside a group, where a caller
      // comes before what it calls and state after the state it reads.
      "perfectionist/sort-classes": [
        "error",
        {
          // AGENTS.md's order for a type, the constructor first among its
          // methods, whatever each member's modifiers: perfectionist's default
          // groups split members by them, and would put a public getter before
          // the private field it reads. A field that holds a function is a
          // method bound to its instance.
          groups: [
            "property",
            ["get-method", "set-method"],
            "constructor",
            ["function-property", "method"],
          ],
          type: "unsorted",
        },
      ],
      "perfectionist/sort-interfaces": [
        "error",
        { groups: ["property", "method"], type: "unsorted" },
      ],
      "perfectionist/sort-modules": [
        "error",
        {
          groups: ["enum", ["interface", "type"], "class", "function"],
          type: "unsorted",
        },
      ],
      "perfectionist/sort-object-types": [
        "error",
        { groups: ["property", "method"], type: "unsorted" },
      ],
      "perfectionist/sort-objects": [
        "error",
        { groups: ["property", "method"], type: "unsorted" },
      ],
    },
  },
  {
    // A tool's config, whose keys no reference orders, keeps them ascending.
    files: ["*.config.ts", "knip.ts", "packages/*/*.config.ts"],
    rules: { "perfectionist/sort-objects": ["error", { type: "natural" }] },
  },
  {
    extends: [astro.configs.recommended, astro.configs["jsx-a11y-strict"]],
    files: ["**/*.astro"],
    // astro-eslint-parser has no project service; it reads the nearest
    // tsconfig.json instead.
    languageOptions: {
      parserOptions: { project: true, projectService: false },
    },
  },
  {
    extends: [
      jsxA11y.configs.strict,
      reactHooks.configs.flat.recommended,
      eslintReact.configs["strict-type-checked"],
      // Where both plugins check the same rule, report it once, from
      // eslint-react.
      eslintReact.configs["disable-conflict-eslint-plugin-react-hooks"],
    ],
    files: ["**/*.tsx"],
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // Vitest's toThrow, given text or a pattern, also passes when the
          // code throws undefined or a string, and matches part of the message
          // only; given a class, it checks only the class. A bare name may
          // hold any of these, so the rule refuses every one.
          message:
            "Assert the error itself, so a test fails when the code throws anything else: toThrow(new SomeError(message)), toThrow(SomeError.factory(message)) where a factory makes it, or toThrow(expect.objectContaining({ message, name })) where neither is public.",
          selector:
            "CallExpression[callee.property.name=/^toThrow(Error)?$/][arguments.length=0], CallExpression[callee.property.name=/^toThrow(Error)?$/] > :matches(Literal, TemplateLiteral, BinaryExpression, Identifier).arguments:first-child",
        },
        {
          message:
            "Parametrize with .each, the suite's one form, which spreads each row into the test's arguments.",
          selector:
            "MemberExpression[object.name=/^(describe|it|test)$/][property.name='for']",
        },
      ],
    },
  },
  {
    // Modules that decide take the time, randomness and outside state they
    // need as arguments, so each decision is tested without I/O.
    files: [
      "packages/github-data/src/**",
      "packages/site/src/design-system/{icons,link-target,tailwind}.ts",
      "packages/site/src/github-data/achievements/achievements.ts",
      "packages/site/src/github-data/activity/event-display.tsx",
      "packages/site/src/github-data/activity/presence/presence.ts",
      "packages/site/src/github-data/contributions/chart/chart-hover.ts",
      "packages/site/src/github-data/contributions/{ContributionHeatmap,ContributionLineChart,MonthlyBreakdown}.tsx",
      "packages/site/src/github-data/live/{live-data-store,live-text}.ts",
      "packages/site/src/github-data/repositories/{language-color,ranked-repositories}.ts",
      "packages/site/src/github-data/snapshot/{baked-github-data,snapshot}.ts",
      "packages/site/src/github-data/stats/*.ts",
      "packages/site/src/github-data/time/*.ts",
      "packages/site/src/home/sections.ts",
      "packages/site/src/layouts/page-metadata.ts",
      "packages/site/src/{locale,person,site}.ts",
      "packages/site/src/writing/{articles/article,writing}.ts",
      "packages/worker/src/cache/{backoffs/backoff,cached-replies/cached-reply,refresh-leases}.ts",
      "packages/worker/src/github/{api-version,failures,request-policy}.ts",
      "packages/worker/src/routes/{contribution-graph,profile,repositories,route-source}.ts",
      "packages/worker/src/routes/activity/{event-targets,recent-events,titles}.ts",
      "packages/worker/src/serving/{responses,router}.ts",
      "scripts/{cloudflare-token,fetch-failure,worker-profile}.ts",
      "scripts/expiries/{cloudflare,expiry,github,node,reply,report,request,worker}.ts",
      "scripts/pinned-tools/mismatches.ts",
      "scripts/test-mirrors/refusals.ts",
      "scripts/worker-version/wait.ts",
    ],
    rules: {
      "no-restricted-globals": [
        "error",
        ...[
          "caches",
          "console",
          "crypto",
          "document",
          "fetch",
          "localStorage",
          "location",
          "navigator",
          "performance",
          "process",
          "scheduler",
          "sessionStorage",
          "setInterval",
          "setTimeout",
          "window",
        ].map((name) => ({
          message: `A deciding module does no I/O: take what ${name} gives as an argument, from a module at the edge.`,
          name,
        })),
      ],
      "no-restricted-properties": [
        "error",
        {
          message: NO_CLOCK,
          object: "Date",
          property: "now",
        },
        {
          message:
            "A deciding module draws no random numbers: take a random source as an argument.",
          object: "Math",
          property: "random",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          message: NO_CLOCK,
          selector:
            "NewExpression[callee.name='Date'][arguments.length=0], CallExpression[callee.name='Date']",
        },
      ],
    },
  },
  ...[undefined, ...new Set(Object.values(IMPORT_HOMES).flat())].map(
    (home): Linter.Config => ({
      files: home === undefined ? ["**/*.{ts,tsx,astro}"] : [home],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: Object.entries(IMPORT_HOMES)
              .filter(
                ([, homes]) => home === undefined || !homes.includes(home),
              )
              .map(([module, homes]) => ({
                message: `Import ${module} only in ${homes.join(" or ")}, and go through it elsewhere.`,
                // The module and its subpaths, but no other package's
                // subpath of its name, such as astro/zod; a Node.js module
                // imports with or without its scheme.
                regex: `^${module.replace(/^node:/, "(node:)?")}(/.*)?$`,
              })),
          },
        ],
      },
    }),
  ),
  {
    extends: [packageJson.configs.recommended, packageJson.configs.stylistic],
    files: ["**/package.json"],
  },
  {
    extends: [
      jsonc.configs["flat/recommended-with-json"],
      jsonc.configs["flat/prettier"],
    ],
    files: ["**/*.json"],
    // TypeScript reads its configs as JSON with comments.
    ignores: ["**/tsconfig*.json"],
  },
  {
    extends: [
      jsonc.configs["flat/recommended-with-jsonc"],
      jsonc.configs["flat/prettier"],
    ],
    files: ["**/*.jsonc", "**/tsconfig*.json"],
  },
  {
    extends: [
      jsonc.configs["flat/recommended-with-json5"],
      jsonc.configs["flat/prettier"],
    ],
    files: ["**/*.json5"],
  },
  {
    extends: [yml.configs["flat/standard"], yml.configs["flat/prettier"]],
    files: ["**/*.{yaml,yml}"],
  },
  {
    files: [".github/workflows/*.yml"],
    // GitHub's docs write an event that takes no options as a key with no
    // value, such as `workflow_dispatch:`.
    rules: { "yml/no-empty-mapping-value": "off" },
  },
  {
    files: ["**/*.{json,jsonc,json5}"],
    // package.json keeps eslint-plugin-package-json's order, and a recorded
    // reply keeps the order its service sent.
    ignores: ["**/package.json", "**/tests/fixtures/**"],
    rules: { "jsonc/sort-keys": ["error", ...SCHEMA_FIRST_KEY_ORDER] },
  },
  {
    files: ["**/tsconfig*.json"],
    rules: { "jsonc/sort-keys": ["error", ...TSCONFIG_KEY_ORDER] },
  },
  {
    files: ["packages/worker/wrangler.jsonc"],
    rules: { "jsonc/sort-keys": ["error", ...WRANGLER_KEY_ORDER] },
  },
  {
    files: ["**/*.{yaml,yml}"],
    rules: { "yml/sort-keys": ["error", ...SCHEMA_FIRST_KEY_ORDER] },
  },
  {
    files: [".github/workflows/*.yml"],
    rules: { "yml/sort-keys": ["error", ...WORKFLOW_KEY_ORDER] },
  },
  {
    files: [".github/actions/*/action.yml"],
    rules: { "yml/sort-keys": ["error", ...ACTION_KEY_ORDER] },
  },
  {
    files: ["lefthook.yml"],
    rules: { "yml/sort-keys": ["error", ...LEFTHOOK_KEY_ORDER] },
  },
  {
    extends: [toml.configs.standard],
    files: ["**/*.toml"],
  },
  {
    extends: ["markdown/recommended"],
    files: ["**/*.md"],
    language: "markdown/gfm",
    languageOptions: { frontmatter: "yaml" },
    plugins: { markdown },
    rules: {
      "markdown/fenced-code-meta": ["error", "never"],
      "markdown/no-bare-urls": "error",
      "markdown/no-duplicate-headings": "error",
      "markdown/no-html": "error",
    },
  },
  {
    extends: ["css/recommended"],
    files: ["**/*.css"],
    language: "css/css",
    languageOptions: { customSyntax: tailwind4 },
    plugins: { css },
    // Of the rules beyond the recommended ones, prefer-logical-properties
    // proposes properties that are not Baseline, such as overflow-inline, and
    // use-layers counts Tailwind's import and each keyframe as a rule outside
    // a layer.
    rules: {
      // @eslint/css knows no variable that Tailwind's @theme defines.
      "css/no-invalid-properties": ["error", { allowUnknownVariables: true }],
      "css/relative-font-units": "error",
      "css/selector-complexity": "error",
    },
  },
);
