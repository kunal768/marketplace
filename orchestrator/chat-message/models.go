package chatmessage

import (
	"time"

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
	MessageID   string             `bson:"messageId" json:"messageId"`
	SenderID    string             `bson:"senderId" json:"senderId"`
	RecipientID string             `bson:"recipientId" json:"recipientId"`
	Content     string             `bson:"content" json:"content"`
	Timestamp   time.Time          `bson:"timestamp" json:"timestamp"`
	Type        string             `bson:"type" json:"type"`
	Status      MessageStatus      `bson:"status" json:"status"`
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// Conversation represents a conversation preview with another user
type Conversation struct {
	OtherUserID   string    `json:"otherUserId"`
	OtherUserName string    `json:"otherUserName,omitempty"`
	LastMessage   string    `json:"lastMessage"`
	LastTimestamp time.Time `json:"lastTimestamp"`
	UnreadCount   int       `json:"unreadCount"`
	IsLastFromMe  bool      `json:"isLastFromMe"` // true if last message was sent by current user
}

// ConversationSummary represents a summary of all conversations
type ConversationSummary struct {
	Conversations []Conversation `json:"conversations"`
	Total         int            `json:"total"`
}

