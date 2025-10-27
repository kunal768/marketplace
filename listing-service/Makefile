include .env

up:
	docker compose up -d --build

down:
	docker compose down

psql:
	docker exec -it listing-service-db-1 psql -U postgres -d app

dev:
	go run ./cmd/api

clean-db:
	docker compose down -v