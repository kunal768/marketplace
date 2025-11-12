module github.com/kunal768/cmpe202/events-server

go 1.23.0

replace github.com/kunal768/cmpe202/http-lib => ../http-lib

require (
	github.com/gobwas/ws v1.4.0
	github.com/joho/godotenv v1.5.1
	github.com/rabbitmq/amqp091-go v1.10.0
	github.com/redis/go-redis/v9 v9.14.1
	github.com/kunal768/cmpe202/http-lib v0.0.0
)

require (
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/gobwas/httphead v0.1.0 // indirect
	github.com/gobwas/pool v0.2.1 // indirect
	github.com/google/uuid v1.6.0
	golang.org/x/sys v0.35.0 // indirect
)
