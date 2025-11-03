include .env

up:
	docker compose up -d --build

down:
	docker compose down -v

psql:
	docker exec -it db psql -U postgres -d app

log-or:
	docker compose logs -f orchestrator

log-ls:
	docker compose logs -f listing-service

log-db:
	docker compose logs -f db