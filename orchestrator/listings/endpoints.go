package listings

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/google/uuid"
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

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// GetAllListingsHandler handles getting all listings with optional filters
func (e *Endpoints) GetAllListingsHandler(w http.ResponseWriter, r *http.Request) {
	req := FetchAllListingsRequest{}

	// Parse query parameters
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if limit, err := strconv.Atoi(limitStr); err == nil {
			req.Limit = &limit
		}
	}

	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		if offset, err := strconv.Atoi(offsetStr); err == nil {
			req.Offset = &offset
		}
	}

	if sort := r.URL.Query().Get("sort"); sort != "" {
		req.Sort = &sort
	}

	if keywords := r.URL.Query().Get("keywords"); keywords != "" {
		req.Keywords = &keywords
	}

	if category := r.URL.Query().Get("category"); category != "" {
		cat := Category(category)
		req.Category = &cat
	}

	if status := r.URL.Query().Get("status"); status != "" {
		st := Status(status)
		req.Status = &st
	}

	if minPriceStr := r.URL.Query().Get("min_price"); minPriceStr != "" {
		if minPrice, err := strconv.ParseInt(minPriceStr, 10, 64); err == nil {
			req.MinPrice = &minPrice
		}
	}

	if maxPriceStr := r.URL.Query().Get("max_price"); maxPriceStr != "" {
		if maxPrice, err := strconv.ParseInt(maxPriceStr, 10, 64); err == nil {
			req.MaxPrice = &maxPrice
		}
	}

	// Call service
	response, err := e.service.FetchAllListings(r.Context(), req)
	if err != nil {
		httplib.WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to fetch listings",
			Message: err.Error(),
		})
		return
	}

	httplib.WriteJSON(w, http.StatusOK, response)
}

// GetListingByIDHandler handles getting a single listing by ID
func (e *Endpoints) GetListingByIDHandler(w http.ResponseWriter, r *http.Request) {
	// Extract ID from URL path using PathValue (Go 1.22+)
	listingIDStr := r.PathValue("id")
	if listingIDStr == "" {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "Listing ID is required",
		})
		return
	}

	listingID, err := strconv.ParseInt(listingIDStr, 10, 64)
	if err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "Invalid listing ID format",
		})
		return
	}

	req := FetchListingRequest{ID: listingID}

	// Call service
	response, err := e.service.FetchListing(r.Context(), req)
	if err != nil {
		httplib.WriteJSON(w, http.StatusNotFound, ErrorResponse{
			Error:   "Listing not found",
			Message: err.Error(),
		})
		return
	}

	httplib.WriteJSON(w, http.StatusOK, response)
}

// CreateListingHandler handles creating a new listing (requires authentication)
func (e *Endpoints) CreateListingHandler(w http.ResponseWriter, r *http.Request) {
	var req CreateListingRequest

	// Decode request body
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request body",
			Message: "Failed to decode request body",
		})
		return
	}

	// Validate request
	if err := validateCreateListingRequest(req); err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Validation error",
			Message: err.Error(),
		})
		return
	}

	// Call service (context should have userID and role from middleware)
	response, err := e.service.CreateListing(r.Context(), req)
	if err != nil {
		httplib.WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to create listing",
			Message: err.Error(),
		})
		return
	}

	httplib.WriteJSON(w, http.StatusCreated, response)
}

// UpdateListingHandler handles updating a listing (requires authentication)
func (e *Endpoints) UpdateListingHandler(w http.ResponseWriter, r *http.Request) {
	// Extract ID from URL path using PathValue (Go 1.22+)
	listingIDStr := r.PathValue("id")
	if listingIDStr == "" {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "Listing ID is required",
		})
		return
	}

	listingID, err := strconv.ParseInt(listingIDStr, 10, 64)
	if err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "Invalid listing ID format",
		})
		return
	}

	var updateReq struct {
		Title       *string   `json:"title,omitempty"`
		Description *string   `json:"description,omitempty"`
		Price       *int64    `json:"price,omitempty"`
		Category    *Category `json:"category,omitempty"`
		Status      *Status   `json:"status,omitempty"`
	}

	// Decode request body
	if err := json.NewDecoder(r.Body).Decode(&updateReq); err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request body",
			Message: "Failed to decode request body",
		})
		return
	}

	req := UpdateListingRequest{
		ID:          listingID,
		Title:       updateReq.Title,
		Description: updateReq.Description,
		Price:       updateReq.Price,
		Category:    updateReq.Category,
		Status:      updateReq.Status,
	}

	// Call service
	response, err := e.service.UpdateListing(r.Context(), req)
	if err != nil {
		httplib.WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to update listing",
			Message: err.Error(),
		})
		return
	}

	httplib.WriteJSON(w, http.StatusOK, response)
}

