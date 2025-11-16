package listings

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"

	httplib "github.com/kunal768/cmpe202/http-lib"
	"github.com/kunal768/cmpe202/orchestrator/common"
)

type serviceConfig struct {
	Client *http.Client
	URL    string
}

type svc struct {
	config serviceConfig
}

type Service interface {
	CreateListing(ctx context.Context, req CreateListingRequest) (*CreateListingResponse, error)
	FetchAllListings(ctx context.Context, req FetchAllListingsRequest) (*FetchAllListingsResponse, error)
	FetchListing(ctx context.Context, req FetchListingRequest) (*FetchListingResponse, error)
	FetchUserListings(ctx context.Context) (*FetchUserListingsResponse, error)
	FetchListingsByUserID(ctx context.Context, req FetchListingsByUserIDRequest) (*FetchListingsByUserIDResponse, error)
	UpdateListing(ctx context.Context, req UpdateListingRequest) (*UpdateListingResponse, error)
	/* user can delete only their own listing, admin can delete all listings */
	DeleteListing(ctx context.Context, req DeleteListingRequest) (*DeleteListingResponse, error)
	UploadMedia(ctx context.Context, r *http.Request, listingID *int64) (*UploadMediaResponse, error)
	AddMediaURL(ctx context.Context, req AddMediaURLRequest) (*AddMediaURLResponse, error)
	ChatSearch(ctx context.Context, req ChatSearchRequest) (*ChatSearchResponse, error)
	FetchFlaggedListings(ctx context.Context, req FetchFlaggedListingsRequest) (*FetchFlaggedListingsResponse, error)
	FlagListing(ctx context.Context, req FlagListingRequest) (*FlagListingResponse, error)
	UpdateFlagListing(ctx context.Context, req UpdateFlagListingRequest) (*UpdateFlagListingResponse, error)
}

func NewListingService(baseUrl string, sharedSecret string) Service {
	// 1. Define the default headers
	defaultHeaders := http.Header{}
	defaultHeaders.Add("X-Request-ID", sharedSecret)

	// 2. Create the base http.Client
	httpClient := &http.Client{
		Timeout: 10 * time.Second, // Set a timeout for external calls
	}

	// 3. Wrap the client's Transport with your custom RoundTripper
	// Use http.DefaultTransport as the base if the client's Transport is nil
	baseTransport := httpClient.Transport
	if baseTransport == nil {
		baseTransport = http.DefaultTransport
	}

	// Set the custom RoundTripper as the new Transport
	httpClient.Transport = &common.DefaultHeaderTransport{
		Header:    defaultHeaders,
		Transport: baseTransport,
	}

	return &svc{
		config: serviceConfig{
			Client: httpClient,
			URL:    baseUrl, // Store the base URL
		},
	}
}

// extractUserAndRole extracts userID and roleID from context
func (s *svc) extractUserAndRole(ctx context.Context) (userID string, roleID string, err error) {
	userIDVal := ctx.Value(httplib.ContextKey("userId"))
	if userIDVal == nil {
		return "", "", fmt.Errorf("user ID not found in context")
	}
	userID, ok := userIDVal.(string)
	if !ok || userID == "" {
		return "", "", fmt.Errorf("invalid user ID in context")
	}

	roleIDVal := ctx.Value(httplib.ContextKey("userRole"))
	if roleIDVal != nil {
		if roleStr, ok := roleIDVal.(string); ok {
			roleID = roleStr
		}
	}
	if roleID == "" {
		return "", "", fmt.Errorf("user role not found in context")
	}

	return userID, roleID, nil
}

