package chatmessage

// Get Undelivered Messages Response
type GetUndeliveredMessagesResponse struct {
	Messages []map[string]interface{} `json:"messages"`
	Count    int                       `json:"count"`
}

// Fetch and Republish Undelivered Messages Response
type FetchAndRepublishUndeliveredMessagesResponse struct {
	Message string `json:"message"`
	Count   int    `json:"count"`
}

// Get Conversations Response
type GetConversationsResponse struct {
	Conversations []Conversation `json:"conversations"`
	Total         int            `json:"total"`
}

// Get Messages Response
type GetMessagesResponse struct {
	Messages []ChatMessage `json:"messages"`
	Count    int            `json:"count"`
}

// Get Conversations With Undelivered Count Response
type GetConversationsWithUndeliveredCountResponse struct {
	Count int `json:"count"`
}

// Error Response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