// DeleteListingHandler handles deleting a listing (requires authentication)
func (e *Endpoints) DeleteListingHandler(w http.ResponseWriter, r *http.Request) {
	// Extract ID from URL path using PathValue (Go 1.22+)
	listingIDStr := r.PathValue("id")
	if listingIDStr == "" {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "Listing ID is required",
		})
		return
	}

	listingID, err := strconv.ParseInt(listingIDStr, 10, 64)
	if err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "Invalid listing ID format",
		})
		return
	}

	// Parse hard delete query parameter
	var hard *bool
	if hardStr := r.URL.Query().Get("hard"); hardStr != "" {
		if hardStr == "true" {
			hardVal := true
			hard = &hardVal
		} else {
			hardVal := false
			hard = &hardVal
		}
	}

	req := DeleteListingRequest{
		ID:   listingID,
		Hard: hard,
	}

	// Call service
	response, err := e.service.DeleteListing(r.Context(), req)
	if err != nil {
		httplib.WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to delete listing",
			Message: err.Error(),
		})
		return
	}

	httplib.WriteJSON(w, http.StatusOK, response)
}

// GetUserListingsHandler handles getting listings for the authenticated user
func (e *Endpoints) GetUserListingsHandler(w http.ResponseWriter, r *http.Request) {
	// Call service (context should have userID and role from middleware)
	response, err := e.service.FetchUserListings(r.Context())
	if err != nil {
		httplib.WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to fetch user listings",
			Message: err.Error(),
		})
		return
	}

	httplib.WriteJSON(w, http.StatusOK, response.Listings)
}

// GetListingsByUserIDHandler handles getting listings by user ID (admin only)
func (e *Endpoints) GetListingsByUserIDHandler(w http.ResponseWriter, r *http.Request) {
	// Extract user_id from query parameter
	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr == "" {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "user_id query parameter is required",
		})
		return
	}

	// Parse user_id as UUID
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "Invalid user_id format. Expected UUID",
		})
		return
	}

	req := FetchListingsByUserIDRequest{UserID: userID}

	// Call service (service will validate admin role)
	response, err := e.service.FetchListingsByUserID(r.Context(), req)
	if err != nil {
		// Check if error is due to admin access requirement
		if err.Error() == "admin access required" {
			httplib.WriteJSON(w, http.StatusForbidden, ErrorResponse{
				Error:   "Forbidden",
				Message: "Admin access required",
			})
			return
		}
		httplib.WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to fetch listings by user ID",
			Message: err.Error(),
		})
		return
	}

	httplib.WriteJSON(w, http.StatusOK, response.Listings)
}

// UploadMediaHandler handles uploading media files (requires authentication)
func (e *Endpoints) UploadMediaHandler(w http.ResponseWriter, r *http.Request) {
	// Get optional listing ID from query parameter
	var listingID *int64
	if listingIDStr := r.URL.Query().Get("listing_id"); listingIDStr != "" {
		if id, err := strconv.ParseInt(listingIDStr, 10, 64); err == nil {
			listingID = &id
		}
	}

	// Call service - forward the request body directly
	response, err := e.service.UploadMedia(r.Context(), r, listingID)
	if err != nil {
		httplib.WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to upload media",
			Message: err.Error(),
		})
		return
	}

	httplib.WriteJSON(w, http.StatusOK, response)
}

// AddMediaURLHandler handles adding media URLs to a listing (requires authentication)
func (e *Endpoints) AddMediaURLHandler(w http.ResponseWriter, r *http.Request) {
	// Extract ID from URL path using PathValue (Go 1.22+)
	listingIDStr := r.PathValue("id")
	if listingIDStr == "" {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "Listing ID is required",
		})
		return
	}

	listingID, err := strconv.ParseInt(listingIDStr, 10, 64)
	if err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "Invalid listing ID format",
		})
		return
	}

	var mediaReq struct {
		MediaUrls []string `json:"media_urls"`
	}

	// Decode request body
	if err := json.NewDecoder(r.Body).Decode(&mediaReq); err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request body",
			Message: "Failed to decode request body",
		})
		return
	}

	if len(mediaReq.MediaUrls) == 0 {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Validation error",
			Message: "At least one media URL is required",
		})
		return
	}

	req := AddMediaURLRequest{
		ID:        listingID,
		MediaUrls: mediaReq.MediaUrls,
	}

	// Call service
	response, err := e.service.AddMediaURL(r.Context(), req)
	if err != nil {
		httplib.WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to add media URL",
			Message: err.Error(),
		})
		return
	}

	httplib.WriteJSON(w, http.StatusOK, response)
}

