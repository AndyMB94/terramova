# Punto de entrada de comandos de TerraMova. `make help` lista los objetivos.
SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

COMPOSE := docker compose
PRE_COMMIT := uvx --from pre-commit==4.7.0 pre-commit
BACKEND := cd backend &&
FRONTEND := pnpm --dir frontend

.PHONY: help env setup up down logs ps migrate web \
	lint lint-backend lint-frontend fmt test test-backend test-frontend build check precommit

help: ## Lista los objetivos disponibles
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

env: .env ## Crea .env desde .env.example con secretos aleatorios (no sobrescribe)

.env:
	python3 infra/scripts/create_dev_env.py

setup: .env ## Instala dependencias (backend, frontend) y los hooks de pre-commit
	$(BACKEND) uv sync --locked
	$(FRONTEND) install --frozen-lockfile
	$(PRE_COMMIT) install

up: .env ## Levanta db, redis y backend (espera a que estén sanos)
	$(COMPOSE) up -d --build --wait

down: ## Detiene los servicios (conserva los volúmenes)
	$(COMPOSE) down

logs: ## Sigue los logs de los servicios
	$(COMPOSE) logs -f

ps: ## Estado de los servicios y puertos publicados
	$(COMPOSE) ps

migrate: ## Aplica migraciones en el contenedor backend
	$(COMPOSE) exec backend python manage.py migrate

web: ## Servidor de desarrollo del frontend en http://127.0.0.1:5173
	$(FRONTEND) dev

lint: lint-backend lint-frontend ## Lint, formato, tipos y reglas de capas

lint-backend:
	$(BACKEND) uv run ruff check .
	$(BACKEND) uv run ruff format --check .
	$(BACKEND) uv run mypy .
	$(BACKEND) uv run lint-imports

lint-frontend:
	$(FRONTEND) lint
	$(FRONTEND) format:check
	$(FRONTEND) typecheck

fmt: ## Formatea backend y frontend
	$(BACKEND) uv run ruff check --fix .
	$(BACKEND) uv run ruff format .
	$(FRONTEND) format

test: test-backend test-frontend ## Tests (el backend necesita `make up`)

test-backend:
	$(BACKEND) uv run python manage.py makemigrations --check --dry-run --settings=config.settings.test
	$(BACKEND) uv run pytest

test-frontend:
	$(FRONTEND) test

build: ## Compila el frontend
	$(FRONTEND) build

check: lint test build ## Todo lo que ejecuta la CI

precommit: ## Ejecuta los hooks de pre-commit sobre todo el repositorio
	$(PRE_COMMIT) run --all-files
