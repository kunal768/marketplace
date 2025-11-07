package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	dbclient "github.com/kunal768/cmpe202/orchestrator/clients/db"
	mongoclient "github.com/kunal768/cmpe202/orchestrator/clients/mongo"
	"github.com/kunal768/cmpe202/orchestrator/internal/queue"
	"github.com/kunal768/cmpe202/orchestrator/listings"
	"github.com/kunal768/cmpe202/orchestrator/users"
	"go.mongodb.org/mongo-driver/mongo"
)

type testUserCreds struct {
	UserID   string
	Email    string
	Password string
}

var (
	testServer      *httptest.Server
	testDBPool      *pgxpool.Pool
	testMongo       *mongo.Client
	testMux         *http.ServeMux
	createdUsers    []string
	createdListings []int64
	userCredentials []testUserCreds // Store credentials for cleanup
	mu              sync.Mutex
	setupOnce       sync.Once
	teardownOnce    sync.Once
)

// setupTestServer initializes the test HTTP server with real database connection
// Uses sync.Once to ensure setup only happens once across all test files
// t can be nil when called from TestMain
func setupTestServer(t *testing.T) {
	setupOnce.Do(func() {
		setupTestServerOnce(t)
	})
}

func setupTestServerOnce(t *testing.T) {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		if t != nil {
			t.Logf("No .env file found; continuing with environment variables")
		}
	}

	// Database connection
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		if t != nil {
			t.Fatal("DATABASE_URL is not set for tests")
		} else {
			panic("DATABASE_URL is not set for tests")
		}
	}

	dbsvc := dbclient.NewDBService(dbURL)
	pool, err := dbsvc.Connect()
	if err != nil {
		if t != nil {
			t.Fatalf("Failed to connect to test database: %v", err)
		} else {
			panic(fmt.Sprintf("Failed to connect to test database: %v", err))
		}
	}
	testDBPool = pool

	// MongoDB connection (optional)
	chatMongoURI := os.Getenv("CHAT_MONGO_URI")
	if chatMongoURI != "" {
		mongoSvc := mongoclient.NewMongoService(chatMongoURI)
		client, err := mongoSvc.Connect()
		if err != nil {
			if t != nil {
				t.Logf("Failed to connect to MongoDB (optional): %v", err)
			}
		} else {
			testMongo = client
		}
	}

	// RabbitMQ publisher (optional)
	var publisher queue.Publisher
	rabbitURL := os.Getenv("RABBITMQ_URL")
	queueName := os.Getenv("RABBITMQ_QUEUE_NAME")
	if rabbitURL != "" && queueName != "" {
		pub, err := queue.NewRabbitMQPublisher(rabbitURL, queueName)
		if err != nil {
			if t != nil {
				t.Logf("Failed to create RabbitMQ publisher (optional): %v", err)
			}
		} else {
			publisher = pub
		}
	}

	// Initialize user components
	userRepo := users.NewRepository(testDBPool)
	userService := users.NewService(userRepo, publisher, testMongo)
	userEndpoints := users.NewEndpoints(userService)

	// Initialize listing components
	listingBaseURL := os.Getenv("LISTING_SERVICE_URL")
	if listingBaseURL == "" {
		listingBaseURL = "http://localhost:8081" // Default for testing
	}
	listingSharedSecret := os.Getenv("LISTING_SERVICE_SHARED_SECRET")
	if listingSharedSecret == "" {
		listingSharedSecret = "test-secret" // Default for testing
	}
	listingService := listings.NewListingService(listingBaseURL, listingSharedSecret)
	listingEndpoints := listings.NewEndpoints(listingService)

	// Setup HTTP server
	testMux = http.NewServeMux()
	userEndpoints.RegisterRoutes(testMux, testDBPool)
	listingEndpoints.RegisterRoutes(testMux, testDBPool)

	// Health check endpoint
	testMux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	testServer = httptest.NewServer(testMux)
}

// teardownTestServer cleans up test resources
// Uses sync.Once to ensure teardown only happens once across all test files
// t can be nil when called from TestMain
func teardownTestServer(t *testing.T) {
	teardownOnce.Do(func() {
		teardownTestServerOnce(t)
	})
}

func teardownTestServerOnce(t *testing.T) {
	if testServer != nil {
		testServer.Close()
	}

	// Cleanup test data
	cleanupTestData(t)

	if testDBPool != nil {
		testDBPool.Close()
	}

	if testMongo != nil {
		testMongo.Disconnect(context.Background())
	}
}