// ChatSearchHandler handles AI-powered search
func (e *Endpoints) ChatSearchHandler(w http.ResponseWriter, r *http.Request) {
	var req ChatSearchRequest

	// Decode request body
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request body",
			Message: "Failed to decode request body",
		})
		return
	}

	// Validate request
	if req.Query == "" {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Validation error",
			Message: "Query is required",
		})
		return
	}

	// Call service
	response, err := e.service.ChatSearch(r.Context(), req)
	if err != nil {
		httplib.WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to perform chat search",
			Message: err.Error(),
		})
		return
	}

	httplib.WriteJSON(w, http.StatusOK, response)
}

// GetFlaggedListingsHandler handles getting flagged listings (admin only)
func (e *Endpoints) GetFlaggedListingsHandler(w http.ResponseWriter, r *http.Request) {
	req := FetchFlaggedListingsRequest{}

	// Parse optional status filter from query parameter
	if status := r.URL.Query().Get("status"); status != "" {
		st := FlagStatus(status)
		req.Status = &st
	}

	// Call service (service will validate admin role)
	response, err := e.service.FetchFlaggedListings(r.Context(), req)
	if err != nil {
		// Check if error is due to admin access requirement
		if err.Error() == "admin access required" {
			httplib.WriteJSON(w, http.StatusForbidden, ErrorResponse{
				Error:   "Forbidden",
				Message: "Admin access required",
			})
			return
		}
		httplib.WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to fetch flagged listings",
			Message: err.Error(),
		})
		return
	}

	httplib.WriteJSON(w, http.StatusOK, response)
}

// FlagListingHandler handles flagging a listing
func (e *Endpoints) FlagListingHandler(w http.ResponseWriter, r *http.Request) {
	// Extract ID from URL path using PathValue (Go 1.22+)
	listingIDStr := r.PathValue("id")
	if listingIDStr == "" {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "Listing ID is required",
		})
		return
	}

	listingID, err := strconv.ParseInt(listingIDStr, 10, 64)
	if err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "Invalid listing ID format",
		})
		return
	}

	var flagReq struct {
		Reason  FlagReason `json:"reason"`
		Details *string    `json:"details,omitempty"`
	}

	// Decode request body
	if err := json.NewDecoder(r.Body).Decode(&flagReq); err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request body",
			Message: "Failed to decode request body",
		})
		return
	}

	// Validate request
	if flagReq.Reason == "" {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Validation error",
			Message: "Reason is required",
		})
		return
	}

	req := FlagListingRequest{
		ListingID: listingID,
		Reason:    flagReq.Reason,
		Details:   flagReq.Details,
	}

	// Call service (context should have userID and role from middleware)
	response, err := e.service.FlagListing(r.Context(), req)
	if err != nil {
		httplib.WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to flag listing",
			Message: err.Error(),
		})
		return
	}

	httplib.WriteJSON(w, http.StatusCreated, response)
}

func (e *Endpoints) UpdateFlagListingHandler(w http.ResponseWriter, r *http.Request) {
	// Extract ID from URL path using PathValue (Go 1.22+)
	flagIDStr := r.PathValue("flag_id")
	if flagIDStr == "" {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "Flag ID is required",
		})
		return
	}

	flagID, err := strconv.ParseInt(flagIDStr, 10, 64)
	if err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "Invalid flag ID format",
		})
		return
	}

	var updateReq struct {
		Status          FlagStatus `json:"status"`
		ResolutionNotes *string    `json:"resolution_notes,omitempty"`
	}

	// Decode request body
	if err := json.NewDecoder(r.Body).Decode(&updateReq); err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request body",
			Message: "Failed to decode request body",
		})
		return
	}

	req := UpdateFlagListingRequest{
		FlagID:          flagID,
		Status:          updateReq.Status,
		ResolutionNotes: updateReq.ResolutionNotes,
	}

	// Call service
	response, err := e.service.UpdateFlagListing(r.Context(), req)
	if err != nil {
		httplib.WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to update flag listing",
			Message: err.Error(),
		})
		return
	}

	httplib.WriteJSON(w, http.StatusOK, response.FlaggedListing)
}

// DeleteFlagListingHandler handles deleting a flagged listing (admin only)
func (e *Endpoints) DeleteFlagListingHandler(w http.ResponseWriter, r *http.Request) {
	// Extract ID from URL path using PathValue (Go 1.22+)
	flagIDStr := r.PathValue("flag_id")
	if flagIDStr == "" {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "Flag ID is required",
		})
		return
	}

	flagID, err := strconv.ParseInt(flagIDStr, 10, 64)
	if err != nil {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "Invalid flag ID format",
		})
		return
	}

	req := DeleteFlagListingRequest{FlagID: flagID}

	// Call service
	response, err := e.service.DeleteFlagListing(r.Context(), req)
	if err != nil {
		// Check if error is due to admin access requirement
		if err.Error() == "admin access required" {
			httplib.WriteJSON(w, http.StatusForbidden, ErrorResponse{
				Error:   "Forbidden",
				Message: "Admin access required",
			})
			return
		}
		// Check if flag not found
		if err.Error() == "flag not found" {
			httplib.WriteJSON(w, http.StatusNotFound, ErrorResponse{
				Error:   "Not found",
				Message: "Flag not found",
			})
			return
		}
		httplib.WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to delete flagged listing",
			Message: err.Error(),
		})
		return
	}

	httplib.WriteJSON(w, http.StatusOK, response)
}

