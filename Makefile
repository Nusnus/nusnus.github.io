.PHONY: dev dev-build build install preview lint lint-fix format format-check test type-check fetch-data stop clean

# ─── Development ───

dev:
	docker compose up

dev-build:
	docker compose up --build

# ─── Build ───

build:
	docker compose run --rm app bun run build

# ─── Install / Rebuild ───

install:
	docker compose build --no-cache

# ─── Preview production build ───

preview:
	docker compose run --rm --service-ports app bun run preview --host 0.0.0.0

# ─── Quality ───

lint:
	docker compose run --rm app bun run lint

lint-fix:
	docker compose run --rm app bun run lint:fix

format:
	docker compose run --rm app bun run format

format-check:
	docker compose run --rm app bun run format:check

test:
	docker compose run --rm app bun run test

type-check:
	docker compose run --rm app bun run type-check

# ─── Data ───

fetch-data:
	docker compose run --rm -e GITHUB_TOKEN=$(GITHUB_TOKEN) app bun run fetch-data

# ─── Cleanup ───

stop:
	docker compose down

clean:
	docker compose down -v

