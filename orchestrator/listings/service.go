package listings

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
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
	UpdateListing(ctx context.Context, req UpdateListingRequest) (*UpdateListingResponse, error)
	/* user can delete only their own listing, admin can delete all listings */
	DeleteListing(ctx context.Context, req DeleteListingRequest) (*DeleteListingResponse, error)
	UploadMedia(ctx context.Context, req UploadMediaRequest) (*UploadMediaResponse, error)
	AddMediaURL(ctx context.Context, req AddMediaURLRequest) (*AddMediaURLResponse, error)
	ChatSearch(ctx context.Context, req ChatSearchRequest) (*ChatSearchResponse, error)
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
		if roleInt, ok := roleIDVal.(int); ok {
			roleID = strconv.Itoa(roleInt)
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

func (s *svc) UploadMedia(ctx context.Context, req UploadMediaRequest) (*UploadMediaResponse, error) {
	userID, roleID, err := s.extractUserAndRole(ctx)
	if err != nil {
		return nil, err
	}

	var requestBody bytes.Buffer
	writer := multipart.NewWriter(&requestBody)

	for _, file := range req.Files {
		part, err := writer.CreateFormFile("media", file.FileName)
		if err != nil {
			return nil, fmt.Errorf("failed to create form file: %w", err)
		}

		// Write the actual file data
		if len(file.Data) > 0 {
			_, err = part.Write(file.Data)
			if err != nil {
				return nil, fmt.Errorf("failed to write file data: %w", err)
			}
		}
	}

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	fullURL := s.config.URL + "/listings/upload"
	httpReq, err := http.NewRequestWithContext(ctx, "POST", fullURL, &requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", writer.FormDataContentType())
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
