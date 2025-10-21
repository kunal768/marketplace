package users

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	httplib "github.com/kunal768/cmpe202/http-lib"
	"github.com/kunal768/cmpe202/orchestrator/internal/queue"
	"github.com/kunal768/cmpe202/orchestrator/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

type svc struct {
	repo        Repository
	mongoClient *mongo.Client
	publisher   queue.Publisher
}

type Service interface {
	Signup(ctx context.Context, req SignupRequest) (*SignupResponse, error)
	Login(ctx context.Context, req LoginRequest) (*LoginResponse, error)
	RefreshToken(ctx context.Context, req RefreshTokenRequest) (*RefreshTokenResponse, error)
	GetUserByID(ctx context.Context, userID string) (*models.User, error)
	// FetchUndeliveredMessages returns undelivered messages for recipient (optional - requires mongo client)
	FetchUndeliveredMessages(ctx context.Context, recipientID string) ([]map[string]interface{}, error)
}

func NewService(repo Repository, publisher queue.Publisher, mongoClient ...*mongo.Client) Service {
	var mc *mongo.Client
	if len(mongoClient) > 0 {
		mc = mongoClient[0]
	}
	return &svc{
		repo:        repo,
		mongoClient: mc,
		publisher:   publisher,
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
			Phone: req.Phone,
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

	return &SignupResponse{
		Message: "User created successfully",
		User:    *user,
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
		Message: "Login successful",
		Token:   accessToken,
		User:    *user,
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

// FetchUndeliveredMessages returns undelivered messages for a recipient using mongo client if available
func (s *svc) FetchUndeliveredMessages(ctx context.Context, recipientID string) ([]map[string]interface{}, error) {
	if s.mongoClient == nil {
		return nil, fmt.Errorf("mongo client not configured")
	}
	coll := s.mongoClient.Database("chatdb").Collection("chatmessages")
	filter := bson.M{"recipientId": recipientID, "status": "UNDELIVERED"}
	cur, err := coll.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var results []map[string]interface{}
	for cur.Next(ctx) {
		var doc map[string]interface{}
		if err := cur.Decode(&doc); err != nil {
			continue
		}
		results = append(results, doc)
	}

	// Best-effort: republish undelivered messages to the queue if publisher is configured
	if s.publisher != nil && len(results) > 0 {
		for _, m := range results {
			b, err := json.Marshal(m)
			if err != nil {
				// skip malformed document
				continue
			}
			// publish with context but do not fail the whole operation if publish fails
			if err := s.publisher.Publish(ctx, b); err != nil {
				// Log publish failure using fmt for minimal dependencies
				fmt.Printf("failed to publish undelivered message for recipient %s: %v\n", recipientID, err)
			}
		}
	}

	return results, nil
}

// generateUserID generates a unique user ID
func generateUserID() (string, error) {
	id, err := uuid.NewRandom()
	if err != nil {
		return "", err
	}
	return id.String(), nil
}
