package users

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strconv"
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
	userRole, _ := r.Context().Value(httplib.ContextKey("userRole")).(string)

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

// EventsVerifyHandler handles WebSocket events verification
func (e *Endpoints) EventsVerifyHandler(w http.ResponseWriter, r *http.Request) {
	var req EventsVerifyRequest

	// Decode request body
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request body",
			Message: "Failed to decode request body",
		})
		return
	}

	// Validate request
	if req.UserID == "" {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Validation error",
			Message: "User ID is required",
		})
		return
	}

	// Get user ID from JWT token context (set by AuthMiddleware)
	tokenUserID, ok := r.Context().Value(httplib.ContextKey("userId")).(string)
	if !ok {
		httplib.WriteJSON(w, http.StatusUnauthorized, ErrorResponse{
			Error:   "Unauthorized",
			Message: "User ID not found in token",
		})
		return
	}

	// Verify that the token's user ID matches the requested user ID
	if tokenUserID != req.UserID {
		httplib.WriteJSON(w, http.StatusForbidden, ErrorResponse{
			Error:   "Forbidden",
			Message: "Token user ID does not match requested user ID",
		})
		return
	}

	// Verify user exists in database
	_, err := e.service.GetUserByID(r.Context(), req.UserID)
	if err != nil {
		httplib.WriteJSON(w, http.StatusNotFound, ErrorResponse{
			Error:   "User not found",
			Message: "User does not exist",
		})
		return
	}

	// Return success response
	response := EventsVerifyResponse{
		Message: "User verified successfully",
		Valid:   true,
	}

	// EventsVerifyHandler now only verifies authentication
	httplib.WriteJSON(w, http.StatusOK, response)
}

// SearchUsersHandler handles searching users by username prefix (requires authentication)
func (e *Endpoints) SearchUsersHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context (set by AuthMiddleware)
	userID, ok := r.Context().Value(httplib.ContextKey("userId")).(string)
	if !ok {
		httplib.WriteJSON(w, http.StatusUnauthorized, ErrorResponse{
			Error:   "Unauthorized",
			Message: "User ID not found in context",
		})
		return
	}

	// Extract query parameter (required)
	query := r.URL.Query().Get("q")
	if query == "" {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "Query parameter 'q' is required",
		})
		return
	}

	// Validate query length
	if len(query) < 1 {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "Query must be at least 1 character",
		})
		return
	}

	// Extract page parameter (default: 1)
	page := 1
	if pageStr := r.URL.Query().Get("page"); pageStr != "" {
		if parsedPage, err := strconv.Atoi(pageStr); err == nil && parsedPage > 0 {
			page = parsedPage
		}
	}

	// Extract limit parameter (default: 20, max: 100)
	limit := 20
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			if parsedLimit > 100 {
				limit = 100
			} else {
				limit = parsedLimit
			}
		}
	}

	// Call service
	results, err := e.service.SearchUsers(r.Context(), query, userID, page, limit)
	if err != nil {
		httplib.WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error:   "Search failed",
			Message: err.Error(),
		})
		return
	}

	// Determine if there are more results
	hasMore := len(results) == limit

	// Build response
	response := SearchUsersResponse{
		Users:   results,
		Page:    page,
		Limit:   limit,
		HasMore: hasMore,
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
	mux.Handle("GET /api/users/search", protected(http.HandlerFunc(e.SearchUsersHandler)))

	// Events verification endpoint (requires auth but not role injection)
	mux.Handle("POST /api/events/verify", httplib.AuthMiddleWare(httplib.JSONRequestDecoder(http.HandlerFunc(e.EventsVerifyHandler))))
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
	log.Println("Login email check: ", email)
	log.Println("Matched regex for email: ", matched)
	log.Println("Suffix check: ", strings.HasSuffix(email, "@sjsu.edu"))
	return matched && strings.HasSuffix(email, "@sjsu.edu")
}
