package chatmessage

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/kunal768/cmpe202/orchestrator/internal/queue"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type svc struct {
	mongoClient *mongo.Client
	publisher   queue.Publisher
}

type Service interface {
	FetchUndeliveredMessages(ctx context.Context, recipientID string) ([]map[string]interface{}, error)
	GetConversations(ctx context.Context, userID string) ([]Conversation, error)
	GetMessages(ctx context.Context, userID, otherUserID string) ([]ChatMessage, error)
	GetConversationsWithUndeliveredCount(ctx context.Context, userID string) (int, error)
}

func NewChatService(mongoClient *mongo.Client, publisher queue.Publisher) Service {
	return &svc{
		mongoClient: mongoClient,
		publisher:   publisher,
	}
}

// FetchUndeliveredMessages returns undelivered messages for a recipient using mongo client if available
func (s *svc) FetchUndeliveredMessages(ctx context.Context, recipientID string) ([]map[string]interface{}, error) {
	if s.mongoClient == nil {
		return nil, fmt.Errorf("mongo client not configured")
	}
	coll := s.mongoClient.Database("chatdb").Collection("chatmessages")
	filter := bson.M{"recipientId": recipientID, "status": "UNDELIVERED"}
	cur, err := coll.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var results []map[string]interface{}
	now := time.Now()
	// Skip messages that were updated within the last 2 seconds to prevent race conditions
	// This gives chat-consumer time to update status from UNDELIVERED to DELIVERED
	recentThreshold := now.Add(-2 * time.Second)
	for cur.Next(ctx) {
		var doc map[string]interface{}
		if err := cur.Decode(&doc); err != nil {
			continue
		}
		// Check if message was recently updated (might be in process of being delivered)
		// updatedAt can be stored as primitive.DateTime or time.Time depending on MongoDB driver version
		var updatedTime time.Time
		if updatedAt, ok := doc["updatedAt"].(primitive.DateTime); ok {
			updatedTime = updatedAt.Time()
		} else if updatedAt, ok := doc["updatedAt"].(time.Time); ok {
			updatedTime = updatedAt
		} else {
			// If we can't determine updatedAt, include the message (better to republish than skip)
			results = append(results, doc)
			continue
		}

		if updatedTime.After(recentThreshold) {
			// Skip recently updated messages to prevent republishing messages that are being processed
			fmt.Printf("[TIMING] [Orchestrator] Skipping message %v - updated %v ago (likely being processed by chat-consumer)\n", doc["messageId"], time.Since(updatedTime))
			continue
		}
		results = append(results, doc)
	}

	// Best-effort: republish undelivered messages to the queue if publisher is configured
	// Normalize message format to match what chat-consumer expects (not the full MongoDB document)
	if s.publisher != nil && len(results) > 0 {
		republishStart := time.Now()
		fmt.Printf("[TIMING] [Orchestrator] Starting republish of %d undelivered messages for recipient %s at %v\n", len(results), recipientID, republishStart)
		for i, m := range results {
			// Extract only the fields that chat-consumer expects
			// Remove MongoDB-specific fields like _id, status, createdAt, updatedAt
			messageForQueue := map[string]interface{}{
				"messageId":   m["messageId"],
				"senderId":    m["senderId"],
				"recipientId": m["recipientId"],
				"content":     m["content"],
				"timestamp":   m["timestamp"],
				"type":        m["type"],
			}

			msgStart := time.Now()
			b, err := json.Marshal(messageForQueue)
			if err != nil {
				// skip malformed document
				fmt.Printf("[TIMING] [Orchestrator] failed to marshal undelivered message %v for recipient %s: %v (took %v)\n", m["messageId"], recipientID, err, time.Since(msgStart))
				continue
			}
			// publish with context but do not fail the whole operation if publish fails
			publishStart := time.Now()
			if err := s.publisher.Publish(ctx, b); err != nil {
				// Log publish failure using fmt for minimal dependencies
				fmt.Printf("[TIMING] [Orchestrator] failed to publish undelivered message %v for recipient %s: %v (took %v)\n", m["messageId"], recipientID, err, time.Since(publishStart))
			} else {
				publishDuration := time.Since(publishStart)
				fmt.Printf("[TIMING] [Orchestrator] Republished undelivered message %v to queue for recipient %s (message %d/%d, took %v)\n", m["messageId"], recipientID, i+1, len(results), publishDuration)
			}
		}
		republishDuration := time.Since(republishStart)
		fmt.Printf("[TIMING] [Orchestrator] Completed republish of %d messages for recipient %s (total time: %v)\n", len(results), recipientID, republishDuration)
	}

	return results, nil
}

