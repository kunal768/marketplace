package users

import (
	"github.com/kunal768/cmpe202/orchestrator/models"
)

// Signup Request/Response
type SignupRequest struct {
	UserName string `json:"user_name" validate:"required,min=3,max=50"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6"`
	Phone    string `json:"phone" validate:"required"`
}

type SignupResponse struct {
	Message      string      `json:"message"`
	Token        string      `json:"token"`
	User         models.User `json:"user"`
	RefreshToken string      `json:"refresh_token"`
}

// Login Request/Response
type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type LoginResponse struct {
	Message      string      `json:"message"`
	Token        string      `json:"token"`
	User         models.User `json:"user"`
	RefreshToken string      `json:"refresh_token"`
}

// Refresh Token Request/Response
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

type RefreshTokenResponse struct {
	Message      string      `json:"message"`
	AccessToken  string      `json:"access_token"`
	RefreshToken string      `json:"refresh_token"`
	User         models.User `json:"user"`
}

// Events Verification Request/Response
type EventsVerifyRequest struct {
	UserID string `json:"userId" validate:"required"`
}

type EventsVerifyResponse struct {
	Message string `json:"message"`
	Valid   bool   `json:"valid"`
}

// Error Response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}
