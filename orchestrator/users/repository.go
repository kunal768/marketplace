package users

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kunal768/cmpe202/orchestrator/models"
)

type repo struct {
	db *pgxpool.Pool
}

type Repository interface {
	// User operations
	CreateUser(ctx context.Context, user *models.User) error
	GetUserByEmail(ctx context.Context, email string) (*models.User, error)
	GetUserByID(ctx context.Context, userID string) (*models.User, error)
	UpdateUser(ctx context.Context, user *models.User) (*models.User, error)
	DeleteUser(ctx context.Context, userID string) error
	SearchUsers(ctx context.Context, query string, excludeUserID string, limit int, offset int) ([]UserSearchResult, error)

	// UserAuth operations
	CreateUserAuth(ctx context.Context, userAuth *models.UserAuth) error
	GetUserAuthByUserID(ctx context.Context, userID string) (*models.UserAuth, error)
	UpdateUserAuth(ctx context.Context, userAuth *models.UserAuth) error
	DeleteUserAuth(ctx context.Context, userID string) error

	// UserLoginAuth operations
	CreateUserLoginAuth(ctx context.Context, userLoginAuth *models.UserLoginAuth) error
	GetUserLoginAuthByUserID(ctx context.Context, userID string) (*models.UserLoginAuth, error)
	GetUserLoginAuthByRefreshToken(ctx context.Context, refreshToken string) (*models.UserLoginAuth, error)
	UpdateUserLoginAuth(ctx context.Context, userLoginAuth *models.UserLoginAuth) error
	DeleteUserLoginAuth(ctx context.Context, userID string) error
}

func NewRepository(db *pgxpool.Pool) Repository {
	return &repo{
		db: db,
	}
}