// adminOnlyMiddleware checks if the user has admin role
func adminOnlyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		roleVal := ctx.Value(httplib.ContextKey("userRole"))
		if roleVal == nil {
			httplib.WriteJSON(w, http.StatusForbidden, ErrorResponse{
				Error:   "Forbidden",
				Message: "Admin access required",
			})
			return
		}

		role, ok := roleVal.(string)
		if !ok || role != string(httplib.ADMIN) {
			httplib.WriteJSON(w, http.StatusForbidden, ErrorResponse{
				Error:   "Forbidden",
				Message: "Admin access required",
			})
			return
		}

		next.ServeHTTP(w, r)
	})
}

// RegisterRoutes registers all listing routes with proper middleware
func (e *Endpoints) RegisterRoutes(mux *http.ServeMux, dbPool *pgxpool.Pool) {
	// Default protected chain: JSON -> Auth -> Role
	protected := func(h http.Handler) http.Handler {
		return httplib.AuthMiddleWare(
			httplib.RoleInjectionMiddleWare(dbPool)(
				httplib.JSONRequestDecoder(h),
			),
		)
	}

	// Admin-only protected chain: JSON -> Auth -> Role -> Admin Check
	adminProtected := func(h http.Handler) http.Handler {
		return httplib.AuthMiddleWare(
			httplib.RoleInjectionMiddleWare(dbPool)(
				adminOnlyMiddleware(
					httplib.JSONRequestDecoder(h),
				),
			),
		)
	}

	// Protected routes (require auth + role injection)
	mux.Handle("GET /api/listings/", protected(http.HandlerFunc(e.GetAllListingsHandler)))
	mux.Handle("GET /api/listings/{id}", protected(http.HandlerFunc(e.GetListingByIDHandler)))
	mux.Handle("POST /api/listings/chatsearch", protected(http.HandlerFunc(e.ChatSearchHandler)))
	mux.Handle("POST /api/listings/create", protected(http.HandlerFunc(e.CreateListingHandler)))
	mux.Handle("PATCH /api/listings/update/{id}", protected(http.HandlerFunc(e.UpdateListingHandler)))
	mux.Handle("DELETE /api/listings/delete/{id}", httplib.AuthMiddleWare(
		httplib.RoleInjectionMiddleWare(dbPool)(http.HandlerFunc(e.DeleteListingHandler)),
	))
	mux.Handle("GET /api/listings/user-lists/", protected(http.HandlerFunc(e.GetUserListingsHandler)))
	mux.Handle("POST /api/listings/upload", httplib.AuthMiddleWare(
		httplib.RoleInjectionMiddleWare(dbPool)(http.HandlerFunc(e.UploadMediaHandler)),
	))
	mux.Handle("POST /api/listings/add-media-url/{id}", protected(http.HandlerFunc(e.AddMediaURLHandler)))
	mux.Handle("POST /api/listings/flag/{id}", protected(http.HandlerFunc(e.FlagListingHandler)))

	// Admin-only routes
	mux.Handle("GET /api/listings/flagged", adminProtected(http.HandlerFunc(e.GetFlaggedListingsHandler)))
	mux.Handle("PATCH /api/listings/flag/{flag_id}", adminProtected(http.HandlerFunc(e.UpdateFlagListingHandler)))
	mux.Handle("DELETE /api/listings/flag/{flag_id}", adminProtected(http.HandlerFunc(e.DeleteFlagListingHandler)))
	mux.Handle("GET /api/listings/by-user-id", adminProtected(http.HandlerFunc(e.GetListingsByUserIDHandler)))
}

// validateCreateListingRequest validates create listing request
func validateCreateListingRequest(req CreateListingRequest) error {
	if req.Title == "" {
		return fmt.Errorf("title is required")
	}
	if len(req.Title) > 200 {
		return fmt.Errorf("title must be less than 200 characters")
	}
	if req.Price < 0 {
		return fmt.Errorf("price must be non-negative")
	}
	if req.Category == "" {
		return fmt.Errorf("category is required")
	}
	// Validate category
	validCategories := []Category{CatTextbook, CatGadget, CatEssential, CatNonEssential, CatOther, CatTest}
	valid := false
	for _, cat := range validCategories {
		if req.Category == cat {
			valid = true
			break
		}
	}
	if !valid {
		return fmt.Errorf("invalid category")
	}
	return nil
}
