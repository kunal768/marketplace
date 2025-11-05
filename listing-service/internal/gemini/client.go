package gemini

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/kunal768/cmpe202/listing-service/internal/models"
)

// --- THIS IS THE UPDATED URL ---
const geminiAPIEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent"

type Client struct {
	apiKey     string
	httpClient *http.Client
}

func NewClient() *Client {
	return &Client{
		apiKey:     os.Getenv("GOOGLE_API_KEY"),
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) GetSearchParams(ctx context.Context, userQuery string) (*models.ListFilters, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("GOOGLE_API_KEY environment variable not set")
	}

	prompt := getPrompt(userQuery) // Assumes getPrompt() function exists in this file

	apiReq := models.GeminiRequest{
		Contents: []models.Content{
			{Parts: []models.Part{{Text: prompt}}},
		},
	}

	reqBody, err := json.Marshal(apiReq)
	if err != nil {
		return nil, fmt.Errorf("error marshalling gemini request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", geminiAPIEndpoint, bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("error creating gemini request: %w", err)
	}

	req.Header.Set("x-goog-api-key", c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error sending request to gemini: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gemini API returned non-200 status: %s", resp.Status)
	}

	var apiResp models.GeminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("error decoding gemini response: %w", err)
	}

	if len(apiResp.Candidates) == 0 || len(apiResp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("no response content from gemini")
	}

	content := apiResp.Candidates[0].Content.Parts[0].Text
	log.Printf("Gemini returned raw content: %s", content)

	cleanedContent := strings.TrimSpace(content)
	cleanedContent = strings.TrimPrefix(cleanedContent, "```json")
	cleanedContent = strings.TrimPrefix(cleanedContent, "```")
	cleanedContent = strings.TrimSuffix(cleanedContent, "```")
	cleanedContent = strings.TrimSpace(cleanedContent)

	searchParams := models.ListFilters{
		Limit:  20,
		Offset: 0,
		Sort:   "created_desc",
	}

	err = json.Unmarshal([]byte(cleanedContent), &searchParams)
	if err != nil {
		return nil, fmt.Errorf("error unmarshalling search params from gemini response: %w", err)
	}

	return &searchParams, nil
}

func getPrompt(userQuery string) string {
	return fmt.Sprintf(`You are an intelligent search assistant for a campus marketplace application.
Your sole purpose is to analyze a user's query and expand it with synonyms to create a robust search.
You must respond ONLY with a valid JSON object. Do not include markdown formatting like '\' '\' '\' json, greetings, or any other explanatory text.

The JSON object should have the following optional fields:
- "category": string (one of: %s)
- "keywords": array of strings (Include the original keyword plus relevant synonyms or specific examples. Be creative.)
- "min_price": number
- "max_price": number

**Important Rule:** If the user query contains a specific identifier like a course code (e.g., 'CMPE202'), brand, or model number, focus the keywords on that specific identifier. Avoid adding general synonyms that would make the search too broad.

Here are some examples:

User query: "is there any clothes?"
Your JSON response:
{"keywords": ["clothes", "hoodie", "shirt", "jacket", "pants"]}

User query: "textbook for cmpe202"
Your JSON response:
{"category": "textbooks", "keywords": ["cmpe202", "algorithms"]}

User query: "something for my dorm room"
Your JSON response:
{"category": "essentials", "keywords": ["dorm", "room", "lamp", "desk", "chair", "microwave"]}

Analyze the following user query and provide the JSON output immediately.

User query: "%s"
`, CategoriesAsString(), userQuery)
}

func parseInt(s string, def int) int {
	if s == "" {
		return def
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return v
}
func parseInt64(s string, def int64) int64 {
	if s == "" {
		return def
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return def
	}
	return v
}

func CategoriesAsString() string {
	cats := make([]string, len(models.AllCategories))
	for i, c := range models.AllCategories {
		cats[i] = fmt.Sprintf(`"%s"`, c)
	}
	return strings.Join(cats, ",")
}
