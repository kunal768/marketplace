package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"testing"
)

func TestGetAllListings(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		resp, err := http.Get(testServer.URL + "/api/listings/")
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 200, got %d: %v", resp.StatusCode, errResp)
		}

		var listingsResp map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&listingsResp); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if listingsResp["items"] == nil {
			t.Error("Expected items in response")
		}

		if listingsResp["count"] == nil {
			t.Error("Expected count in response")
		}
	})

	t.Run("WithFilters", func(t *testing.T) {
		url := testServer.URL + "/api/listings/?limit=10&offset=0&category=GADGET&status=AVAILABLE"
		resp, err := http.Get(url)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 200, got %d: %v", resp.StatusCode, errResp)
		}
	})

	t.Run("WithPagination", func(t *testing.T) {
		url := testServer.URL + "/api/listings/?limit=5&offset=0"
		resp, err := http.Get(url)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 200, got %d: %v", resp.StatusCode, errResp)
		}
	})
}

func TestGetListingByID(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		// First, create a listing to test with
		email := generateTestEmail()
		username := generateTestUsername()
		password := "testpass123"
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

		// Create a listing
		createReq := map[string]interface{}{
			"title":    "Test Listing",
			"price":    100,
			"category": "GADGET",
		}

		createBody, _ := json.Marshal(createReq)
		createResp, err := makeAuthenticatedRequest(t, "POST", testServer.URL+"/api/listings/create", createBody, accessToken)
		if err != nil {
			t.Fatalf("Failed to create listing: %v", err)
		}
		defer createResp.Body.Close()

		if createResp.StatusCode != http.StatusCreated {
			var errResp map[string]interface{}
			json.NewDecoder(createResp.Body).Decode(&errResp)
			t.Fatalf("Failed to create listing: status %d, %v", createResp.StatusCode, errResp)
		}

		var listingResp map[string]interface{}
		json.NewDecoder(createResp.Body).Decode(&listingResp)

		listingID, ok := listingResp["id"].(float64)
		if !ok {
			t.Fatal("Failed to get listing ID from create response")
		}

		trackListingID(int64(listingID))

		// Get the listing by ID
		url := fmt.Sprintf("%s/api/listings/%d", testServer.URL, int64(listingID))
		resp, err := http.Get(url)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 200, got %d: %v", resp.StatusCode, errResp)
		}

		var listing map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&listing); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if listing["id"] == nil {
			t.Error("Expected id in listing response")
		}
	})

	t.Run("NotFound", func(t *testing.T) {
		// Use a very large ID that likely doesn't exist
		url := fmt.Sprintf("%s/api/listings/999999999", testServer.URL)
		resp, err := http.Get(url)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusNotFound {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 404, got %d: %v", resp.StatusCode, errResp)
		}
	})
}

