.PHONY: run stop build migrate createsuperuser shell test lint format seed logs

# ----------------------------------------------------------------
# Compose shortcuts
# ----------------------------------------------------------------
run:
	docker compose up -d

run-fg:
	docker compose up

stop:
	docker compose down

build:
	docker compose build

restart:
	docker compose restart app celery celery-beat

logs:
	docker compose logs -f app

logs-all:
	docker compose logs -f

# ----------------------------------------------------------------
# Django management
# ----------------------------------------------------------------
migrate:
	docker compose exec app python manage.py migrate

makemigrations:
	docker compose exec app python manage.py makemigrations

createsuperuser:
	docker compose exec app python manage.py createsuperuser

shell:
	docker compose exec app python manage.py shell

dbshell:
	docker compose exec app python manage.py dbshell

collectstatic:
	docker compose exec app python manage.py collectstatic --noinput

# ----------------------------------------------------------------
# Seed data
# ----------------------------------------------------------------
seed:
	docker compose exec app python manage.py seed_categories
	docker compose exec app python manage.py seed_porto_alegre

seed-categories:
	docker compose exec app python manage.py seed_categories

seed-poa:
	docker compose exec app python manage.py seed_porto_alegre

# ----------------------------------------------------------------
# Tests
# ----------------------------------------------------------------
test:
	docker compose exec app pytest apps/ -v --tb=short

test-cov:
	docker compose exec app pytest apps/ -v --cov=apps --cov-report=html --cov-report=term

# ----------------------------------------------------------------
# Linting & formatting
# ----------------------------------------------------------------
lint:
	docker compose exec app flake8 apps/ config/
	docker compose exec app isort --check-only apps/ config/

format:
	docker compose exec app black apps/ config/
	docker compose exec app isort apps/ config/

# ----------------------------------------------------------------
# Dev helpers
# ----------------------------------------------------------------
psql:
	docker compose exec db psql -U postgres -d poa_eventos

redis-cli:
	docker compose exec redis redis-cli

env:
	cp .env.example .env
	@echo ".env criado — preencha as variáveis antes de rodar."
