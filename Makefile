include .env

up:
	docker compose up -d --build

down:
	docker compose down -v

psql:
	psql $(DATABASE_URL)

redis:
	docker compose exec redis redis-cli

mongo:
	docker compose exec mongo mongosh

log-or:
	docker compose logs -f orchestrator

log-ls:
	docker compose logs -f listing-service

log-db:
	docker compose logs -f db

log-fr:
	docker compose logs -f frontend

log-es:
	docker compose logs -f events-server

log-cc:
	docker compose logs -f chat-consumer