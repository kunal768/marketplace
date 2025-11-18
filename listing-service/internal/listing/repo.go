package listing

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/google/uuid"
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

func (s *Store) GetListingsByUserID(ctx context.Context, targetUserID string) ([]models.Listing, error) {
	const q = `SELECT id,title,description,price,category,user_id,status,created_at FROM listings WHERE user_id=$1::uuid`
	var args []any
	args = append(args, targetUserID)
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
	hasKeywords := len(f.Keywords) > 0

	// First, prepare all keyword parameters for reuse
	var keywordArgs []any
	if hasKeywords {
		for _, kw := range f.Keywords {
			keywordPattern := "%" + kw + "%"
			keywordArgs = append(keywordArgs, keywordPattern, keywordPattern) // One for title, one for description
		}
	}

	// Build SELECT clause with keyword score if keywords are present
	sb := strings.Builder{}
	var selectFields []string
	selectFields = append(selectFields, "id", "title", "description", "price", "category", "user_id", "status", "created_at")

	var scoreParts []string
	paramNum := 1

	if hasKeywords {
		// Build score calculation: title matches weighted 2x, description matches weighted 1x
		for i := 0; i < len(f.Keywords); i++ {
			// Title match (weighted 2x) - uses paramNum
			scoreParts = append(scoreParts, fmt.Sprintf("CASE WHEN title ILIKE $%d THEN 2 ELSE 0 END", paramNum))
			paramNum++
			// Description match (weighted 1x) - uses paramNum
			scoreParts = append(scoreParts, fmt.Sprintf("CASE WHEN description ILIKE $%d THEN 1 ELSE 0 END", paramNum))
			paramNum++
		}
		scoreExpr := "(" + strings.Join(scoreParts, " + ") + ") AS keyword_score"
		selectFields = append(selectFields, scoreExpr)
	}

	sb.WriteString("SELECT " + strings.Join(selectFields, ", ") + " FROM listings")

	// Build WHERE clause
	var where []string
	var args []any

	// Add keyword parameters first (they're already prepared)
	if hasKeywords {
		args = append(args, keywordArgs...)
		// Build WHERE conditions using the same parameters
		var keywordConditions []string
		kwParamNum := 1
		for range f.Keywords {
			keywordConditions = append(keywordConditions, fmt.Sprintf("(title ILIKE $%d OR description ILIKE $%d)", kwParamNum, kwParamNum+1))
			kwParamNum += 2
		}
		where = append(where, "("+strings.Join(keywordConditions, " OR ")+")")
	}

	// Add other filters (category, status, price)
	currentParamNum := len(args) + 1

	if f.Category != nil {
		where = append(where, fmt.Sprintf("category = $%d", currentParamNum))
		args = append(args, *f.Category)
		currentParamNum++
	}
	if f.Status != nil {
		where = append(where, fmt.Sprintf("status = $%d", currentParamNum))
		args = append(args, *f.Status)
		currentParamNum++
	}
	if f.MinPrice != nil {
		where = append(where, fmt.Sprintf("price >= $%d", currentParamNum))
		args = append(args, *f.MinPrice)
		currentParamNum++
	}
	if f.MaxPrice != nil {
		where = append(where, fmt.Sprintf("price <= $%d", currentParamNum))
		args = append(args, *f.MaxPrice)
		currentParamNum++
	}

	if len(where) > 0 {
		sb.WriteString(" WHERE " + strings.Join(where, " AND "))
	}

	// Build ORDER BY clause
	// If keywords are present, order by keyword_score DESC first, then by the requested sort
	// If no keywords, use the requested sort directly
	var orderBy []string
	if hasKeywords {
		// Order by relevance score first (highest first)
		orderBy = append(orderBy, "keyword_score DESC")
	}

	// Then apply the requested sort
	switch f.Sort {
	case "price_asc":
		orderBy = append(orderBy, "price ASC")
	case "price_desc":
		orderBy = append(orderBy, "price DESC")
	default:
		orderBy = append(orderBy, "created_at DESC")
	}

	sb.WriteString(" ORDER BY " + strings.Join(orderBy, ", "))

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
		if hasKeywords {
			// Scan includes keyword_score, but we don't need to store it
			var keywordScore int
			if err := rows.Scan(&l.ID, &l.Title, &l.Description, &l.Price, &l.Category, &l.UserID, &l.Status, &l.CreatedAt, &keywordScore); err != nil {
				return nil, err
			}
		} else {
			if err := rows.Scan(&l.ID, &l.Title, &l.Description, &l.Price, &l.Category, &l.UserID, &l.Status, &l.CreatedAt); err != nil {
				return nil, err
			}
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (s *Store) Update(ctx context.Context, id int64, userID string, userRole string, p models.UpdateParams) (models.Listing, error) {
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

	// Admin can update any listing, regular user can only update their own
	var q string
	if userRole == string(httplib.ADMIN) {
		q = fmt.Sprintf(`
			UPDATE listings
			SET %s
			WHERE id=$%d
			RETURNING id, title, description, price, category, user_id, status, created_at
		`, strings.Join(sets, ","), whereIDIdx)
		args = append(args, id)
	} else {
		whereUserIdx := i + 1
		q = fmt.Sprintf(`
			UPDATE listings
			SET %s
			WHERE id=$%d AND user_id=$%d
			RETURNING id, title, description, price, category, user_id, status, created_at
		`, strings.Join(sets, ","), whereIDIdx, whereUserIdx)
		args = append(args, id, userID)
	}

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

// UpdateFlagListing updates a flagged listing
func (s *Store) UpdateFlagListing(ctx context.Context, flagID int64, userID string, p models.UpdateFlagParams) (models.FlaggedListing, error) {

	// First verify the flag exists
	var flag models.FlaggedListing
	err := s.P.QueryRow(ctx, `SELECT id,listing_id,reporter_user_id,reason,details,status,reviewer_user_id,resolution_notes,created_at,updated_at,resolved_at FROM flagged_listings WHERE id=$1`, flagID).
		Scan(&flag.FlagID, &flag.ListingID, &flag.ReporterUserID, &flag.Reason, &flag.Details, &flag.Status, &flag.ReviewerUserID, &flag.ResolutionNotes, &flag.FlagCreatedAt, &flag.FlagUpdatedAt, &flag.FlagResolvedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return models.FlaggedListing{}, fmt.Errorf("flag not found")
		}
		return models.FlaggedListing{}, fmt.Errorf("failed to verify flag: %w", err)
	}

	// Update the flag in flagged_listings table
	const updateFlagQuery = `
		UPDATE flagged_listings
		SET status=$1, resolution_notes=$2, updated_at=now()
		WHERE id=$3
		RETURNING id, listing_id, reporter_user_id, reason, details, status, reviewer_user_id, resolution_notes, created_at, updated_at, resolved_at
	`

	var updatedFlag models.FlaggedListing
	err = s.P.QueryRow(ctx, updateFlagQuery, p.Status, p.ResolutionNotes, flagID).
		Scan(
			&updatedFlag.FlagID,
			&updatedFlag.ListingID,
			&updatedFlag.ReporterUserID,
			&updatedFlag.Reason,
			&updatedFlag.Details,
			&updatedFlag.Status,
			&updatedFlag.ReviewerUserID,
			&updatedFlag.ResolutionNotes,
			&updatedFlag.FlagCreatedAt,
			&updatedFlag.FlagUpdatedAt,
			&updatedFlag.FlagResolvedAt,
		)
	if err != nil {
		return models.FlaggedListing{}, fmt.Errorf("failed to update flag: %w", err)
	}

	return updatedFlag, nil
}

// FlagListing creates a new flag for a listing
func (s *Store) FlagListing(ctx context.Context, listingID int64, reporterUserID string, p models.CreateFlagParams) (models.FlaggedListing, error) {
	// First verify the listing exists
	var listing models.Listing
	err := s.P.QueryRow(ctx, `SELECT id,title,description,price,category,user_id,status,created_at FROM listings WHERE id=$1`, listingID).
		Scan(&listing.ID, &listing.Title, &listing.Description, &listing.Price, &listing.Category, &listing.UserID, &listing.Status, &listing.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return models.FlaggedListing{}, fmt.Errorf("listing not found")
		}
		return models.FlaggedListing{}, fmt.Errorf("failed to verify listing: %w", err)
	}

	// Parse reporter user ID
	reporterUUID, err := uuid.Parse(reporterUserID)
	if err != nil {
		return models.FlaggedListing{}, fmt.Errorf("invalid reporter user ID: %w", err)
	}

	// Check if user has already flagged this listing
	var existingFlagID int64
	err = s.P.QueryRow(ctx, `SELECT id FROM flagged_listings WHERE listing_id=$1 AND reporter_user_id=$2`, listingID, reporterUUID).Scan(&existingFlagID)
	if err == nil {
		// User has already flagged this listing
		return models.FlaggedListing{}, fmt.Errorf("user has already flagged this listing")
	}
	if err != pgx.ErrNoRows {
		// Some other database error occurred
		return models.FlaggedListing{}, fmt.Errorf("failed to check existing flags: %w", err)
	}
	// err == pgx.ErrNoRows means no existing flag, which is what we want

	// Insert the flag into flagged_listings table
	// Status defaults to 'OPEN' as per database schema
	const insertFlagQuery = `
		INSERT INTO flagged_listings (listing_id, reporter_user_id, reason, details, status)
		VALUES ($1, $2::uuid, $3, $4, 'OPEN')
		RETURNING id, listing_id, reporter_user_id, reason, details, status, reviewer_user_id, resolution_notes, created_at, updated_at, resolved_at
	`

	var fl models.FlaggedListing
	err = s.P.QueryRow(ctx, insertFlagQuery, listingID, reporterUUID, p.Reason, p.Details).
		Scan(
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
		)
	if err != nil {
		return models.FlaggedListing{}, fmt.Errorf("failed to create flag: %w", err)
	}

	// Update listing status to REPORTED when flagged
	// Always update status to REPORTED regardless of current status
	_, err = s.P.Exec(ctx, `UPDATE listings SET status='REPORTED' WHERE id=$1`, listingID)
	if err != nil {
		log.Printf("Warning: Failed to update listing status to REPORTED: %v", err)
		// Don't fail the flag creation if status update fails
	} else {
		// Update the local listing status for the response
		listing.Status = models.StReported
	}

	// Set the listing information
	fl.Listing = listing

	log.Println("Flag created successfully for listing:", listingID)
	return fl, nil
}

// DeleteFlagListing deletes a flagged listing (admin only)
func (s *Store) DeleteFlagListing(ctx context.Context, flagID int64) error {
	// First verify the flag exists
	var exists bool
	err := s.P.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM flagged_listings WHERE id=$1)`, flagID).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to verify flag: %w", err)
	}
	if !exists {
		return fmt.Errorf("flag not found")
	}

	// Delete the flag
	_, err = s.P.Exec(ctx, `DELETE FROM flagged_listings WHERE id=$1`, flagID)
	if err != nil {
		return fmt.Errorf("failed to delete flag: %w", err)
	}

	return nil
}

// HasUserFlaggedListing checks if a user has already flagged a specific listing
func (s *Store) HasUserFlaggedListing(ctx context.Context, listingID int64, userID string) (bool, error) {
	reporterUUID, err := uuid.Parse(userID)
	if err != nil {
		return false, fmt.Errorf("invalid user ID: %w", err)
	}

	var flagID int64
	err = s.P.QueryRow(ctx, `SELECT id FROM flagged_listings WHERE listing_id=$1 AND reporter_user_id=$2`, listingID, reporterUUID).Scan(&flagID)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to check if user flagged listing: %w", err)
	}
	return true, nil
}

// GetMediaUrls retrieves all media URLs for a listing
func (s *Store) GetMediaUrls(ctx context.Context, listingID int64) ([]models.ListingMedia, error) {
	const q = `SELECT id, listing_id, media_url, created_at FROM listing_media WHERE listing_id = $1 ORDER BY created_at ASC`
	
	rows, err := s.P.Query(ctx, q, listingID)
	if err != nil {
		return nil, fmt.Errorf("failed to query media URLs: %w", err)
	}
	defer rows.Close()

	var media []models.ListingMedia
	for rows.Next() {
		var m models.ListingMedia
		if err := rows.Scan(&m.ID, &m.ListingID, &m.MediaURL, &m.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan media URL: %w", err)
		}
		media = append(media, m)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating media URLs: %w", err)
	}

	return media, nil
}

// UpdateMediaUrl updates a media URL by ID
func (s *Store) UpdateMediaUrl(ctx context.Context, mediaID int64, listingID int64, userID string, userRole string, newURL string) error {
	// First verify the listing exists and belongs to the user (or user is admin)
	var ownerID string
	err := s.P.QueryRow(ctx, `SELECT user_id::text FROM listings WHERE id=$1`, listingID).Scan(&ownerID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("listing not found")
		}
		return fmt.Errorf("failed to verify listing: %w", err)
	}

	// Check ownership unless admin
	if userRole != string(httplib.ADMIN) && ownerID != userID {
		return fmt.Errorf("listing does not belong to user")
	}

	// Verify the media belongs to this listing
	var mediaListingID int64
	err = s.P.QueryRow(ctx, `SELECT listing_id FROM listing_media WHERE id=$1`, mediaID).Scan(&mediaListingID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("media not found")
		}
		return fmt.Errorf("failed to verify media: %w", err)
	}

	if mediaListingID != listingID {
		return fmt.Errorf("media does not belong to this listing")
	}

	// Update the media URL
	_, err = s.P.Exec(ctx, `UPDATE listing_media SET media_url=$1 WHERE id=$2 AND listing_id=$3`, newURL, mediaID, listingID)
	if err != nil {
		return fmt.Errorf("failed to update media URL: %w", err)
	}

	return nil
}

// DeleteMediaUrl deletes a media URL by URL string
func (s *Store) DeleteMediaUrl(ctx context.Context, listingID int64, userID string, userRole string, mediaURL string) error {
	// First verify the listing exists and belongs to the user (or user is admin)
	var ownerID string
	err := s.P.QueryRow(ctx, `SELECT user_id::text FROM listings WHERE id=$1`, listingID).Scan(&ownerID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("listing not found")
		}
		return fmt.Errorf("failed to verify listing: %w", err)
	}

	// Check ownership unless admin
	if userRole != string(httplib.ADMIN) && ownerID != userID {
		return fmt.Errorf("listing does not belong to user")
	}

	// Delete the media URL
	result, err := s.P.Exec(ctx, `DELETE FROM listing_media WHERE listing_id=$1 AND media_url=$2`, listingID, mediaURL)
	if err != nil {
		return fmt.Errorf("failed to delete media URL: %w", err)
	}

	// Check if any rows were deleted
	if result.RowsAffected() == 0 {
		return fmt.Errorf("media URL not found")
	}

	return nil
}