// CreateUser creates a new user in the database
func (r *repo) CreateUser(ctx context.Context, user *models.User) error {
	query := `
		INSERT INTO users (user_id, user_name, email, role, contact, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	contactJSON, err := json.Marshal(user.Contact)
	if err != nil {
		return fmt.Errorf("failed to marshal contact: %w", err)
	}

	_, err = r.db.Exec(ctx, query,
		user.UserId,
		user.UserName,
		user.Email,
		user.Role,
		contactJSON,
		user.CreatedAt,
		user.UpdatedAt,
	)

	return err
}

// GetUserByEmail retrieves a user by email
func (r *repo) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	query := `
		SELECT user_id, user_name, email, role, contact, created_at, updated_at
		FROM users 
		WHERE email = $1
	`

	var user models.User
	var contactJSON []byte

	err := r.db.QueryRow(ctx, query, email).Scan(
		&user.UserId,
		&user.UserName,
		&user.Email,
		&user.Role,
		&contactJSON,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	// Unmarshal contact JSON
	if err := json.Unmarshal(contactJSON, &user.Contact); err != nil {
		return nil, fmt.Errorf("failed to unmarshal contact: %w", err)
	}

	return &user, nil
}

// GetUserByID retrieves a user by ID
func (r *repo) GetUserByID(ctx context.Context, userID string) (*models.User, error) {
	query := `
		SELECT user_id, user_name, email, role, contact, created_at, updated_at
		FROM users 
		WHERE user_id = $1
	`

	var user models.User
	var contactJSON []byte

	err := r.db.QueryRow(ctx, query, userID).Scan(
		&user.UserId,
		&user.UserName,
		&user.Email,
		&user.Role,
		&contactJSON,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	// Unmarshal contact JSON
	if err := json.Unmarshal(contactJSON, &user.Contact); err != nil {
		return nil, fmt.Errorf("failed to unmarshal contact: %w", err)
	}

	return &user, nil
}

// UpdateUser updates an existing user
func (r *repo) UpdateUser(ctx context.Context, user *models.User) (*models.User, error) {
	query := `
		UPDATE users 
		SET user_name = $2, email = $3, contact = $4, updated_at = now()
		WHERE user_id = $1
		RETURNING user_id, user_name, email, contact, created_at, updated_at
	`

	contactJSON, err := json.Marshal(user.Contact)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal contact: %w", err)
	}
	var updatedUser models.User
	err = r.db.QueryRow(ctx, query,
		user.UserId,
		user.UserName,
		user.Email,
		contactJSON,
	).Scan(
		&updatedUser.UserId,
		&updatedUser.UserName,
		&updatedUser.Email,
		&updatedUser.Contact,
		&updatedUser.CreatedAt,
		&updatedUser.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	return &updatedUser, nil
}

// DeleteUser deletes a user by ID
func (r *repo) DeleteUser(ctx context.Context, userID string) error {
	query := `DELETE FROM users WHERE user_id = $1`
	_, err := r.db.Exec(ctx, query, userID)
	return err
}

// UserAuth methods

// CreateUserAuth creates a new user authentication record
func (r *repo) CreateUserAuth(ctx context.Context, userAuth *models.UserAuth) error {
	query := `
		INSERT INTO user_auth (user_id, password, created_at, updated_at)
		VALUES ($1, $2, $3, $4)
	`

	_, err := r.db.Exec(ctx, query,
		userAuth.UserId,
		userAuth.Password,
		userAuth.CreatedAt,
		userAuth.UpdatedAt,
	)

	return err
}

// GetUserAuthByUserID retrieves user authentication by user ID
func (r *repo) GetUserAuthByUserID(ctx context.Context, userID string) (*models.UserAuth, error) {
	query := `
		SELECT user_id, password, created_at, updated_at
		FROM user_auth 
		WHERE user_id = $1
	`

	var userAuth models.UserAuth

	err := r.db.QueryRow(ctx, query, userID).Scan(
		&userAuth.UserId,
		&userAuth.Password,
		&userAuth.CreatedAt,
		&userAuth.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &userAuth, nil
}

// UpdateUserAuth updates user authentication
func (r *repo) UpdateUserAuth(ctx context.Context, userAuth *models.UserAuth) error {
	query := `
		UPDATE user_auth 
		SET password = $2, updated_at = $3
		WHERE user_id = $1
	`

	_, err := r.db.Exec(ctx, query,
		userAuth.UserId,
		userAuth.Password,
		userAuth.UpdatedAt,
	)

	return err
}

// DeleteUserAuth deletes user authentication by user ID
func (r *repo) DeleteUserAuth(ctx context.Context, userID string) error {
	query := `DELETE FROM user_auth WHERE user_id = $1`
	_, err := r.db.Exec(ctx, query, userID)
	return err
}

// UserLoginAuth methods

// CreateUserLoginAuth creates a new user login authentication record
func (r *repo) CreateUserLoginAuth(ctx context.Context, userLoginAuth *models.UserLoginAuth) error {
	query := `
		INSERT INTO user_login_auth (user_id, access_token, refresh_token, expires_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	_, err := r.db.Exec(ctx, query,
		userLoginAuth.UserId,
		userLoginAuth.AccessToken,
		userLoginAuth.RefreshToken,
		userLoginAuth.ExpiresAt,
		userLoginAuth.CreatedAt,
		userLoginAuth.UpdatedAt,
	)

	return err
}

// GetUserLoginAuthByUserID retrieves user login authentication by user ID
func (r *repo) GetUserLoginAuthByUserID(ctx context.Context, userID string) (*models.UserLoginAuth, error) {
	query := `
		SELECT user_id, access_token, refresh_token, expires_at, created_at, updated_at
		FROM user_login_auth 
		WHERE user_id = $1
	`

	var userLoginAuth models.UserLoginAuth

	err := r.db.QueryRow(ctx, query, userID).Scan(
		&userLoginAuth.UserId,
		&userLoginAuth.AccessToken,
		&userLoginAuth.RefreshToken,
		&userLoginAuth.ExpiresAt,
		&userLoginAuth.CreatedAt,
		&userLoginAuth.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &userLoginAuth, nil
}

// GetUserLoginAuthByRefreshToken retrieves user login authentication by refresh token
func (r *repo) GetUserLoginAuthByRefreshToken(ctx context.Context, refreshToken string) (*models.UserLoginAuth, error) {
	query := `
		SELECT user_id, access_token, refresh_token, expires_at, created_at, updated_at
		FROM user_login_auth 
		WHERE refresh_token = $1
	`

	var userLoginAuth models.UserLoginAuth

	err := r.db.QueryRow(ctx, query, refreshToken).Scan(
		&userLoginAuth.UserId,
		&userLoginAuth.AccessToken,
		&userLoginAuth.RefreshToken,
		&userLoginAuth.ExpiresAt,
		&userLoginAuth.CreatedAt,
		&userLoginAuth.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &userLoginAuth, nil
}

// UpdateUserLoginAuth updates user login authentication
func (r *repo) UpdateUserLoginAuth(ctx context.Context, userLoginAuth *models.UserLoginAuth) error {
	query := `
		UPDATE user_login_auth 
		SET access_token = $2, refresh_token = $3, expires_at = $4, updated_at = $5
		WHERE user_id = $1
	`

	_, err := r.db.Exec(ctx, query,
		userLoginAuth.UserId,
		userLoginAuth.AccessToken,
		userLoginAuth.RefreshToken,
		userLoginAuth.ExpiresAt,
		userLoginAuth.UpdatedAt,
	)

	return err
}

// DeleteUserLoginAuth deletes user login authentication by user ID
func (r *repo) DeleteUserLoginAuth(ctx context.Context, userID string) error {
	query := `DELETE FROM user_login_auth WHERE user_id = $1`
	_, err := r.db.Exec(ctx, query, userID)
	return err
}

// SearchUsers searches users by username prefix (case-insensitive) with pagination
func (r *repo) SearchUsers(ctx context.Context, query string, excludeUserID string, limit int, offset int) ([]UserSearchResult, error) {
	sqlQuery := `
		SELECT user_id, user_name
		FROM users
		WHERE LOWER(user_name) LIKE LOWER($1 || '%')
		AND user_id != $2
		ORDER BY user_name
		LIMIT $3 OFFSET $4
	`

	rows, err := r.db.Query(ctx, sqlQuery, query, excludeUserID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to search users: %w", err)
	}
	defer rows.Close()

	var results []UserSearchResult
	for rows.Next() {
		var result UserSearchResult
		if err := rows.Scan(&result.UserId, &result.UserName); err != nil {
			return nil, fmt.Errorf("failed to scan user result: %w", err)
		}
		results = append(results, result)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating user results: %w", err)
	}

	return results, nil
}
