package clients

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type UserRole int

const (
	ADMIN UserRole = 0 // admin
	USER  UserRole = 1 // buyer, seller both are same roles
)

func FetchUserRole(ctx context.Context, dbPool *pgxpool.Pool, userId string) (UserRole, error) {
	var role UserRole
	err := dbPool.QueryRow(ctx, `SELECT role FROM users WHERE user_id = $1`, userId).Scan(&role)
	return role, err
}
