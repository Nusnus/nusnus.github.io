.PHONY: dev dev-build build install preview lint lint-fix format format-check test type-check fetch-data stop clean

# ─── Development ───

dev:
	docker compose up

dev-build:
	docker compose up --build

# ─── Build ───

build:
	docker compose run --rm app pnpm build

# ─── Install / Rebuild ───

install:
	docker compose build --no-cache

# ─── Preview production build ───

preview:
	docker compose run --rm --service-ports app pnpm preview --host 0.0.0.0

# ─── Quality ───

lint:
	docker compose run --rm app pnpm lint

lint-fix:
	docker compose run --rm app pnpm lint:fix

format:
	docker compose run --rm app pnpm format

format-check:
	docker compose run --rm app pnpm format:check

test:
	docker compose run --rm app pnpm test

type-check:
	docker compose run --rm app pnpm type-check

# ─── Data ───

fetch-data:
	docker compose run --rm -e GITHUB_TOKEN=$(GITHUB_TOKEN) app pnpm fetch-data

# ─── Cleanup ───

stop:
	docker compose down

clean:
	docker compose down -v