func (s *svc) CreateListing(ctx context.Context, req CreateListingRequest) (*CreateListingResponse, error) {
	userID, roleID, err := s.extractUserAndRole(ctx)
	if err != nil {
		return nil, err
	}

	reqBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	fullURL := s.config.URL + "/listings/create"
	httpReq, err := http.NewRequestWithContext(ctx, "POST", fullURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-User-ID", userID)
	httpReq.Header.Set("X-Role-ID", roleID)

	resp, err := s.config.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var listing Listing
	if err := json.NewDecoder(resp.Body).Decode(&listing); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &CreateListingResponse{Listing: &listing}, nil
}

func (s *svc) FetchAllListings(ctx context.Context, req FetchAllListingsRequest) (*FetchAllListingsResponse, error) {
	fullURL := s.config.URL + "/listings/"
	u, err := url.Parse(fullURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse URL: %w", err)
	}

	q := u.Query()
	if req.Limit != nil {
		q.Set("limit", strconv.Itoa(*req.Limit))
	}
	if req.Offset != nil {
		q.Set("offset", strconv.Itoa(*req.Offset))
	}
	if req.Sort != nil {
		q.Set("sort", *req.Sort)
	}
	if req.Keywords != nil {
		q.Set("keywords", *req.Keywords)
	}
	if req.Category != nil {
		q.Set("category", string(*req.Category))
	}
	if req.Status != nil {
		q.Set("status", string(*req.Status))
	}
	if req.MinPrice != nil {
		q.Set("min_price", strconv.FormatInt(*req.MinPrice, 10))
	}
	if req.MaxPrice != nil {
		q.Set("max_price", strconv.FormatInt(*req.MaxPrice, 10))
	}
	u.RawQuery = q.Encode()

	httpReq, err := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.config.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result struct {
		Items []Listing `json:"items"`
		Count int       `json:"count"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &FetchAllListingsResponse{
		Items: result.Items,
		Count: result.Count,
	}, nil
}

func (s *svc) FetchListing(ctx context.Context, req FetchListingRequest) (*FetchListingResponse, error) {
	fullURL := fmt.Sprintf("%s/listings/%d", s.config.URL, req.ID)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.config.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var listing Listing
	if err := json.NewDecoder(resp.Body).Decode(&listing); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &FetchListingResponse{Listing: &listing}, nil
}

func (s *svc) FetchUserListings(ctx context.Context) (*FetchUserListingsResponse, error) {
	userID, roleID, err := s.extractUserAndRole(ctx)
	if err != nil {
		return nil, err
	}

	fullURL := s.config.URL + "/listings/user-lists/"

	httpReq, err := http.NewRequestWithContext(ctx, "GET", fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("X-User-ID", userID)
	httpReq.Header.Set("X-Role-ID", roleID)

	resp, err := s.config.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var listings []Listing
	if err := json.NewDecoder(resp.Body).Decode(&listings); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &FetchUserListingsResponse{Listings: listings}, nil
}

func (s *svc) FetchListingsByUserID(ctx context.Context, req FetchListingsByUserIDRequest) (*FetchListingsByUserIDResponse, error) {
	// Extract and validate user role - must be admin
	userID, roleID, err := s.extractUserAndRole(ctx)
	if err != nil {
		return nil, err
	}

	// Check if user is admin
	if roleID != string(httplib.ADMIN) {
		return nil, fmt.Errorf("admin access required")
	}

	// Build URL with user_id query parameter
	fullURL := s.config.URL + "/listings/by-user-id?user_id=" + req.UserID.String()

	httpReq, err := http.NewRequestWithContext(ctx, "GET", fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Forward user ID and role ID headers
	httpReq.Header.Set("X-User-ID", userID)
	httpReq.Header.Set("X-Role-ID", roleID)

	resp, err := s.config.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var listings []Listing
	if err := json.NewDecoder(resp.Body).Decode(&listings); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &FetchListingsByUserIDResponse{Listings: listings}, nil
}

func (s *svc) UpdateListing(ctx context.Context, req UpdateListingRequest) (*UpdateListingResponse, error) {
	userID, roleID, err := s.extractUserAndRole(ctx)
	if err != nil {
		return nil, err
	}

	updateParams := struct {
		Title       *string   `json:"title,omitempty"`
		Description *string   `json:"description,omitempty"`
		Price       *int64    `json:"price,omitempty"`
		Category    *Category `json:"category,omitempty"`
		Status      *Status   `json:"status,omitempty"`
	}{
		Title:       req.Title,
		Description: req.Description,
		Price:       req.Price,
		Category:    req.Category,
		Status:      req.Status,
	}

	reqBody, err := json.Marshal(updateParams)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	fullURL := fmt.Sprintf("%s/listings/update/%d", s.config.URL, req.ID)
	httpReq, err := http.NewRequestWithContext(ctx, "PATCH", fullURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-User-ID", userID)
	httpReq.Header.Set("X-Role-ID", roleID)

	resp, err := s.config.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var listing Listing
	if err := json.NewDecoder(resp.Body).Decode(&listing); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &UpdateListingResponse{Listing: &listing}, nil
}

func (s *svc) DeleteListing(ctx context.Context, req DeleteListingRequest) (*DeleteListingResponse, error) {
	userID, roleID, err := s.extractUserAndRole(ctx)
	if err != nil {
		return nil, err
	}

	fullURL := fmt.Sprintf("%s/listings/delete/%d", s.config.URL, req.ID)
	if req.Hard != nil && *req.Hard {
		fullURL += "?hard=true"
	}

	httpReq, err := http.NewRequestWithContext(ctx, "DELETE", fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("X-User-ID", userID)
	httpReq.Header.Set("X-Role-ID", roleID)

	resp, err := s.config.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &DeleteListingResponse{Status: result.Status}, nil
}

func (s *svc) UploadMedia(ctx context.Context, r *http.Request, listingID *int64) (*UploadMediaResponse, error) {
	userID, roleID, err := s.extractUserAndRole(ctx)
	if err != nil {
		return nil, err
	}

	fullURL := s.config.URL + "/listings/upload"
	httpReq, err := http.NewRequestWithContext(ctx, "POST", fullURL, r.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Forward Content-Type header from original request
	httpReq.Header.Set("Content-Type", r.Header.Get("Content-Type"))
	httpReq.Header.Set("X-User-ID", userID)
	httpReq.Header.Set("X-Role-ID", roleID)

	resp, err := s.config.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result struct {
		Message string              `json:"message"`
		Uploads []UploadSASResponse `json:"uploads"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// If listing ID is provided, automatically persist permanent URLs to database
	if listingID != nil && len(result.Uploads) > 0 {
		// Extract permanent URLs from uploads
		permanentURLs := make([]string, 0, len(result.Uploads))
		for _, upload := range result.Uploads {
			if upload.PermanentPublicURL != "" {
				permanentURLs = append(permanentURLs, upload.PermanentPublicURL)
			}
		}

		// Persist URLs to database if we have any
		if len(permanentURLs) > 0 {
			addMediaReq := AddMediaURLRequest{
				ID:        *listingID,
				MediaUrls: permanentURLs,
			}
			_, err := s.AddMediaURL(ctx, addMediaReq)
			if err != nil {
				// Log error but don't fail the upload response
				// The SAS URLs are still valid, just the persistence failed
				fmt.Printf("Warning: Failed to persist media URLs to listing %d: %v\n", *listingID, err)
			}
		}
	}

	return &UploadMediaResponse{
		Message: result.Message,
		Uploads: result.Uploads,
	}, nil
}

func (s *svc) AddMediaURL(ctx context.Context, req AddMediaURLRequest) (*AddMediaURLResponse, error) {
	userID, roleID, err := s.extractUserAndRole(ctx)
	if err != nil {
		return nil, err
	}

	reqBody := struct {
		MediaUrls []string `json:"media_urls"`
	}{
		MediaUrls: req.MediaUrls,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	fullURL := fmt.Sprintf("%s/listings/add-media-url/%d", s.config.URL, req.ID)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", fullURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-User-ID", userID)
	httpReq.Header.Set("X-Role-ID", roleID)

	resp, err := s.config.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result struct {
		Message string `json:"message"`
		Count   int    `json:"count"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &AddMediaURLResponse{
		Message: result.Message,
		Count:   result.Count,
	}, nil
}

func (s *svc) ChatSearch(ctx context.Context, req ChatSearchRequest) (*ChatSearchResponse, error) {
	reqBody := struct {
		Query string `json:"query"`
	}{
		Query: req.Query,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	fullURL := s.config.URL + "/listings/chatsearch"
	httpReq, err := http.NewRequestWithContext(ctx, "POST", fullURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.config.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var listings []Listing
	if err := json.NewDecoder(resp.Body).Decode(&listings); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &ChatSearchResponse{Listings: listings}, nil
}

func (s *svc) FetchFlaggedListings(ctx context.Context, req FetchFlaggedListingsRequest) (*FetchFlaggedListingsResponse, error) {
	// Extract and validate user role - must be admin
	userID, roleID, err := s.extractUserAndRole(ctx)
	if err != nil {
		return nil, err
	}

	// Check if user is admin
	if roleID != string(httplib.ADMIN) {
		return nil, fmt.Errorf("admin access required")
	}

	// Build URL with optional status filter
	fullURL := s.config.URL + "/listings/flagged"
	u, err := url.Parse(fullURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse URL: %w", err)
	}

	if req.Status != nil {
		q := u.Query()
		q.Set("status", string(*req.Status))
		u.RawQuery = q.Encode()
	}

	httpReq, err := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Forward user ID and role ID headers
	httpReq.Header.Set("X-User-ID", userID)
	httpReq.Header.Set("X-Role-ID", roleID)

	resp, err := s.config.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var flaggedListings []FlaggedListing
	if err := json.NewDecoder(resp.Body).Decode(&flaggedListings); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &FetchFlaggedListingsResponse{
		FlaggedListings: flaggedListings,
		Count:           len(flaggedListings),
	}, nil
}

func (s *svc) FlagListing(ctx context.Context, req FlagListingRequest) (*FlagListingResponse, error) {
	// Extract and validate user authentication
	userID, roleID, err := s.extractUserAndRole(ctx)
	if err != nil {
		return nil, err
	}

	// Build request body
	reqBody := struct {
		Reason  FlagReason `json:"reason"`
		Details *string    `json:"details,omitempty"`
	}{
		Reason:  req.Reason,
		Details: req.Details,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	fullURL := fmt.Sprintf("%s/listings/flag/%d", s.config.URL, req.ListingID)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", fullURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-User-ID", userID)
	httpReq.Header.Set("X-Role-ID", roleID)

	resp, err := s.config.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var flaggedListing FlaggedListing
	if err := json.NewDecoder(resp.Body).Decode(&flaggedListing); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &FlagListingResponse{
		FlaggedListing: flaggedListing,
	}, nil
}

func (s *svc) UpdateFlagListing(ctx context.Context, req UpdateFlagListingRequest) (*UpdateFlagListingResponse, error) {
	// Extract and validate user authentication
	userID, roleID, err := s.extractUserAndRole(ctx)
	if err != nil {
		return nil, err
	}

	// Check if user is admin
	if roleID != string(httplib.ADMIN) {
		return nil, fmt.Errorf("admin access required")
	}

	// Build request body
	reqBody := struct {
		Status          FlagStatus `json:"status"`
		ResolutionNotes *string    `json:"resolution_notes,omitempty"`
	}{
		Status:          req.Status,
		ResolutionNotes: req.ResolutionNotes,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	fullURL := fmt.Sprintf("%s/listings/flag/%d", s.config.URL, req.FlagID)
	httpReq, err := http.NewRequestWithContext(ctx, "PATCH", fullURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-User-ID", userID)
	httpReq.Header.Set("X-Role-ID", roleID)

	resp, err := s.config.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var flaggedListing FlaggedListing
	if err := json.NewDecoder(resp.Body).Decode(&flaggedListing); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &UpdateFlagListingResponse{FlaggedListing: flaggedListing}, nil
}
