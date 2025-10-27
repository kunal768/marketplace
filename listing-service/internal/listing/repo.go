package listing

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/your-org/listing-service/internal/models"
)

// Better: pass *pgxpool.Pool and open per-call connections
type PgxPool interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

type Store struct{ P PgxPool }

func (s *Store) Create(ctx context.Context, userID int64, p models.CreateParams) (models.Listing, error) {
	const q = `
    INSERT INTO listings(title, description, price, category, user_id)
    VALUES ($1,$2,$3,$4,$5)
    RETURNING id, title, description, price, category, user_id, status, created_at`
	var l models.Listing
	err := s.P.QueryRow(ctx, q, p.Title, p.Description, p.Price, p.Category, userID).
		Scan(&l.ID, &l.Title, &l.Description, &l.Price, &l.Category, &l.UserID, &l.Status, &l.CreatedAt)
	return l, err
}

func (s *Store) Get(ctx context.Context, id int64) (models.Listing, error) {
	const q = `SELECT id,title,description,price,category,user_id,status,created_at FROM listings WHERE id=$1`
	var l models.Listing
	err := s.P.QueryRow(ctx, q, id).
		Scan(&l.ID, &l.Title, &l.Description, &l.Price, &l.Category, &l.UserID, &l.Status, &l.CreatedAt)
	return l, err
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

	log.Println("List SQL Query: \n", FormatQuery(sb.String(), args))

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

func (s *Store) Update(ctx context.Context, id int64, userid int64, p models.UpdateParams) (models.Listing, error) {
	// build dynamic SET
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

	q := fmt.Sprintf(
		`UPDATE listings SET %s WHERE id=$%d AND user_id=%d RETURNING id,title,description,price,category,user_id,status,created_at`,
		strings.Join(sets, ","),
		i,
		userid,
	)
	args = append(args, id)

	var l models.Listing
	err := s.P.QueryRow(ctx, q, args...).
		Scan(&l.ID, &l.Title, &l.Description, &l.Price, &l.Category, &l.UserID, &l.Status, &l.CreatedAt)
	return l, err
}

func (s *Store) Archive(ctx context.Context, id int64, userid int64) error {
	var args []any
	args = append(args, id)
	args = append(args, userid)
	_, err := s.P.Exec(ctx, `UPDATE listings SET status='ARCHIVED' WHERE id=$1 and user_id=$2`, args...)
	return err
}

func (s *Store) Delete(ctx context.Context, id int64, userid int64) error {
	var args []any
	args = append(args, id)
	args = append(args, userid)
	log.Println("Testing Delete Query: ", FormatQuery(`DELETE FROM listings WHERE id=$1 and user_id=$2`, args))
	_, err := s.P.Exec(ctx, `DELETE FROM listings WHERE id=$1 and user_id=$2`, args...)
	log.Println("Finished Delete Query: ", err)
	return err
}

func FormatQuery(query string, args []any) string {
	formatted := query
	for i, arg := range args {
		// convert argument to string safely
		val := fmt.Sprintf("'%v'", arg)
		// replace first occurrence of $1, $2, ...
		placeholder := fmt.Sprintf("$%d", i+1)
		formatted = strings.Replace(formatted, placeholder, val, 1)
	}
	return formatted
}
