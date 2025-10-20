package message

import (
	"log"
	"time"

	"github.com/google/uuid"
)

// ChatMessage represents a chat message to be queued
type ChatMessage struct {
	MessageID   string    `json:"messageId"`   // UUID for idempotency
	SenderID    string    `json:"senderId"`    // authenticated user
	RecipientID string    `json:"recipientId"` // target user
	Content     string    `json:"content"`     // message text
	Timestamp   time.Time `json:"timestamp"`   // server timestamp
	Type        string    `json:"type"`        // "text" (extensible for images/files)
}

// NewChatMessage creates a new ChatMessage with server-generated fields
func NewChatMessage(senderID, recipientID, content string) *ChatMessage {
	messageID, err := generateMessageID()
	if err != nil {
		// log error
		log.Println("Failed to generate message ID:", err)
		return nil
	}
	return &ChatMessage{
		MessageID:   messageID,
		SenderID:    senderID,
		RecipientID: recipientID,
		Content:     content,
		Timestamp:   time.Now().UTC(),
		Type:        "text",
	}
}

func generateMessageID() (string, error) {
	id, err := uuid.NewRandom()
	if err != nil {
		// log error
		log.Println("Failed to generate message ID:", err)
		return "", err
	}
	return id.String(), nil
}
