package clients

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

func FetchUserRole(ctx context.Context, dbPool *pgxpool.Pool, userId string) (string, error) {
	var role string
	err := dbPool.QueryRow(ctx, `SELECT role FROM users WHERE user_id = $1`, userId).Scan(&role)
	return role, err
}
