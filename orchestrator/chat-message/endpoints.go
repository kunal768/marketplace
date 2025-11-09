package chatmessage

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

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

// GetUndeliveredMessagesHandler handles getting undelivered messages for the authenticated user
func (e *Endpoints) GetUndeliveredMessagesHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context (set by AuthMiddleware)
	userID, ok := r.Context().Value(httplib.ContextKey("userId")).(string)
	if !ok {
		httplib.WriteJSON(w, http.StatusUnauthorized, ErrorResponse{
			Error:   "Unauthorized",
			Message: "User ID not found in context",
		})
		return
	}

	// Call service to fetch undelivered messages
	messages, err := e.service.FetchUndeliveredMessages(r.Context(), userID)
	if err != nil {
		// If mongo client is not configured, return empty array instead of error
		if err.Error() == "mongo client not configured" {
			httplib.WriteJSON(w, http.StatusOK, GetUndeliveredMessagesResponse{
				Messages: []map[string]interface{}{},
				Count:    0,
			})
			return
		}
		httplib.WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to fetch undelivered messages",
			Message: err.Error(),
		})
		return
	}

	response := GetUndeliveredMessagesResponse{
		Messages: messages,
		Count:    len(messages),
	}

	httplib.WriteJSON(w, http.StatusOK, response)
}

// FetchAndRepublishUndeliveredMessagesHandler handles fetching and republishing undelivered messages
// This is called by events-server AFTER user is marked as online in Redis
// It fetches undelivered messages from MongoDB and republishes them to RabbitMQ queue
func (e *Endpoints) FetchAndRepublishUndeliveredMessagesHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context (set by AuthMiddleware)
	userID, ok := r.Context().Value(httplib.ContextKey("userId")).(string)
	if !ok {
		httplib.WriteJSON(w, http.StatusUnauthorized, ErrorResponse{
			Error:   "Unauthorized",
			Message: "User ID not found in context",
		})
		return
	}

	// Use background context with timeout for the operation
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Fetch undelivered messages (this also republishes them to queue)
	msgs, err := e.service.FetchUndeliveredMessages(ctx, userID)
	if err != nil {
		// If mongo client is not configured, return success with count 0
		if err.Error() == "mongo client not configured" {
			httplib.WriteJSON(w, http.StatusOK, FetchAndRepublishUndeliveredMessagesResponse{
				Message: "No undelivered messages (MongoDB not configured)",
				Count:   0,
			})
			return
		}
		httplib.WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to fetch undelivered messages",
			Message: err.Error(),
		})
		return
	}

	// Messages are already republished to queue by FetchUndeliveredMessages if publisher is configured
	log.Printf("Fetched %d undelivered messages for user %s, republished to queue", len(msgs), userID)

	response := FetchAndRepublishUndeliveredMessagesResponse{
		Message: fmt.Sprintf("Fetched and republished %d undelivered messages", len(msgs)),
		Count:   len(msgs),
	}

	httplib.WriteJSON(w, http.StatusOK, response)
}

// GetConversationsHandler handles getting all conversations for the authenticated user
func (e *Endpoints) GetConversationsHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context (set by AuthMiddleware)
	userID, ok := r.Context().Value(httplib.ContextKey("userId")).(string)
	if !ok {
		httplib.WriteJSON(w, http.StatusUnauthorized, ErrorResponse{
			Error:   "Unauthorized",
			Message: "User ID not found in context",
		})
		return
	}

	// Call service to get conversations
	conversations, err := e.service.GetConversations(r.Context(), userID)
	if err != nil {
		if err.Error() == "mongo client not configured" {
			httplib.WriteJSON(w, http.StatusOK, GetConversationsResponse{
				Conversations: []Conversation{},
				Total:         0,
			})
			return
		}
		httplib.WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to fetch conversations",
			Message: err.Error(),
		})
		return
	}

	response := GetConversationsResponse{
		Conversations: conversations,
		Total:         len(conversations),
	}

	httplib.WriteJSON(w, http.StatusOK, response)
}

