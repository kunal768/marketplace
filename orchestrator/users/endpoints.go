package users

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	httplib "github.com/kunal768/cmpe202/http-lib"
)

type Endpoints struct {
	service Service
}

func NewEndpoints(service Service) *Endpoints {
	return &Endpoints{
		service: service,
	}
}

// SignupHandler handles user registration
func (e *Endpoints) SignupHandler(w http.ResponseWriter, r *http.Request) {
	var req SignupRequest

	// Decode request body
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request body",
			Message: "Failed to decode request body",
		})
		return
	}

	// Validate request
	if err := validateSignupRequest(req); err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Validation error",
			Message: err.Error(),
		})
		return
	}

	// Call service
	response, err := e.service.Signup(r.Context(), req)
	if err != nil {
		httplib.WriteJSON(w, http.StatusConflict, ErrorResponse{
			Error:   "Signup failed",
			Message: err.Error(),
		})
		return
	}

	httplib.WriteJSON(w, http.StatusCreated, response)
}

// LoginHandler handles user authentication
func (e *Endpoints) LoginHandler(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest

	// Decode request body
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request body",
			Message: "Failed to decode request body",
		})
		return
	}

	// Validate request
	if err := validateLoginRequest(req); err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Validation error",
			Message: err.Error(),
		})
		return
	}

	// Call service
	response, err := e.service.Login(r.Context(), req)
	if err != nil {
		httplib.WriteJSON(w, http.StatusUnauthorized, ErrorResponse{
			Error:   "Login failed",
			Message: err.Error(),
		})
		return
	}

	httplib.WriteJSON(w, http.StatusOK, response)
}

// GetUserHandler handles getting user profile (requires authentication)
func (e *Endpoints) GetUserHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context (set by AuthMiddleware)
	userID, ok := r.Context().Value(httplib.ContextKey("userId")).(string)
	if !ok {
		httplib.WriteJSON(w, http.StatusUnauthorized, ErrorResponse{
			Error:   "Unauthorized",
			Message: "User ID not found in context",
		})
		return
	}

	// User role may or may not be present; do not error if missing
	userRole, _ := r.Context().Value(httplib.ContextKey("userRole")).(int)

	// Call service
	user, err := e.service.GetUserByID(r.Context(), userID)
	if err != nil {
		httplib.WriteJSON(w, http.StatusNotFound, ErrorResponse{
			Error:   "User not found",
			Message: err.Error(),
		})
		return
	}

	// Add role information to response
	response := map[string]interface{}{
		"user": user,
		"role": userRole,
	}

	httplib.WriteJSON(w, http.StatusOK, response)
}

// RefreshTokenHandler handles token refresh
func (e *Endpoints) RefreshTokenHandler(w http.ResponseWriter, r *http.Request) {
	var req RefreshTokenRequest

	// Decode request body
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request body",
			Message: "Failed to decode request body",
		})
		return
	}

	// Validate request
	if req.RefreshToken == "" {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Validation error",
			Message: "Refresh token is required",
		})
		return
	}

	// Call service
	response, err := e.service.RefreshToken(r.Context(), req)
	if err != nil {
		httplib.WriteJSON(w, http.StatusUnauthorized, ErrorResponse{
			Error:   "Token refresh failed",
			Message: err.Error(),
		})
		return
	}

	httplib.WriteJSON(w, http.StatusOK, response)
}

// RegisterRoutes registers all user routes with proper middleware
func (e *Endpoints) RegisterRoutes(mux *http.ServeMux, dbPool *pgxpool.Pool) {
	// Default protected chain: JSON -> Auth -> Role
	protected := func(h http.Handler) http.Handler {
		return httplib.AuthMiddleWare(
			httplib.RoleInjectionMiddleWare(dbPool)(
				httplib.JSONRequestDecoder(h),
			),
		)
	}

	// Public routes: signup, login, refresh
	mux.Handle("POST /api/users/signup", httplib.JSONRequestDecoder(http.HandlerFunc(e.SignupHandler)))
	mux.Handle("POST /api/users/login", httplib.JSONRequestDecoder(http.HandlerFunc(e.LoginHandler)))
	mux.Handle("POST /api/users/refresh", httplib.JSONRequestDecoder(http.HandlerFunc(e.RefreshTokenHandler)))

	// All other routes require auth + role injection by default
	mux.Handle("GET /api/users/profile", protected(http.HandlerFunc(e.GetUserHandler)))
}

// validateSignupRequest validates signup request
func validateSignupRequest(req SignupRequest) error {
	if req.UserName == "" {
		return fmt.Errorf("username is required")
	}
	if len(req.UserName) < 3 || len(req.UserName) > 50 {
		return fmt.Errorf("username must be between 3 and 50 characters")
	}
	if req.Email == "" {
		return fmt.Errorf("email is required")
	}
	if !isValidEmail(req.Email) {
		return fmt.Errorf("invalid email format")
	}
	if req.Password == "" {
		return fmt.Errorf("password is required")
	}
	if len(req.Password) < 6 {
		return fmt.Errorf("password must be at least 6 characters")
	}
	if req.Phone == "" {
		return fmt.Errorf("phone is required")
	}
	return nil
}

// validateLoginRequest validates login request
func validateLoginRequest(req LoginRequest) error {
	if req.Email == "" {
		return fmt.Errorf("email is required")
	}
	if !isValidEmail(req.Email) {
		return fmt.Errorf("invalid email format")
	}
	if req.Password == "" {
		return fmt.Errorf("password is required")
	}
	return nil
}

func isValidEmail(email string) bool {
	const emailRegex = `^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`
	matched := regexp.MustCompile(emailRegex).MatchString(email)
	return matched && strings.HasSuffix(email, "@sjsu.edu")
}
