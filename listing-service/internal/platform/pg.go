package platform

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

func MustPGPool(ctx context.Context) *pgxpool.Pool {

	// --- Database Connection (no changes) ---
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")
	dsn := fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=require",
		dbUser, dbPassword, dbHost, dbPort, dbName,
	)

	log.Println("connecting to Postgres Database at: ", dsn)

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		panic(err)
	}
	if err := pool.Ping(ctx); err != nil {
		panic(err)
	}
	return pool
}
