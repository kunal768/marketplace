package models

import (
	"log"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// MessageStatus represents the delivery status of a message
type MessageStatus string

const (
	StatusSent        MessageStatus = "SENT"
	StatusDelivered   MessageStatus = "DELIVERED"
	StatusUndelivered MessageStatus = "UNDELIVERED"
)

// ChatMessage represents a chat message with delivery status
type ChatMessage struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	MessageID   string             `bson:"messageId" json:"messageId"`     // UUID for idempotency
	SenderID    string             `bson:"senderId" json:"senderId"`       // authenticated user
	RecipientID string             `bson:"recipientId" json:"recipientId"` // target user
	Content     string             `bson:"content" json:"content"`         // message text
	Timestamp   time.Time          `bson:"timestamp" json:"timestamp"`     // server timestamp
	Type        string             `bson:"type" json:"type"`               // "text" (extensible for images/files)
	Status      MessageStatus      `bson:"status" json:"status"`           // delivery status
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`     // when message was first created
	UpdatedAt   time.Time          `bson:"updatedAt" json:"updatedAt"`     // when status was last updated
}

// NewChatMessage creates a new ChatMessage with server-generated fields
func NewChatMessage(senderID, recipientID, content string) *ChatMessage {
	now := time.Now().UTC()
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
		Timestamp:   now,
		Type:        "text",
		Status:      StatusSent,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// UpdateStatus updates the message status and timestamp
func (m *ChatMessage) UpdateStatus(status MessageStatus) {
	m.Status = status
	m.UpdatedAt = time.Now().UTC()
}

// generateMessageID generates a unique message ID
// In production, this should use a proper UUID library
func generateMessageID() (string, error) {
	id, err := uuid.NewRandom()
	if err != nil {
		// log error
		log.Println("Failed to generate message ID:", err)
		return "", err
	}
	return id.String(), nil
}