// createTestUser creates a test user via signup endpoint and stores credentials for cleanup
func createTestUser(t *testing.T, email, username, password, phone string) (string, error) {
	reqBody := map[string]string{
		"user_name": username,
		"email":     email,
		"password":  password,
		"phone":     phone,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := http.Post(testServer.URL+"/api/users/signup", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return "", fmt.Errorf("failed to make signup request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		var errResp map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&errResp)
		return "", fmt.Errorf("signup failed with status %d: %v", resp.StatusCode, errResp)
	}

	var signupResp map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&signupResp); err != nil {
		return "", fmt.Errorf("failed to decode signup response: %w", err)
	}

	userData, ok := signupResp["user"].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("invalid user data in response")
	}

	userID, ok := userData["user_id"].(string)
	if !ok {
		return "", fmt.Errorf("user_id not found in response")
	}

	// Track created user and store credentials for cleanup
	mu.Lock()
	createdUsers = append(createdUsers, userID)
	userCredentials = append(userCredentials, testUserCreds{
		UserID:   userID,
		Email:    email,
		Password: password,
	})
	mu.Unlock()

	return userID, nil
}

// loginTestUser logs in a test user and returns access token and refresh token
func loginTestUser(t *testing.T, email, password string) (accessToken, refreshToken string, err error) {
	reqBody := map[string]string{
		"email":    email,
		"password": password,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", "", fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := http.Post(testServer.URL+"/api/users/login", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return "", "", fmt.Errorf("failed to make login request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errResp map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&errResp)
		return "", "", fmt.Errorf("login failed with status %d: %v", resp.StatusCode, errResp)
	}

	var loginResp map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&loginResp); err != nil {
		return "", "", fmt.Errorf("failed to decode login response: %w", err)
	}

	accessToken, _ = loginResp["token"].(string)
	refreshToken, _ = loginResp["refresh_token"].(string)

	if accessToken == "" {
		return "", "", fmt.Errorf("access token not found in response")
	}

	return accessToken, refreshToken, nil
}

// makeAuthenticatedRequest makes an HTTP request with authentication token
func makeAuthenticatedRequest(t *testing.T, method, url string, body []byte, accessToken string) (*http.Response, error) {
	req, err := http.NewRequest(method, url, bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	if accessToken != "" {
		req.Header.Set("Authorization", "Bearer "+accessToken)
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	client := &http.Client{Timeout: 10 * time.Second}
	return client.Do(req)
}

// cleanupTestData deletes all test users and listings created during tests
func cleanupTestData(t *testing.T) {
	ctx := context.Background()

	mu.Lock()
	usersToDelete := make([]string, len(createdUsers))
	copy(usersToDelete, createdUsers)
	listingsToDelete := make([]int64, len(createdListings))
	copy(listingsToDelete, createdListings)
	credsToUse := make([]testUserCreds, len(userCredentials))
	copy(credsToUse, userCredentials)
	mu.Unlock()

	if testDBPool == nil {
		return
	}

	// Clean up listings first (they depend on users)
	// Try to delete listings via API if we have any users with credentials
	// This is best-effort since listings are in listing-service
	if len(credsToUse) > 0 && len(listingsToDelete) > 0 && testServer != nil {
		// Try to login with the first user to get a token for deleting listings
		if len(credsToUse) > 0 {
			creds := credsToUse[0]
			accessToken, _, err := loginTestUser(t, creds.Email, creds.Password)
			if err == nil && accessToken != "" {
				// Successfully got token, try to delete listings
				for _, listingID := range listingsToDelete {
					_ = cleanupListing(listingID, accessToken) // Best effort, ignore errors
				}
			}
		}
	}

	// Delete user_login_auth records
	for _, userID := range usersToDelete {
		_, _ = testDBPool.Exec(ctx, "DELETE FROM user_login_auth WHERE user_id = $1", userID)
	}

	// Delete user_auth records
	for _, userID := range usersToDelete {
		_, _ = testDBPool.Exec(ctx, "DELETE FROM user_auth WHERE user_id = $1", userID)
	}

	// Delete users
	for _, userID := range usersToDelete {
		_, _ = testDBPool.Exec(ctx, "DELETE FROM users WHERE user_id = $1", userID)
	}

	// Clear tracking arrays
	mu.Lock()
	createdUsers = []string{}
	createdListings = []int64{}
	userCredentials = []testUserCreds{}
	mu.Unlock()
}

// cleanupListing attempts to delete a listing via API
// This is a helper function for cleanup that tries to delete listings
// created during tests. It requires a valid access token.
func cleanupListing(listingID int64, accessToken string) error {
	if testServer == nil {
		return fmt.Errorf("test server not initialized")
	}

	url := fmt.Sprintf("%s/api/listings/delete/%d?hard=true", testServer.URL, listingID)
	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return err
	}

	if accessToken != "" {
		req.Header.Set("Authorization", "Bearer "+accessToken)
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to delete listing: status %d", resp.StatusCode)
	}

	return nil
}

// trackListingID tracks a listing ID for cleanup
func trackListingID(listingID int64) {
	mu.Lock()
	defer mu.Unlock()
	createdListings = append(createdListings, listingID)
}

// generateTestEmail generates a unique test email
func generateTestEmail() string {
	return fmt.Sprintf("test_%d@sjsu.edu", time.Now().UnixNano())
}

// generateTestUsername generates a unique test username
func generateTestUsername() string {
	return fmt.Sprintf("testuser_%d", time.Now().UnixNano())
}

