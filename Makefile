.PHONY: help dev build preview lint lint-fix format format-check test type-check fetch-data pre-commit clean deploy-worker

.DEFAULT_GOAL := help

# ─── Help ───

help: ## Show this help message
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ─── Development ───

dev: ## Start dev server
	bun run dev --host 0.0.0.0

# ─── Build ───

build: ## Build for production
	bun run build

# ─── Preview production build ───

preview: ## Preview production build
	bun run preview --host 0.0.0.0

# ─── Quality ───

lint: ## Run linter
	bun run lint

lint-fix: ## Run linter with auto-fix
	bun run lint:fix

format: ## Format code
	bun run format

format-check: ## Check code formatting
	bun run format:check

test: ## Run tests
	bun run test

type-check: ## Run type checking
	bun run type-check

# ─── Pre-commit ───

pre-commit: ## Run pre-commit hooks
	bunx lefthook run pre-commit --force

# ─── Data ───

fetch-data: ## Fetch external data
	bun run fetch-data

# ─── Worker ───

deploy-worker: ## Deploy Cloudflare Worker (AI proxy)
	cd worker && bunx wrangler deploy

# ─── Cleanup ───

clean: ## Remove build artifacts and dependencies
	rm -rf dist .astro node_modules

