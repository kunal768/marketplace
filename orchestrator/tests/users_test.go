package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"testing"
)

func TestMain(m *testing.M) {
	// Setup test server (t can be nil in TestMain)
	setupTestServer(nil)

	// Run tests
	code := m.Run()

	// Teardown
	teardownTestServer(nil)

	os.Exit(code)
}

func TestSignupHandler(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		email := generateTestEmail()
		username := generateTestUsername()
		password := "testpass123"
		reqBody := map[string]string{
			"user_name": username,
			"email":     email,
			"password":  password,
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := http.Post(testServer.URL+"/api/users/signup", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusCreated {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 201, got %d: %v", resp.StatusCode, errResp)
		}

		var signupResp map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&signupResp); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if signupResp["message"] == nil {
			t.Error("Expected message in response")
		}

		userData, ok := signupResp["user"].(map[string]interface{})
		if !ok {
			t.Fatal("Expected user object in response")
		}

		if userData["user_id"] == nil {
			t.Error("Expected user_id in user object")
		}

		// Track user for cleanup
		if userID, ok := userData["user_id"].(string); ok {
			mu.Lock()
			createdUsers = append(createdUsers, userID)
			mu.Unlock()
		}
	})

	t.Run("DuplicateEmail", func(t *testing.T) {
		email := generateTestEmail()
		username1 := generateTestUsername()
		password := "testpass123"
		// Create first user
		userID, err := createTestUser(t, email, username1, password)
		if err != nil {
			t.Fatalf("Failed to create first user: %v", err)
		}
		mu.Lock()
		createdUsers = append(createdUsers, userID)
		mu.Unlock()

		// Try to create second user with same email
		reqBody := map[string]string{
			"user_name": generateTestUsername(),
			"email":     email,
			"password":  password,
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := http.Post(testServer.URL+"/api/users/signup", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusConflict {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 409, got %d: %v", resp.StatusCode, errResp)
		}
	})

	t.Run("InvalidInput", func(t *testing.T) {
		// Test missing required fields
		reqBody := map[string]string{
			"user_name": "test",
			// Missing email, password, phone
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := http.Post(testServer.URL+"/api/users/signup", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusBadRequest {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 400, got %d: %v", resp.StatusCode, errResp)
		}
	})

	t.Run("InvalidEmailFormat", func(t *testing.T) {
		reqBody := map[string]string{
			"user_name": generateTestUsername(),
			"email":     "notanemail",
			"password":  "testpass123",
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := http.Post(testServer.URL+"/api/users/signup", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusBadRequest {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 400, got %d: %v", resp.StatusCode, errResp)
		}
	})

	t.Run("NonSJSUEmail", func(t *testing.T) {
		reqBody := map[string]string{
			"user_name": generateTestUsername(),
			"email":     "test@gmail.com",
			"password":  "testpass123",
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := http.Post(testServer.URL+"/api/users/signup", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusBadRequest {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 400, got %d: %v", resp.StatusCode, errResp)
		}
	})
}

func TestLoginHandler(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		email := generateTestEmail()
		username := generateTestUsername()
		password := "testpass123"

		// Create user first
		userID, err := createTestUser(t, email, username, password)
		if err != nil {
			t.Fatalf("Failed to create user: %v", err)
		}
		mu.Lock()
		createdUsers = append(createdUsers, userID)
		mu.Unlock()

		// Login
		reqBody := map[string]string{
			"email":    email,
			"password": password,
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := http.Post(testServer.URL+"/api/users/login", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 200, got %d: %v", resp.StatusCode, errResp)
		}

		var loginResp map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&loginResp); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if loginResp["token"] == nil {
			t.Error("Expected token in response")
		}

		if loginResp["refresh_token"] == nil {
			t.Error("Expected refresh_token in response")
		}
	})

	t.Run("InvalidCredentials", func(t *testing.T) {
		email := generateTestEmail()
		username := generateTestUsername()
		password := "testpass123"

		// Create user first
		userID, err := createTestUser(t, email, username, password)
		if err != nil {
			t.Fatalf("Failed to create user: %v", err)
		}
		mu.Lock()
		createdUsers = append(createdUsers, userID)
		mu.Unlock()

		// Try to login with wrong password
		reqBody := map[string]string{
			"email":    email,
			"password": "wrongpassword",
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := http.Post(testServer.URL+"/api/users/login", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusUnauthorized {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 401, got %d: %v", resp.StatusCode, errResp)
		}
	})

	t.Run("MissingFields", func(t *testing.T) {
		reqBody := map[string]string{
			"email": generateTestEmail(),
			// Missing password
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := http.Post(testServer.URL+"/api/users/login", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusBadRequest {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 400, got %d: %v", resp.StatusCode, errResp)
		}
	})

	t.Run("NonExistentUser", func(t *testing.T) {
		reqBody := map[string]string{
			"email":    generateTestEmail(),
			"password": "testpass123",
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := http.Post(testServer.URL+"/api/users/login", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusUnauthorized {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 401, got %d: %v", resp.StatusCode, errResp)
		}
	})
}

func TestRefreshTokenHandler(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		email := generateTestEmail()
		username := generateTestUsername()
		password := "testpass123"

		// Create user and login
		userID, err := createTestUser(t, email, username, password)
		if err != nil {
			t.Fatalf("Failed to create user: %v", err)
		}
		mu.Lock()
		createdUsers = append(createdUsers, userID)
		mu.Unlock()

		_, refreshToken, err := loginTestUser(t, email, password)
		if err != nil {
			t.Fatalf("Failed to login: %v", err)
		}

		// Refresh token
		reqBody := map[string]string{
			"refresh_token": refreshToken,
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := http.Post(testServer.URL+"/api/users/refresh", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 200, got %d: %v", resp.StatusCode, errResp)
		}

		var refreshResp map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&refreshResp); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if refreshResp["access_token"] == nil {
			t.Error("Expected access_token in response")
		}

		if refreshResp["refresh_token"] == nil {
			t.Error("Expected refresh_token in response")
		}
	})

	t.Run("InvalidToken", func(t *testing.T) {
		reqBody := map[string]string{
			"refresh_token": "invalid_token",
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := http.Post(testServer.URL+"/api/users/refresh", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusUnauthorized {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 401, got %d: %v", resp.StatusCode, errResp)
		}
	})

	t.Run("MissingToken", func(t *testing.T) {
		reqBody := map[string]string{}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := http.Post(testServer.URL+"/api/users/refresh", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusBadRequest {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 400, got %d: %v", resp.StatusCode, errResp)
		}
	})
}

func TestGetUserHandler(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		email := generateTestEmail()
		username := generateTestUsername()
		password := "testpass123"

		// Create user and login
		userID, err := createTestUser(t, email, username, password)
		if err != nil {
			t.Fatalf("Failed to create user: %v", err)
		}
		mu.Lock()
		createdUsers = append(createdUsers, userID)
		mu.Unlock()

		accessToken, _, err := loginTestUser(t, email, password)
		if err != nil {
			t.Fatalf("Failed to login: %v", err)
		}

		// Get user profile
		resp, err := makeAuthenticatedRequest(t, "GET", testServer.URL+"/api/users/profile", nil, accessToken)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 200, got %d: %v", resp.StatusCode, errResp)
		}

		var profileResp map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&profileResp); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if profileResp["user"] == nil {
			t.Error("Expected user object in response")
		}
	})

	t.Run("Unauthorized", func(t *testing.T) {
		// Try to get profile without token
		resp, err := http.Get(testServer.URL + "/api/users/profile")
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusUnauthorized {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 401, got %d: %v", resp.StatusCode, errResp)
		}
	})

	t.Run("InvalidToken", func(t *testing.T) {
		// Try to get profile with invalid token
		resp, err := makeAuthenticatedRequest(t, "GET", testServer.URL+"/api/users/profile", nil, "invalid_token")
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusUnauthorized {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 401, got %d: %v", resp.StatusCode, errResp)
		}
	})
}

func TestEventsVerifyHandler(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		email := generateTestEmail()
		username := generateTestUsername()
		password := "testpass123"

		// Create user and login
		userID, err := createTestUser(t, email, username, password)
		if err != nil {
			t.Fatalf("Failed to create user: %v", err)
		}
		mu.Lock()
		createdUsers = append(createdUsers, userID)
		mu.Unlock()

		accessToken, _, err := loginTestUser(t, email, password)
		if err != nil {
			t.Fatalf("Failed to login: %v", err)
		}

		// Verify events
		reqBody := map[string]string{
			"userId": userID,
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := makeAuthenticatedRequest(t, "POST", testServer.URL+"/api/events/verify", body, accessToken)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 200, got %d: %v", resp.StatusCode, errResp)
		}

		var verifyResp map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&verifyResp); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if verifyResp["valid"] != true {
			t.Error("Expected valid to be true")
		}
	})

	t.Run("Unauthorized", func(t *testing.T) {
		reqBody := map[string]string{
			"userId": "some-user-id",
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := http.Post(testServer.URL+"/api/events/verify", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusUnauthorized {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 401, got %d: %v", resp.StatusCode, errResp)
		}
	})

	t.Run("TokenMismatch", func(t *testing.T) {
		email1 := generateTestEmail()
		username1 := generateTestUsername()
		password := "testpass123"
		// Create first user and login
		userID1, err := createTestUser(t, email1, username1, password)
		if err != nil {
			t.Fatalf("Failed to create user: %v", err)
		}
		mu.Lock()
		createdUsers = append(createdUsers, userID1)
		mu.Unlock()

		accessToken1, _, err := loginTestUser(t, email1, password)
		if err != nil {
			t.Fatalf("Failed to login: %v", err)
		}

		// Create second user
		email2 := generateTestEmail()
		username2 := generateTestUsername()
		userID2, err := createTestUser(t, email2, username2, password)
		if err != nil {
			t.Fatalf("Failed to create user: %v", err)
		}
		mu.Lock()
		createdUsers = append(createdUsers, userID2)
		mu.Unlock()

		// Try to verify with user1's token but user2's ID
		reqBody := map[string]string{
			"userId": userID2,
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := makeAuthenticatedRequest(t, "POST", testServer.URL+"/api/events/verify", body, accessToken1)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusForbidden {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 403, got %d: %v", resp.StatusCode, errResp)
		}
	})

	t.Run("MissingUserID", func(t *testing.T) {
		email := generateTestEmail()
		username := generateTestUsername()
		password := "testpass123"

		// Create user and login
		userID, err := createTestUser(t, email, username, password)
		if err != nil {
			t.Fatalf("Failed to create user: %v", err)
		}
		mu.Lock()
		createdUsers = append(createdUsers, userID)
		mu.Unlock()

		accessToken, _, err := loginTestUser(t, email, password)
		if err != nil {
			t.Fatalf("Failed to login: %v", err)
		}

		reqBody := map[string]string{}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := makeAuthenticatedRequest(t, "POST", testServer.URL+"/api/events/verify", body, accessToken)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusBadRequest {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 400, got %d: %v", resp.StatusCode, errResp)
		}
	})
}

func TestHealthEndpoint(t *testing.T) {
	resp, err := http.Get(testServer.URL + "/health")
	if err != nil {
		t.Fatalf("Failed to make request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", resp.StatusCode)
	}

	body := make([]byte, 10)
	n, err := resp.Body.Read(body)
	if err != nil && err.Error() != "EOF" {
		t.Fatalf("Failed to read response: %v", err)
	}

	if string(body[:n]) != "OK" {
		t.Errorf("Expected 'OK', got '%s'", string(body[:n]))
	}
}
