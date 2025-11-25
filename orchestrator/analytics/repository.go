package analytics

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository interface {
	GetTotalUsers(ctx context.Context) (int, error)
	GetTotalListings(ctx context.Context) (int, error)
	GetOpenFlags(ctx context.Context) (int, error)
	GetTotalFlags(ctx context.Context) (int, error)
	GetListingsByStatus(ctx context.Context) ([]ListingsByStatus, error)
	GetListingsByCategory(ctx context.Context) ([]ListingsByCategory, error)
	GetFlagsByStatus(ctx context.Context) ([]FlagsByStatus, error)
	GetFlagsByReason(ctx context.Context) ([]FlagsByReason, error)
}

type repo struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return &repo{
		db: db,
	}
}

func (r *repo) GetTotalUsers(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&count)
	return count, err
}

func (r *repo) GetTotalListings(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, "SELECT COUNT(*) FROM listings").Scan(&count)
	return count, err
}

func (r *repo) GetOpenFlags(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, "SELECT COUNT(*) FROM flagged_listings WHERE status = 'OPEN'").Scan(&count)
	return count, err
}

func (r *repo) GetTotalFlags(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, "SELECT COUNT(*) FROM flagged_listings").Scan(&count)
	return count, err
}

func (r *repo) GetListingsByStatus(ctx context.Context) ([]ListingsByStatus, error) {
	rows, err := r.db.Query(ctx, `
		SELECT status, COUNT(*) as count
		FROM listings
		GROUP BY status
		ORDER BY count DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []ListingsByStatus
	for rows.Next() {
		var item ListingsByStatus
		if err := rows.Scan(&item.Status, &item.Count); err != nil {
			return nil, err
		}
		results = append(results, item)
	}
	return results, rows.Err()
}

func (r *repo) GetListingsByCategory(ctx context.Context) ([]ListingsByCategory, error) {
	rows, err := r.db.Query(ctx, `
		SELECT category, COUNT(*) as count
		FROM listings
		GROUP BY category
		ORDER BY count DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []ListingsByCategory
	for rows.Next() {
		var item ListingsByCategory
		if err := rows.Scan(&item.Category, &item.Count); err != nil {
			return nil, err
		}
		results = append(results, item)
	}
	return results, rows.Err()
}

func (r *repo) GetFlagsByStatus(ctx context.Context) ([]FlagsByStatus, error) {
	rows, err := r.db.Query(ctx, `
		SELECT status, COUNT(*) as count
		FROM flagged_listings
		GROUP BY status
		ORDER BY count DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []FlagsByStatus
	for rows.Next() {
		var item FlagsByStatus
		if err := rows.Scan(&item.Status, &item.Count); err != nil {
			return nil, err
		}
		results = append(results, item)
	}
	return results, rows.Err()
}

func (r *repo) GetFlagsByReason(ctx context.Context) ([]FlagsByReason, error) {
	rows, err := r.db.Query(ctx, `
		SELECT reason, COUNT(*) as count
		FROM flagged_listings
		GROUP BY reason
		ORDER BY count DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []FlagsByReason
	for rows.Next() {
		var item FlagsByReason
		if err := rows.Scan(&item.Reason, &item.Count); err != nil {
			return nil, err
		}
		results = append(results, item)
	}
	return results, rows.Err()
}
