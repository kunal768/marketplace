package message

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/kunal768/cmpe202/events-server/internal/queue"
)

// MessageService handles chat message business logic
// Following Single Responsibility Principle - handles only message processing
type MessageService struct {
	publisher queue.MessagePublisher
}

// NewMessageService creates a new MessageService
func NewMessageService(publisher queue.MessagePublisher) *MessageService {
	return &MessageService{
		publisher: publisher,
	}
}

// EnqueueChatMessage validates, enriches, and publishes a chat message
func (s *MessageService) EnqueueChatMessage(ctx context.Context, senderID, recipientID, content string) error {
	// Validate input
	if senderID == "" {
		return fmt.Errorf("senderID cannot be empty")
	}
	if recipientID == "" {
		return fmt.Errorf("recipientID cannot be empty")
	}
	if content == "" {
		return fmt.Errorf("content cannot be empty")
	}

	// Create chat message with server-generated fields
	chatMsg := NewChatMessage(senderID, recipientID, content)

	// Marshal to JSON
	messageBytes, err := json.Marshal(chatMsg)
	if err != nil {
		return fmt.Errorf("failed to marshal chat message: %w", err)
	}

	// Publish to queue (fire-and-forget pattern)
	if err := s.publisher.Publish(ctx, messageBytes); err != nil {
		// Log error but don't fail the operation (fire-and-forget)
		log.Printf("Failed to publish chat message from %s to %s: %v", senderID, recipientID, err)
		return fmt.Errorf("failed to queue message: %w", err)
	}

	log.Printf("Chat message queued: %s -> %s", senderID, recipientID)
	return nil
}

// Close gracefully closes the message service
func (s *MessageService) Close() error {
	if s.publisher != nil {
		return s.publisher.Close()
	}
	return nil
}
