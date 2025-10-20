package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type AuthClient interface {
	Verify(ctx context.Context, userID string, bearerToken string) error
}

type HTTPClient interface {
	Do(req *http.Request) (*http.Response, error)
}

type OrchestratorClient struct {
	BaseURL     string
	HTTP        HTTPClient
	HTTPTimeout time.Duration
}

type verifyRequest struct {
	UserID string `json:"userId"`
}

func (c OrchestratorClient) Verify(ctx context.Context, userID string, bearerToken string) error {
	if c.HTTP == nil {
		c.HTTP = &http.Client{Timeout: c.HTTPTimeout}
	}
	body, _ := json.Marshal(verifyRequest{UserID: userID})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/api/events/verify", c.BaseURL), bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", bearerToken))

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("auth verify failed: status %d", resp.StatusCode)
	}
	return nil
}