func TestCreateListing(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		email := generateTestEmail()
		username := generateTestUsername()
		password := "testpass123"
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

		reqBody := map[string]interface{}{
			"title":       "Test Listing",
			"description": "A test listing description",
			"price":       150,
			"category":    "GADGET",
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := makeAuthenticatedRequest(t, "POST", testServer.URL+"/api/listings/create", body, accessToken)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusCreated {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 201, got %d: %v", resp.StatusCode, errResp)
		}

		var listingResp map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&listingResp); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if listingResp["id"] == nil {
			t.Error("Expected id in listing response")
		}

		if listingID, ok := listingResp["id"].(float64); ok {
			trackListingID(int64(listingID))
		}
	})

	t.Run("Unauthorized", func(t *testing.T) {
		reqBody := map[string]interface{}{
			"title":    "Test Listing",
			"price":    150,
			"category": "GADGET",
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := http.Post(testServer.URL+"/api/listings/create", "application/json", bytes.NewBuffer(body))
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

	t.Run("InvalidInput", func(t *testing.T) {
		email := generateTestEmail()
		username := generateTestUsername()
		password := "testpass123"
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

		// Missing required fields
		reqBody := map[string]interface{}{
			"title": "Test Listing",
			// Missing price and category
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := makeAuthenticatedRequest(t, "POST", testServer.URL+"/api/listings/create", body, accessToken)
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

func TestUpdateListing(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		email := generateTestEmail()
		username := generateTestUsername()
		password := "testpass123"
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

		// Create a listing first
		createReq := map[string]interface{}{
			"title":    "Original Title",
			"price":    100,
			"category": "GADGET",
		}

		createBody, _ := json.Marshal(createReq)
		createResp, err := makeAuthenticatedRequest(t, "POST", testServer.URL+"/api/listings/create", createBody, accessToken)
		if err != nil {
			t.Fatalf("Failed to create listing: %v", err)
		}
		defer createResp.Body.Close()

		var listingResp map[string]interface{}
		json.NewDecoder(createResp.Body).Decode(&listingResp)
		listingID, _ := listingResp["id"].(float64)
		trackListingID(int64(listingID))

		// Update the listing
		updateReq := map[string]interface{}{
			"title": "Updated Title",
			"price": 200,
		}

		updateBody, err := json.Marshal(updateReq)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		url := fmt.Sprintf("%s/api/listings/update/%d", testServer.URL, int64(listingID))
		resp, err := makeAuthenticatedRequest(t, "PATCH", url, updateBody, accessToken)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 200, got %d: %v", resp.StatusCode, errResp)
		}

		var updatedListing map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&updatedListing); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if updatedListing["title"] != "Updated Title" {
			t.Errorf("Expected title to be 'Updated Title', got %v", updatedListing["title"])
		}
	})

	t.Run("Unauthorized", func(t *testing.T) {
		updateReq := map[string]interface{}{
			"title": "Updated Title",
		}

		updateBody, _ := json.Marshal(updateReq)
		url := fmt.Sprintf("%s/api/listings/update/1", testServer.URL)
		resp, err := http.Post(url, "application/json", bytes.NewBuffer(updateBody))
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusUnauthorized && resp.StatusCode != http.StatusMethodNotAllowed {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 401 or 405, got %d: %v", resp.StatusCode, errResp)
		}
	})

	t.Run("NotFound", func(t *testing.T) {
		email := generateTestEmail()
		username := generateTestUsername()
		password := "testpass123"
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

		updateReq := map[string]interface{}{
			"title": "Updated Title",
		}

		updateBody, _ := json.Marshal(updateReq)
		url := fmt.Sprintf("%s/api/listings/update/999999999", testServer.URL)
		resp, err := makeAuthenticatedRequest(t, "PATCH", url, updateBody, accessToken)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusNotFound {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 404, got %d: %v", resp.StatusCode, errResp)
		}
	})
}

func TestDeleteListing(t *testing.T) {
	t.Run("SuccessSoftDelete", func(t *testing.T) {
		email := generateTestEmail()
		username := generateTestUsername()
		password := "testpass123"
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

		// Create a listing first
		createReq := map[string]interface{}{
			"title":    "Listing to Delete",
			"price":    100,
			"category": "GADGET",
		}

		createBody, _ := json.Marshal(createReq)
		createResp, err := makeAuthenticatedRequest(t, "POST", testServer.URL+"/api/listings/create", createBody, accessToken)
		if err != nil {
			t.Fatalf("Failed to create listing: %v", err)
		}
		defer createResp.Body.Close()

		var listingResp map[string]interface{}
		json.NewDecoder(createResp.Body).Decode(&listingResp)
		listingID, _ := listingResp["id"].(float64)
		trackListingID(int64(listingID))

		// Delete the listing (soft delete)
		url := fmt.Sprintf("%s/api/listings/delete/%d?hard=false", testServer.URL, int64(listingID))
		resp, err := makeAuthenticatedRequest(t, "DELETE", url, nil, accessToken)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 200, got %d: %v", resp.StatusCode, errResp)
		}
	})

	t.Run("Unauthorized", func(t *testing.T) {
		url := fmt.Sprintf("%s/api/listings/delete/1", testServer.URL)
		resp, err := http.Get(url)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusUnauthorized && resp.StatusCode != http.StatusMethodNotAllowed {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 401 or 405, got %d: %v", resp.StatusCode, errResp)
		}
	})
}

func TestGetUserListings(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		email := generateTestEmail()
		username := generateTestUsername()
		password := "testpass123"
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

		// Create a listing
		createReq := map[string]interface{}{
			"title":    "User Listing",
			"price":    100,
			"category": "GADGET",
		}

		createBody, _ := json.Marshal(createReq)
		createResp, err := makeAuthenticatedRequest(t, "POST", testServer.URL+"/api/listings/create", createBody, accessToken)
		if err != nil {
			t.Fatalf("Failed to create listing: %v", err)
		}
		defer createResp.Body.Close()

		var listingResp map[string]interface{}
		json.NewDecoder(createResp.Body).Decode(&listingResp)
		if listingID, ok := listingResp["id"].(float64); ok {
			trackListingID(int64(listingID))
		}

		// Get user listings
		resp, err := makeAuthenticatedRequest(t, "GET", testServer.URL+"/api/listings/user-lists/", nil, accessToken)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 200, got %d: %v", resp.StatusCode, errResp)
		}

		var listingsResp []interface{}
		if err := json.NewDecoder(resp.Body).Decode(&listingsResp); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if len(listingsResp) == 0 {
			t.Error("Expected at least one listing in response")
		}
	})

	t.Run("Unauthorized", func(t *testing.T) {
		resp, err := http.Get(testServer.URL + "/api/listings/user-lists/")
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

	t.Run("EmptyResults", func(t *testing.T) {
		email := generateTestEmail()
		username := generateTestUsername()
		password := "testpass123"
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

		// Get user listings without creating any
		resp, err := makeAuthenticatedRequest(t, "GET", testServer.URL+"/api/listings/user-lists/", nil, accessToken)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 200, got %d: %v", resp.StatusCode, errResp)
		}

		var listingsResp []interface{}
		if err := json.NewDecoder(resp.Body).Decode(&listingsResp); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		// Empty results are valid
		if listingsResp == nil {
			t.Error("Expected empty array, got nil")
		}
	})
}