// GetMessagesHandler handles getting all messages between the authenticated user and another user
func (e *Endpoints) GetMessagesHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context (set by AuthMiddleware)
	userID, ok := r.Context().Value(httplib.ContextKey("userId")).(string)
	if !ok {
		httplib.WriteJSON(w, http.StatusUnauthorized, ErrorResponse{
			Error:   "Unauthorized",
			Message: "User ID not found in context",
		})
		return
	}

	// Get other user ID from URL path
	// Path should be /api/chat/messages/{otherUserId}
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) < 5 {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "Other user ID is required",
		})
		return
	}
	otherUserID := parts[len(parts)-1]

	if otherUserID == "" {
		httplib.WriteJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "Other user ID is required",
		})
		return
	}

	// Call service to get messages
	messages, err := e.service.GetMessages(r.Context(), userID, otherUserID)
	if err != nil {
		if err.Error() == "mongo client not configured" {
			httplib.WriteJSON(w, http.StatusOK, GetMessagesResponse{
				Messages: []ChatMessage{},
				Count:    0,
			})
			return
		}
		httplib.WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to fetch messages",
			Message: err.Error(),
		})
		return
	}

	response := GetMessagesResponse{
		Messages: messages,
		Count:    len(messages),
	}

	httplib.WriteJSON(w, http.StatusOK, response)
}

// GetConversationsWithUndeliveredCountHandler handles getting the count of conversations with undelivered messages
func (e *Endpoints) GetConversationsWithUndeliveredCountHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context (set by AuthMiddleware)
	userID, ok := r.Context().Value(httplib.ContextKey("userId")).(string)
	if !ok {
		httplib.WriteJSON(w, http.StatusUnauthorized, ErrorResponse{
			Error:   "Unauthorized",
			Message: "User ID not found in context",
		})
		return
	}

	// Call service to get count
	count, err := e.service.GetConversationsWithUndeliveredCount(r.Context(), userID)
	if err != nil {
		if err.Error() == "mongo client not configured" {
			httplib.WriteJSON(w, http.StatusOK, GetConversationsWithUndeliveredCountResponse{
				Count: 0,
			})
			return
		}
		httplib.WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to fetch conversations with undelivered count",
			Message: err.Error(),
		})
		return
	}

	response := GetConversationsWithUndeliveredCountResponse{
		Count: count,
	}

	httplib.WriteJSON(w, http.StatusOK, response)
}

// RegisterRoutes registers all chat routes with proper middleware
func (e *Endpoints) RegisterRoutes(mux *http.ServeMux, dbPool *pgxpool.Pool) {
	// Undelivered messages endpoint (requires auth but not role injection)
	mux.Handle("GET /api/chat/undelivered-messages", httplib.AuthMiddleWare(http.HandlerFunc(e.GetUndeliveredMessagesHandler)))

	// Fetch and republish undelivered messages endpoint (requires auth but not role injection)
	mux.Handle("POST /api/chat/fetch-undelivered", httplib.AuthMiddleWare(http.HandlerFunc(e.FetchAndRepublishUndeliveredMessagesHandler)))

	// Get conversations endpoint (requires auth but not role injection)
	mux.Handle("GET /api/chat/conversations", httplib.AuthMiddleWare(http.HandlerFunc(e.GetConversationsHandler)))

	// Get messages endpoint (requires auth but not role injection)
	mux.Handle("GET /api/chat/messages/", httplib.AuthMiddleWare(http.HandlerFunc(e.GetMessagesHandler)))

	// Get conversations with undelivered count endpoint (requires auth but not role injection)
	mux.Handle("GET /api/chat/conversations-with-undelivered-count", httplib.AuthMiddleWare(http.HandlerFunc(e.GetConversationsWithUndeliveredCountHandler)))
}

