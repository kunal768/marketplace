include .env

up:
	docker compose up -d --build

down:
	docker compose down -v

log-sa:
	docker compose logs -f search-agent

log-ls:
	docker compose logs -f listing-service

log-db:
	docker compose logs -f db