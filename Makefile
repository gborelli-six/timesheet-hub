.PHONY: up down logs migrate makemigration test-backend test-frontend e2e lint format type-check check seed

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

migrate:
	docker compose exec backend uv run alembic upgrade head

makemigration:
	docker compose exec backend uv run alembic revision --autogenerate -m "$(msg)"

test-backend:
	docker compose exec backend uv run pytest

test-frontend:
	docker compose exec frontend npm test

e2e:
	E2E_TEST_MODE=true docker compose --profile e2e --profile proxy up -d
	cd e2e && npm ci && npx playwright install --with-deps chromium
	cd e2e && npx playwright test

lint:
	docker compose exec backend uv run ruff check .
	docker compose exec frontend npm run lint

format:
	docker compose exec backend uv run ruff format .
	docker compose exec frontend npm run format

type-check:
	docker compose exec frontend npm run type-check

check: lint type-check

seed:
	@echo "Seed: no-op in E1. Implementato con i modelli user/backend_config (STORY-008, E2/E3/E7)."
