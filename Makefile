.DEFAULT_GOAL := help

NPM ?= npm
DC ?= docker compose

COMPOSE_FILE ?= docker-compose.yml
POSTGRES_COMPOSE_FILE ?= docker-compose.postgres.yml

WEB_PACKAGE ?= @patchwork/web

.PHONY: \
	help \
	install env-init \
	dev dev-web dev-api dev-api-postgres dev-indexer dev-moderation \
	db-up db-down db-migrate make-db-migrate db-seed db-reset \
	lint typecheck test test-phase7 test-phase8 test-phase8-e2e test-web-e2e check build \
	quality \
	deploy-network deploy-build deploy-up deploy-down deploy-restart deploy-ps deploy-logs deploy-pull deploy-db-migrate \
	compose-config

help: ## Show available make targets
	@awk 'BEGIN {FS = ":.*##"; printf "\nPatchwork Make targets\n\n"} /^[a-zA-Z0-9_.-]+:.*##/ {printf "  %-24s %s\n", $$1, $$2} END {printf "\n"}' $(MAKEFILE_LIST)

install: ## Install all monorepo dependencies
	$(NPM) ci

env-init: ## Create .env from .env.example if it does not exist
	@if [ -f .env ]; then \
		echo ".env already exists (no changes made)."; \
	else \
		cp .env.example .env; \
		echo "Created .env from .env.example"; \
	fi

dev: dev-web ## Start web app (default local dev surface)

dev-web: ## Start web app (Vite)
	$(NPM) run dev:web

dev-api: ## Start API in fixture mode
	$(NPM) run dev:api

dev-api-postgres: ## Start API in postgres mode
	$(NPM) run dev:api:postgres

dev-indexer: ## Start indexer service
	$(NPM) run dev:indexer

dev-moderation: ## Start moderation worker
	$(NPM) run dev:moderation

db-up: ## Start local Postgres for development
	$(NPM) run db:up

db-down: ## Stop local Postgres for development
	$(NPM) run db:down

db-migrate: ## Run versioned API database migrations
	$(NPM) run db:migrate

make-db-migrate: db-migrate ## Alias target for db-migrate

db-seed: ## Seed local Postgres with deterministic data
	$(NPM) run db:seed

db-reset: db-down db-up db-seed ## Recreate and reseed local Postgres

lint: ## Run lint checks across workspaces
	$(NPM) run lint

typecheck: ## Run TypeScript checks across workspaces
	$(NPM) run typecheck

test: ## Run unit/integration tests across workspaces
	$(NPM) run test

test-phase7: ## Run moderation/privacy regression tests
	$(NPM) run test:phase7

test-phase8: ## Run phase 8 regression tests
	$(NPM) run test:phase8

test-phase8-e2e: ## Run API request-to-handoff contract E2E tests
	$(NPM) run test:phase8-e2e

test-web-e2e: ## Run Playwright browser E2E tests for web app
	$(NPM) run test:e2e -w $(WEB_PACKAGE)

check: ## Run the default local gate (lint + typecheck + test)
	$(NPM) run check

quality: check test-phase7 ## Run merge-readiness quality gate

build: ## Build all workspaces
	$(NPM) run build

deploy-network: ## Ensure external Docker network "web" exists
	@docker network inspect web >/dev/null 2>&1 || docker network create web

compose-config: ## Validate production compose file
	$(DC) -f $(COMPOSE_FILE) config >/dev/null

deploy-build: ## Build production Docker images from compose file
	$(DC) -f $(COMPOSE_FILE) build

deploy-up: deploy-network ## Start production stack (detached, with build)
	$(DC) -f $(COMPOSE_FILE) up -d --build

deploy-down: ## Stop production stack
	$(DC) -f $(COMPOSE_FILE) down

deploy-restart: ## Restart production stack services
	$(DC) -f $(COMPOSE_FILE) restart

deploy-ps: ## Show production stack container status
	$(DC) -f $(COMPOSE_FILE) ps

deploy-logs: ## Tail production stack logs
	$(DC) -f $(COMPOSE_FILE) logs -f --tail=200

deploy-pull: ## Pull latest upstream images referenced by compose file
	$(DC) -f $(COMPOSE_FILE) pull

deploy-db-migrate: deploy-network ## Run DB migrations via production API container
	$(DC) -f $(COMPOSE_FILE) up -d postgres
	$(DC) -f $(COMPOSE_FILE) run --build --rm patchwork-api npm run db:migrate -w @patchwork/api