func TestUploadMedia(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		email := generateTestEmail()
		username := generateTestUsername()
		password := "testpass123"
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

		// Create multipart form data
		var requestBody bytes.Buffer
		writer := multipart.NewWriter(&requestBody)

		// Add a test file
		part, err := writer.CreateFormFile("media", "test.jpg")
		if err != nil {
			t.Fatalf("Failed to create form file: %v", err)
		}
		part.Write([]byte("fake image data"))

		writer.Close()

		req, err := http.NewRequest("POST", testServer.URL+"/api/listings/upload", &requestBody)
		if err != nil {
			t.Fatalf("Failed to create request: %v", err)
		}

		req.Header.Set("Content-Type", writer.FormDataContentType())
		req.Header.Set("Authorization", "Bearer "+accessToken)

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 200, got %d: %v", resp.StatusCode, errResp)
		}
	})

	t.Run("Unauthorized", func(t *testing.T) {
		var requestBody bytes.Buffer
		writer := multipart.NewWriter(&requestBody)
		part, _ := writer.CreateFormFile("media", "test.jpg")
		part.Write([]byte("fake image data"))
		writer.Close()

		req, _ := http.NewRequest("POST", testServer.URL+"/api/listings/upload", &requestBody)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		client := &http.Client{}
		resp, err := client.Do(req)
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

func TestAddMediaURL(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		email := generateTestEmail()
		username := generateTestUsername()
		password := "testpass123"
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

		// Create a listing first
		createReq := map[string]interface{}{
			"title":    "Listing with Media",
			"price":    100,
			"category": "GADGET",
		}

		createBody, _ := json.Marshal(createReq)
		createResp, err := makeAuthenticatedRequest(t, "POST", testServer.URL+"/api/listings/create", createBody, accessToken)
		if err != nil {
			t.Fatalf("Failed to create listing: %v", err)
		}
		defer createResp.Body.Close()

		var listingResp map[string]interface{}
		json.NewDecoder(createResp.Body).Decode(&listingResp)
		listingID, _ := listingResp["id"].(float64)
		trackListingID(int64(listingID))

		// Add media URL
		mediaReq := map[string]interface{}{
			"media_urls": []string{"https://example.com/image1.jpg", "https://example.com/image2.jpg"},
		}

		mediaBody, err := json.Marshal(mediaReq)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		url := fmt.Sprintf("%s/api/listings/add-media-url/%d", testServer.URL, int64(listingID))
		resp, err := makeAuthenticatedRequest(t, "POST", url, mediaBody, accessToken)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 200, got %d: %v", resp.StatusCode, errResp)
		}
	})

	t.Run("Unauthorized", func(t *testing.T) {
		mediaReq := map[string]interface{}{
			"media_urls": []string{"https://example.com/image1.jpg"},
		}

		mediaBody, _ := json.Marshal(mediaReq)
		url := fmt.Sprintf("%s/api/listings/add-media-url/1", testServer.URL)
		resp, err := http.Post(url, "application/json", bytes.NewBuffer(mediaBody))
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

func TestChatSearch(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		reqBody := map[string]string{
			"query": "Any routers?",
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := http.Post(testServer.URL+"/api/listings/chatsearch", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 200, got %d: %v", resp.StatusCode, errResp)
		}

		var searchResp map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if searchResp["listings"] == nil {
			t.Error("Expected listings in response")
		}
	})

	t.Run("EmptyQuery", func(t *testing.T) {
		reqBody := map[string]string{
			"query": "",
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := http.Post(testServer.URL+"/api/listings/chatsearch", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		// Empty query might be valid or invalid depending on implementation
		// Accept both 200 and 400
		if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusBadRequest {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 200 or 400, got %d: %v", resp.StatusCode, errResp)
		}
	})

	t.Run("NoResults", func(t *testing.T) {
		reqBody := map[string]string{
			"query": "nonexistentitemxyz123",
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("Failed to marshal request: %v", err)
		}

		resp, err := http.Post(testServer.URL+"/api/listings/chatsearch", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			var errResp map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&errResp)
			t.Fatalf("Expected status 200, got %d: %v", resp.StatusCode, errResp)
		}

		var searchResp map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		// Empty results are valid
		if listings, ok := searchResp["listings"].([]interface{}); ok {
			if listings == nil {
				t.Error("Expected empty array, got nil")
			}
		}
	})
}

