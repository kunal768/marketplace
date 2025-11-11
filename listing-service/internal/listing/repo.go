package listing

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	httplib "github.com/kunal768/cmpe202/http-lib"
	"github.com/kunal768/cmpe202/listing-service/internal/common"
	"github.com/kunal768/cmpe202/listing-service/internal/models"
)

// Better: pass *pgxpool.Pool and open per-call connections
type PgxPool interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

type Store struct{ P PgxPool }

func (s *Store) Create(ctx context.Context, userID string, p models.CreateParams) (models.Listing, error) {
	const q = `
	WITH u AS (
	SELECT user_id FROM users WHERE user_id = $5::uuid
	)
	INSERT INTO listings (title, description, price, category, user_id)
	SELECT $1, $2, $3, $4, u.user_id
	FROM u
	RETURNING id, title, description, price, category, user_id, status, created_at;
	`
	var l models.Listing
	err := s.P.QueryRow(ctx, q, p.Title, p.Description, p.Price, p.Category, userID).
		Scan(&l.ID, &l.Title, &l.Description, &l.Price, &l.Category, &l.UserID, &l.Status, &l.CreatedAt)
	log.Println("listing repo create done: ", userID)
	return l, err
}

func (s *Store) Get(ctx context.Context, id int64) (models.Listing, error) {
	const q = `SELECT id,title,description,price,category,user_id,status,created_at FROM listings WHERE id=$1`
	var l models.Listing
	err := s.P.QueryRow(ctx, q, id).
		Scan(&l.ID, &l.Title, &l.Description, &l.Price, &l.Category, &l.UserID, &l.Status, &l.CreatedAt)

	return l, err
}

