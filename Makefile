include .env

up:
	docker compose up -d --build

down:
	docker compose down -v

log-sa:
	docker compose logs -f search-agent