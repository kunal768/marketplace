package db

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type dbsvc struct {
	connStr string
}

type DBService interface {
	Connect() (*pgxpool.Pool, error)
}

func NewDBService(connStr string) DBService {
	return &dbsvc{
		connStr: connStr,
	}
}

func (svc *dbsvc) Connect() (*pgxpool.Pool, error) {
	dbctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := pgxpool.New(dbctx, svc.connStr)
	if err != nil {
		return nil, err
	}

	// Ping database to verify connection
	err = pool.Ping(dbctx)
	if err != nil {
		pool.Close()
		return nil, err
	}

	return pool, nil
}
