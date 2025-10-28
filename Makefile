include .env

up:
	docker compose up -d --build

down:
	docker compose down -v

log-or:
	docker compose logs -f orchestrator

log-ls:
	docker compose logs -f listing-service

log-db:
	docker compose logs -f db