package listings

import (
	"context"
	"net/http"
	"time"

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
	CreateListing(ctx context.Context)
	FetchAllListings(ctx context.Context)
	UploadMedia(ctx context.Context)
	FetchUserListings(ctx context.Context)
	/* user can delete only their own listing, admin can delete all listings */
	DeleteListing(ctx context.Context, listingId string)
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

func (s *svc) CreateListing(ctx context.Context) {
	// Example of how you would use the client and URL:
	// fullURL := s.otherService.URL + "/api/v1/some-resource"
	// req, _ := http.NewRequestWithContext(ctx, "POST", fullURL, nil)
	// resp, err := s.otherService.Client.Do(req)
	// ... rest of the logic
}
func (s *svc) FetchAllListings(ctx context.Context)                {}
func (s *svc) UploadMedia(ctx context.Context)                     {}
func (s *svc) FetchUserListings(ctx context.Context)               {}
func (s *svc) DeleteListing(ctx context.Context, listingId string) {}