func (s *Store) GetUserLists(ctx context.Context, user_id string) ([]models.Listing, error) {
	const q = `SELECT id,title,description,price,category,user_id,status,created_at FROM listings WHERE user_id=$1::uuid`
	var args []any
	args = append(args, user_id)
	rows, err := s.P.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.Listing
	for rows.Next() {
		var l models.Listing
		if err := rows.Scan(&l.ID, &l.Title, &l.Description, &l.Price, &l.Category, &l.UserID, &l.Status, &l.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (s *Store) List(ctx context.Context, f *models.ListFilters) ([]models.Listing, error) {
	sb := strings.Builder{}
	sb.WriteString(`SELECT id,title,description,price,category,user_id,status,created_at FROM listings`)
	var where []string
	var args []any
	i := 1

	if len(f.Keywords) > 0 {
		var words []string
		temp := strings.Builder{}
		temp.WriteString("(")
		for _, kw := range f.Keywords {
			words = append(words, fmt.Sprintf("(title ILIKE $%d OR description ILIKE $%d)", i, i+1))
			args = append(args, "%"+kw+"%", "%"+kw+"%")
			i += 2
		}
		temp.WriteString(strings.Join(words, " OR "))
		temp.WriteString(")")
		where = append(where, temp.String())
	}

	if f.Category != nil {
		where = append(where, fmt.Sprintf("category = $%d", i))
		args = append(args, *f.Category)
		i++
	}
	if f.Status != nil {
		where = append(where, fmt.Sprintf("status = $%d", i))
		args = append(args, *f.Status)
		i++
	}
	if f.MinPrice != nil {
		where = append(where, fmt.Sprintf("price >= $%d", i))
		args = append(args, *f.MinPrice)
		i++
	}
	if f.MaxPrice != nil {
		where = append(where, fmt.Sprintf("price <= $%d", i))
		args = append(args, *f.MaxPrice)
		i++
	}

	if len(where) > 0 {
		sb.WriteString(" WHERE " + strings.Join(where, " AND "))
	}

	switch f.Sort {
	case "price_asc":
		sb.WriteString(" ORDER BY price ASC")
	case "price_desc":
		sb.WriteString(" ORDER BY price DESC")
	default:
		sb.WriteString(" ORDER BY created_at DESC")
	}

	if f.Limit <= 0 || f.Limit > 100 {
		f.Limit = 20
	}
	sb.WriteString(fmt.Sprintf(" LIMIT %d OFFSET %d", f.Limit, f.Offset))

	log.Println("List SQL Query: \n", common.FormatQuery(sb.String(), args))

	rows, err := s.P.Query(ctx, sb.String(), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.Listing
	for rows.Next() {
		var l models.Listing
		if err := rows.Scan(&l.ID, &l.Title, &l.Description, &l.Price, &l.Category, &l.UserID, &l.Status, &l.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (s *Store) Update(ctx context.Context, id int64, userID string, p models.UpdateParams) (models.Listing, error) {
	// Build dynamic SET clause with positional parameters
	var sets []string
	var args []any
	i := 1

	if p.Title != nil {
		sets = append(sets, fmt.Sprintf("title=$%d", i))
		args = append(args, *p.Title)
		i++
	}
	if p.Description != nil {
		sets = append(sets, fmt.Sprintf("description=$%d", i))
		args = append(args, *p.Description)
		i++
	}
	if p.Price != nil {
		sets = append(sets, fmt.Sprintf("price=$%d", i))
		args = append(args, *p.Price)
		i++
	}
	if p.Category != nil {
		sets = append(sets, fmt.Sprintf("category=$%d", i))
		args = append(args, *p.Category)
		i++
	}
	if p.Status != nil {
		sets = append(sets, fmt.Sprintf("status=$%d", i))
		args = append(args, *p.Status)
		i++
	}

	if len(sets) == 0 {
		return s.Get(ctx, id)
	}

	// WHERE placeholders use the next indexes
	whereIDIdx := i
	whereUserIdx := i + 1

	q := fmt.Sprintf(`
		UPDATE listings
		SET %s
		WHERE id=$%d AND user_id=$%d
		RETURNING id, title, description, price, category, user_id, status, created_at
	`, strings.Join(sets, ","), whereIDIdx, whereUserIdx)

	// args order must match placeholders strictly
	args = append(args, id, userID) // if user_id is UUID, you can use userID or cast: $%d::uuid

	var l models.Listing
	err := s.P.QueryRow(ctx, q, args...).
		Scan(&l.ID, &l.Title, &l.Description, &l.Price, &l.Category, &l.UserID, &l.Status, &l.CreatedAt)
	return l, err
}

func (s *Store) Archive(ctx context.Context, id int64, userid string, userRole string) error {
	var args []any
	args = append(args, id)

	// Admin can archive any listing, regular user can only archive their own
	var query string
	if userRole == string(httplib.ADMIN) {
		query = `UPDATE listings SET status='ARCHIVED' WHERE id=$1`
	} else {
		query = `UPDATE listings SET status='ARCHIVED' WHERE id=$1 AND user_id=$2`
		args = append(args, userid)
	}

	_, err := s.P.Exec(ctx, query, args...)
	return err
}

func (s *Store) Delete(ctx context.Context, id int64, userid string, userRole string) error {
	var args []any
	args = append(args, id)

	// Admin can delete any listing, regular user can only delete their own
	var query string
	if userRole == string(httplib.ADMIN) {
		query = `DELETE FROM listings WHERE id=$1`
	} else {
		query = `DELETE FROM listings WHERE id=$1 AND user_id=$2`
		args = append(args, userid)
	}

	log.Println("Testing Delete Query: ", common.FormatQuery(query, args))
	_, err := s.P.Exec(ctx, query, args...)
	log.Println("Finished Delete Query: ", err)
	return err
}

func (s *Store) AddMediaUrls(ctx context.Context, listingID int64, userID string, urls []string) error {
	// First verify the listing exists and belongs to the user
	var ownerID string
	err := s.P.QueryRow(ctx, `SELECT user_id::text FROM listings WHERE id=$1`, listingID).Scan(&ownerID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("listing not found")
		}
		return fmt.Errorf("failed to verify listing ownership: %w", err)
	}

	if ownerID != userID {
		return fmt.Errorf("listing does not belong to user")
	}

	// Insert all URLs into listing_media table
	// Using a batch insert with VALUES clause for efficiency
	if len(urls) == 0 {
		return fmt.Errorf("no URLs provided")
	}

	// Build VALUES clause with positional parameters
	var valueParts []string
	var args []any
	argIndex := 1

	for _, url := range urls {
		if url == "" {
			continue // Skip empty URLs
		}
		valueParts = append(valueParts, fmt.Sprintf("($%d, $%d)", argIndex, argIndex+1))
		args = append(args, listingID, url)
		argIndex += 2
	}

	if len(valueParts) == 0 {
		return fmt.Errorf("no valid URLs provided")
	}

	query := fmt.Sprintf(`
		INSERT INTO listing_media (listing_id, media_url)
		VALUES %s
	`, strings.Join(valueParts, ", "))

	_, err = s.P.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to insert media URLs: %w", err)
	}

	return nil
}

// GetFlaggedListings retrieves all flagged listings with their associated listing details
// If status is provided, filters by flag status. Otherwise returns all flagged listings.
func (s *Store) GetFlaggedListings(ctx context.Context, status *string) ([]models.FlaggedListing, error) {
	query := `
		SELECT 
			fl.id,
			fl.listing_id,
			fl.reporter_user_id,
			fl.reason,
			fl.details,
			fl.status,
			fl.reviewer_user_id,
			fl.resolution_notes,
			fl.created_at,
			fl.updated_at,
			fl.resolved_at,
			l.id,
			l.title,
			l.description,
			l.price,
			l.category,
			l.user_id,
			l.status,
			l.created_at
		FROM flagged_listings fl
		JOIN listings l ON fl.listing_id = l.id
	`

	var args []any
	if status != nil && *status != "" {
		query += " WHERE fl.status = $1"
		args = append(args, *status)
	}

	query += " ORDER BY fl.created_at DESC"

	log.Println("GetFlaggedListings SQL Query: \n", common.FormatQuery(query, args))

	rows, err := s.P.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.FlaggedListing
	for rows.Next() {
		var fl models.FlaggedListing
		var listing models.Listing

		err := rows.Scan(
			&fl.FlagID,
			&fl.ListingID,
			&fl.ReporterUserID,
			&fl.Reason,
			&fl.Details,
			&fl.Status,
			&fl.ReviewerUserID,
			&fl.ResolutionNotes,
			&fl.FlagCreatedAt,
			&fl.FlagUpdatedAt,
			&fl.FlagResolvedAt,
			&listing.ID,
			&listing.Title,
			&listing.Description,
			&listing.Price,
			&listing.Category,
			&listing.UserID,
			&listing.Status,
			&listing.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan flagged listing: %w", err)
		}

		fl.Listing = listing
		out = append(out, fl)
	}

	return out, rows.Err()
}
