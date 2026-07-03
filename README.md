# nusnus.github.io

Personal portfolio & live activity dashboard for [Tomer Nosrati (@Nusnus)](https://github.com/Nusnus).

Astro 5 · Tailwind CSS v4 · React islands · Bun · Cloudflare Worker · GitHub Pages

## Setup

```sh
bun install
make dev
```

Or open in VS Code → `Cmd+Shift+P` → **Dev Containers: Reopen in Container**.

Site runs at [localhost:4321](http://localhost:4321).

## Development

| Command             | Action                                                |
| :------------------ | :---------------------------------------------------- |
| `make dev`          | Dev server (`localhost:4321`)                         |
| `make build`        | Production build → `./dist/`                          |
| `make preview`      | Preview production build                              |
| `make lint`         | ESLint                                                |
| `make lint-fix`     | ESLint with auto-fix                                  |
| `make format`       | Prettier (write)                                      |
| `make format-check` | Prettier (check only)                                 |
| `make type-check`   | `astro check` + `tsc --noEmit`                        |
| `make test`         | Vitest                                                |
| `make pre-commit`   | All checks: lint, format, type-check, validate-data   |
| `make fetch-data`   | Fetch GitHub data (optional `GITHUB_TOKEN` in `.env`) |
| `make clean`        | Remove `dist/`, `.astro/`, `node_modules/`            |

### Pre-commit hooks

Pre-commit checks run automatically via [Lefthook](https://github.com/evilmartians/lefthook). To install the git hook:

```sh
bunx lefthook install
```

To run manually without the hook: `make pre-commit`.

## How it works

```
GitHub API → fetch-data → public/data/*.json → Astro build → GitHub Pages
                ↑                                     ↑
          daily (CI)                          on push to main
```

At runtime a Cloudflare Worker (`worker/`) serves the same GitHub data live with a
stale-while-revalidate policy. The `LiveData` island hydrates the static page from
the worker (and `localStorage`), falling back to the build-time JSON if the worker
is unavailable — so the page is always correct, then freshens in the background.

Four GitHub Actions workflows keep the site alive:

- **update-data** — daily cron (`0 6 * * *`), fetches profile/repos/activity/contribution data, commits JSON
- **deploy** — builds and deploys to Pages on every push to `main`
- **deploy-worker** — deploys the Cloudflare Worker on changes under `worker/`
- **lint** — type-check, lint, format, tests on PRs and pushes

The site works offline with seed data in `public/data/` — no API token required for development.

## Blog

Add a Markdown file to `src/content/blog/`:

```md
---
title: My First Post
description: A short description
publishedAt: 2026-03-03
tags: [open-source, celery]
---

Content here.
```

Appears at `/blog/<filename>`.

## Worker

The Cloudflare Worker in `worker/` proxies live, edge-cached GitHub data for the
site (`GET /github/profile|repos|org-repos|activity|contributions`). Deploy with:

```sh
make deploy-worker
```

<!-- Environment verified: install, lint, tests, and build all pass. -->
