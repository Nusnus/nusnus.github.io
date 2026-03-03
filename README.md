# nusnus.github.io

Portfolio & activity dashboard for [Tomer Nosrati (Nusnus)](https://github.com/Nusnus).

Built with **Astro 5**, **Tailwind CSS v4**, and **React** islands. Self-maintained via GitHub Actions. Deployed to GitHub Pages.

## Prerequisites

- [Bun](https://bun.sh/) ≥ 1.1
- Or: open in VS Code with the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension

## Quick Start

```sh
# Local
bun install
bun run dev

# Or: VS Code Dev Container
# Cmd+Shift+P → "Dev Containers: Reopen in Container"
```

Open [http://localhost:4321](http://localhost:4321).

## Commands

| Command             | Action                                       |
| :------------------ | :------------------------------------------- |
| `make dev`          | Start dev server at `localhost:4321`         |
| `make build`        | Build production site to `./dist/`           |
| `make preview`      | Preview production build locally             |
| `make lint`         | Run ESLint                                   |
| `make lint-fix`     | Run ESLint with auto-fix                     |
| `make format`       | Format all files with Prettier               |
| `make format-check` | Check formatting without writing             |
| `make test`         | Run Vitest                                   |
| `make type-check`   | Run TypeScript type checking                 |
| `make fetch-data`   | Fetch fresh GitHub data (needs GITHUB_TOKEN) |
| `make clean`        | Remove dist, .astro, and node_modules        |

## Self-Maintenance

The site automatically stays up-to-date via GitHub Actions:

1. **`update-data.yml`** runs every 4 hours, fetches GitHub data (profile, repos, events, contribution graph), and commits updated JSON to `public/data/`.
2. **`deploy.yml`** triggers on every push to `main`, builds the site, and deploys to GitHub Pages.
3. **`lint.yml`** runs on PRs and pushes — type checking, linting, formatting, and tests.

## Adding a Blog Post

Create a Markdown file in `src/content/blog/`:

```md
---
title: My First Post
description: A short description
publishedAt: 2026-03-03
tags: [open-source, celery]
---

Your content here.
```

The post will automatically appear at `/blog/your-file-name`.

## Environment Variables

Copy `.env.example` to `.env` and set `GITHUB_TOKEN` for local data fetching. This is optional — the site works with seed data out of the box.

## Tech Stack

- **Framework**: Astro 5 (static-first, island architecture)
- **Styling**: Tailwind CSS v4 (CSS-first config, oklch colors)
- **Islands**: React (ThemeToggle, ContributionGraph, ActivityFeed, StatusDot)
- **Validation**: Zod (data schemas)
- **Linting**: ESLint 10 (flat config) + Prettier
- **Runtime**: Bun (package management, script execution, TypeScript runner)
- **Testing**: Vitest
- **CI/CD**: GitHub Actions
- **Hosting**: GitHub Pages