// GetConversations returns all conversations for a user, sorted by most recent message
func (s *svc) GetConversations(ctx context.Context, userID string) ([]Conversation, error) {
	if s.mongoClient == nil {
		return nil, fmt.Errorf("mongo client not configured")
	}

	coll := s.mongoClient.Database("chatdb").Collection("chatmessages")

	// Find all messages where user is either sender or recipient
	filter := bson.M{
		"$or": []bson.M{
			{"senderId": userID},
			{"recipientId": userID},
		},
	}

	// Sort by timestamp descending to get most recent first
	opts := options.Find().SetSort(bson.D{{Key: "timestamp", Value: -1}})
	cur, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to find messages: %w", err)
	}
	defer cur.Close(ctx)

	// Map to track conversations by other user ID
	conversationsMap := make(map[string]*Conversation)
	// Track all messages for counting unread later
	allMessages := make([]ChatMessage, 0)

	for cur.Next(ctx) {
		var msg ChatMessage
		if err := cur.Decode(&msg); err != nil {
			continue
		}
		allMessages = append(allMessages, msg)

		// Determine the other user ID
		var otherUserID string
		var isLastFromMe bool
		if msg.SenderID == userID {
			otherUserID = msg.RecipientID
			isLastFromMe = true
		} else {
			otherUserID = msg.SenderID
			isLastFromMe = false
		}

		// If we haven't seen this conversation yet, create it
		// Since messages are sorted by timestamp descending, first message we see is the most recent
		if _, exists := conversationsMap[otherUserID]; !exists {
			conversationsMap[otherUserID] = &Conversation{
				OtherUserID:   otherUserID,
				LastMessage:   msg.Content,
				LastTimestamp: msg.Timestamp,
				UnreadCount:   0, // Will be calculated below
				IsLastFromMe:  isLastFromMe,
			}
		}
	}

	// Count undelivered messages for each conversation
	for _, msg := range allMessages {
		var otherUserID string
		if msg.SenderID == userID {
			otherUserID = msg.RecipientID
		} else {
			otherUserID = msg.SenderID
		}

		if conv, exists := conversationsMap[otherUserID]; exists {
			if msg.RecipientID == userID && msg.Status == StatusUndelivered {
				conv.UnreadCount++
			}
		}
	}

	// Convert map to slice and sort by last timestamp
	conversations := make([]Conversation, 0, len(conversationsMap))
	for _, conv := range conversationsMap {
		conversations = append(conversations, *conv)
	}

	// Sort by last timestamp descending (most recent first)
	for i := 0; i < len(conversations)-1; i++ {
		for j := i + 1; j < len(conversations); j++ {
			if conversations[i].LastTimestamp.Before(conversations[j].LastTimestamp) {
				conversations[i], conversations[j] = conversations[j], conversations[i]
			}
		}
	}

	return conversations, nil
}

// GetMessages returns all messages between two users, sorted chronologically
func (s *svc) GetMessages(ctx context.Context, userID, otherUserID string) ([]ChatMessage, error) {
	if s.mongoClient == nil {
		return nil, fmt.Errorf("mongo client not configured")
	}

	coll := s.mongoClient.Database("chatdb").Collection("chatmessages")

	// Find messages where (userID is sender and otherUserID is recipient) OR (otherUserID is sender and userID is recipient)
	filter := bson.M{
		"$or": []bson.M{
			{"senderId": userID, "recipientId": otherUserID},
			{"senderId": otherUserID, "recipientId": userID},
		},
	}

	// Sort by timestamp ascending for chronological display
	opts := options.Find().SetSort(bson.D{{Key: "timestamp", Value: 1}})
	cur, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to find messages: %w", err)
	}
	defer cur.Close(ctx)

	var messages []ChatMessage
	for cur.Next(ctx) {
		var msg ChatMessage
		if err := cur.Decode(&msg); err != nil {
			continue
		}
		messages = append(messages, msg)
	}

	return messages, nil
}

// GetConversationsWithUndeliveredCount returns the count of distinct users who have undelivered messages for the current user
func (s *svc) GetConversationsWithUndeliveredCount(ctx context.Context, userID string) (int, error) {
	if s.mongoClient == nil {
		return 0, fmt.Errorf("mongo client not configured")
	}

	coll := s.mongoClient.Database("chatdb").Collection("chatmessages")

	// Find all undelivered messages for this user
	filter := bson.M{
		"recipientId": userID,
		"status":      StatusUndelivered,
	}

	// Use distinct to get unique sender IDs
	senderIDs, err := coll.Distinct(ctx, "senderId", filter)
	if err != nil {
		return 0, fmt.Errorf("failed to get distinct senders: %w", err)
	}

	return len(senderIDs), nil
}

