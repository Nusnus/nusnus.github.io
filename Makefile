.PHONY: dev build preview lint lint-fix format format-check test type-check fetch-data clean

# ─── Development ───

dev:
	bun run dev --host 0.0.0.0

# ─── Build ───

build:
	bun run build

# ─── Preview production build ───

preview:
	bun run preview --host 0.0.0.0

# ─── Quality ───

lint:
	bun run lint

lint-fix:
	bun run lint:fix

format:
	bun run format

format-check:
	bun run format:check

test:
	bun run test

type-check:
	bun run type-check

# ─── Data ───

fetch-data:
	bun run fetch-data

# ─── Cleanup ───

clean:
	rm -rf dist .astro node_modules

