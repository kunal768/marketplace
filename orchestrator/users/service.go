package users

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	httplib "github.com/kunal768/cmpe202/http-lib"
	"github.com/kunal768/cmpe202/orchestrator/internal/queue"
	"github.com/kunal768/cmpe202/orchestrator/models"
	"golang.org/x/crypto/bcrypt"
)

type svc struct {
	repo      Repository
	publisher queue.Publisher
}

type Service interface {
	Signup(ctx context.Context, req SignupRequest) (*SignupResponse, error)
	Login(ctx context.Context, req LoginRequest) (*LoginResponse, error)
	RefreshToken(ctx context.Context, req RefreshTokenRequest) (*RefreshTokenResponse, error)
	GetUserByID(ctx context.Context, userID string) (*models.User, error)
	SearchUsers(ctx context.Context, query string, excludeUserID string, page int, limit int) ([]models.User, error)
	UpdateUser(ctx context.Context, req UpdateUserRequest) (*UpdateUserResponse, error)
	DeleteUser(ctx context.Context, userID string) error
}

func NewService(repo Repository, publisher queue.Publisher) Service {
	return &svc{
		repo:      repo,
		publisher: publisher,
	}
}

// Signup creates a new user account
func (s *svc) Signup(ctx context.Context, req SignupRequest) (*SignupResponse, error) {
	// Check if user already exists
	existingUser, err := s.repo.GetUserByEmail(ctx, req.Email)
	if err == nil && existingUser != nil {
		return nil, fmt.Errorf("user with email %s already exists", req.Email)
	}

	// Generate user ID
	userID, err := generateUserID()
	if err != nil {
		return nil, fmt.Errorf("failed to generate user ID: %w", err)
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	now := time.Now()

	// Create user
	user := &models.User{
		UserId:   userID,
		UserName: req.UserName,
		Email:    req.Email,
		Role:     models.USER, // Default role
		Contact: models.Contact{
			Email: req.Email,
		},
		CreatedAt: now,
		UpdatedAt: now,
	}

	// Create user authentication
	userAuth := &models.UserAuth{
		UserId:    userID,
		Password:  string(hashedPassword),
		CreatedAt: now,
		UpdatedAt: now,
	}

	// Save user to database
	if err := s.repo.CreateUser(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Save user authentication to database
	if err := s.repo.CreateUserAuth(ctx, userAuth); err != nil {
		return nil, fmt.Errorf("failed to create user authentication: %w", err)
	}

	// Generate access token
	accessToken, err := httplib.GenerateJWT(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Generate refresh token
	refreshToken, err := httplib.GenerateRefreshToken(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Create user login authentication
	userLoginAuth := &models.UserLoginAuth{
		UserId:       userID,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    now.Add(24 * time.Hour), // Token expires in 24 hours
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	// Create login auth record
	if err := s.repo.CreateUserLoginAuth(ctx, userLoginAuth); err != nil {
		return nil, fmt.Errorf("failed to create user login authentication: %w", err)
	}

	return &SignupResponse{
		Message:      "User created successfully",
		Token:        accessToken,
		RefreshToken: refreshToken,
		User:         *user,
	}, nil
}

// Login authenticates a user and returns a JWT token
func (s *svc) Login(ctx context.Context, req LoginRequest) (*LoginResponse, error) {
	// Get user by email
	user, err := s.repo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("invalid email or password")
	}

	// Get user authentication
	userAuth, err := s.repo.GetUserAuthByUserID(ctx, user.UserId)
	if err != nil {
		return nil, fmt.Errorf("invalid email or password")
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(userAuth.Password), []byte(req.Password)); err != nil {
		return nil, fmt.Errorf("invalid email or password")
	}

	// Generate access token
	accessToken, err := httplib.GenerateJWT(user.UserId)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Generate new refresh token
	refreshToken, err := httplib.GenerateRefreshToken(user.UserId)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Create or update user login authentication
	now := time.Now()
	userLoginAuth := &models.UserLoginAuth{
		UserId:       user.UserId,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    now.Add(24 * time.Hour), // Token expires in 24 hours
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	// Check if login auth already exists for this user
	existingLoginAuth, err := s.repo.GetUserLoginAuthByUserID(ctx, user.UserId)
	if err != nil {
		// Create new login auth
		if err := s.repo.CreateUserLoginAuth(ctx, userLoginAuth); err != nil {
			return nil, fmt.Errorf("failed to create user login authentication: %w", err)
		}
	} else {
		// Update existing login auth
		userLoginAuth.CreatedAt = existingLoginAuth.CreatedAt
		if err := s.repo.UpdateUserLoginAuth(ctx, userLoginAuth); err != nil {
			return nil, fmt.Errorf("failed to update user login authentication: %w", err)
		}
	}

	return &LoginResponse{
		Message:      "Login successful",
		Token:        accessToken,
		RefreshToken: refreshToken,
		User:         *user,
	}, nil
}

// RefreshToken handles token refresh
func (s *svc) RefreshToken(ctx context.Context, req RefreshTokenRequest) (*RefreshTokenResponse, error) {
	// Validate refresh token
	_, err := httplib.ValidateRefreshToken(req.RefreshToken)
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token: %w", err)
	}

	// Get user login auth by refresh token from database
	userLoginAuth, err := s.repo.GetUserLoginAuthByRefreshToken(ctx, req.RefreshToken)
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token: %w", err)
	}

	// Check if token is expired
	if time.Now().After(userLoginAuth.ExpiresAt) {
		return nil, fmt.Errorf("refresh token expired")
	}

	// Get user details
	user, err := s.repo.GetUserByID(ctx, userLoginAuth.UserId)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Generate new access token
	accessToken, err := httplib.GenerateJWT(user.UserId)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Generate new refresh token
	newRefreshToken, err := httplib.GenerateRefreshToken(user.UserId)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Update user login authentication
	now := time.Now()
	userLoginAuth.AccessToken = accessToken
	userLoginAuth.RefreshToken = newRefreshToken
	userLoginAuth.ExpiresAt = now.Add(24 * time.Hour) // Token expires in 24 hours
	userLoginAuth.UpdatedAt = now

	if err := s.repo.UpdateUserLoginAuth(ctx, userLoginAuth); err != nil {
		return nil, fmt.Errorf("failed to update user login authentication: %w", err)
	}

	return &RefreshTokenResponse{
		Message:      "Token refreshed successfully",
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		User:         *user,
	}, nil
}

// GetUserByID retrieves a user by ID
func (s *svc) GetUserByID(ctx context.Context, userID string) (*models.User, error) {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	return user, nil
}

// SearchUsers searches users by ID, username, or email with pagination
func (s *svc) SearchUsers(ctx context.Context, query string, excludeUserID string, page int, limit int) ([]models.User, error) {
	trimmedQuery := strings.TrimSpace(query)
	if len(trimmedQuery) < 1 {
		return nil, fmt.Errorf("query must be at least 1 character")
	}

	// Calculate offset
	offset := (page - 1) * limit

	// Call repository
	results, err := s.repo.SearchUsers(ctx, trimmedQuery, excludeUserID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to search users: %w", err)
	}

	return results, nil
}

func (s *svc) UpdateUser(ctx context.Context, req UpdateUserRequest) (*UpdateUserResponse, error) {
	// Get user by ID
	user, err := s.repo.GetUserByID(ctx, req.UserId)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Update user
	user.UserName = req.UserName
	user.Email = req.Email
	//user.Role = req.Role
	user.Contact = req.Contact

	// Update user
	updatedUser, err := s.repo.UpdateUser(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	return &UpdateUserResponse{
		Message: "User updated successfully",
		User:    *updatedUser,
	}, nil
}

// DeleteUser deletes a user and all associated auth records
func (s *svc) DeleteUser(ctx context.Context, userID string) error {
	// Verify user exists
	_, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Delete user login auth
	if err := s.repo.DeleteUserLoginAuth(ctx, userID); err != nil {
		// Log but don't fail if login auth doesn't exist
		fmt.Printf("Warning: failed to delete user login auth for user %s: %v\n", userID, err)
	}

	// Delete user auth
	if err := s.repo.DeleteUserAuth(ctx, userID); err != nil {
		// Log but don't fail if auth doesn't exist
		fmt.Printf("Warning: failed to delete user auth for user %s: %v\n", userID, err)
	}

	// Delete user
	if err := s.repo.DeleteUser(ctx, userID); err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	return nil
}

// generateUserID generates a unique user ID
func generateUserID() (string, error) {
	id, err := uuid.NewRandom()
	if err != nil {
		return "", err
	}
	return id.String(), nil
}
