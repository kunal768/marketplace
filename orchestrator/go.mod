module github.com/kunal768/cmpe202/orchestrator

go 1.23.0

toolchain go1.24.7

require (
	github.com/google/uuid v1.6.0
	github.com/jackc/pgx/v5 v5.7.6
	github.com/joho/godotenv v1.5.1
	github.com/kunal768/cmpe202/http-lib v0.0.0-00010101000000-000000000000
	golang.org/x/crypto v0.37.0
)

require (
	github.com/golang-jwt/jwt/v5 v5.3.0 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/sirupsen/logrus v1.9.3 // indirect
	golang.org/x/sync v0.13.0 // indirect
	golang.org/x/sys v0.32.0 // indirect
	golang.org/x/text v0.24.0 // indirect
)

replace github.com/kunal768/cmpe202/http-lib => ../http-lib
