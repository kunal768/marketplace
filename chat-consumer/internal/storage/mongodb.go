package storage

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/kunal768/cmpe202/chat-consumer/internal/models"
)

// MessageRepository defines the interface for message persistence
type MessageRepository interface {
	SaveMessage(ctx context.Context, msg *models.ChatMessage) error
	UpdateMessageStatus(ctx context.Context, messageID string, status models.MessageStatus) error
	GetMessageByID(ctx context.Context, messageID string) (*models.ChatMessage, error)
	GetUndeliveredCount(ctx context.Context, recipientID string) (int, error)
	GetConversationsWithUndeliveredCount(ctx context.Context, recipientID string) (int, error)
	Close() error
}

// MongoMessageRepository implements MessageRepository using MongoDB
type MongoMessageRepository struct {
	client     *mongo.Client
	database   *mongo.Database
	collection *mongo.Collection
}

// NewMongoMessageRepository creates a new MongoDB message repository
func NewMongoMessageRepository(mongoURI string) (*MongoMessageRepository, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// Test the connection
	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	database := client.Database("chatdb")
	collection := database.Collection("chatmessages")

	// Create indexes for better performance
	indexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "messageId", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: bson.D{{Key: "recipientId", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "status", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "timestamp", Value: -1}},
		},
	}

	_, err = collection.Indexes().CreateMany(ctx, indexes)
	if err != nil {
		log.Printf("Warning: Failed to create indexes: %v", err)
	}

	log.Println("Connected to MongoDB successfully")
	return &MongoMessageRepository{
		client:     client,
		database:   database,
		collection: collection,
	}, nil
}

// SaveMessage saves or updates a message in MongoDB
func (r *MongoMessageRepository) SaveMessage(ctx context.Context, msg *models.ChatMessage) error {
	// Use upsert to handle both insert and update cases
	filter := bson.M{"messageId": msg.MessageID}
	update := bson.M{
		"$set": bson.M{
			"messageId":   msg.MessageID,
			"senderId":    msg.SenderID,
			"recipientId": msg.RecipientID,
			"content":     msg.Content,
			"timestamp":   msg.Timestamp,
			"type":        msg.Type,
			"status":      msg.Status,
			"updatedAt":   msg.UpdatedAt,
		},
		"$setOnInsert": bson.M{
			"createdAt": msg.CreatedAt,
		},
	}

	opts := options.Update().SetUpsert(true)
	result, err := r.collection.UpdateOne(ctx, filter, update, opts)
	if err != nil {
		return fmt.Errorf("failed to save message: %w", err)
	}

	if result.UpsertedID != nil {
		log.Printf("Inserted new message with ID: %s", msg.MessageID)
	} else {
		log.Printf("Updated existing message with ID: %s", msg.MessageID)
	}

	return nil
}

// UpdateMessageStatus updates the status of a message by messageID
func (r *MongoMessageRepository) UpdateMessageStatus(ctx context.Context, messageID string, status models.MessageStatus) error {
	filter := bson.M{"messageId": messageID}
	update := bson.M{
		"$set": bson.M{
			"status":    status,
			"updatedAt": time.Now().UTC(),
		},
	}

	result, err := r.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to update message status: %w", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("message with ID %s not found", messageID)
	}

	log.Printf("Updated message %s status to %s", messageID, status)
	return nil
}

// GetMessageByID retrieves a message by its messageID
func (r *MongoMessageRepository) GetMessageByID(ctx context.Context, messageID string) (*models.ChatMessage, error) {
	filter := bson.M{"messageId": messageID}
	var msg models.ChatMessage
	err := r.collection.FindOne(ctx, filter).Decode(&msg)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil // Message not found, return nil
		}
		return nil, fmt.Errorf("failed to get message: %w", err)
	}
	return &msg, nil
}

// GetUndeliveredCount returns the count of undelivered messages for a recipient
func (r *MongoMessageRepository) GetUndeliveredCount(ctx context.Context, recipientID string) (int, error) {
	filter := bson.M{
		"recipientId": recipientID,
		"status":      models.StatusUndelivered,
	}
	count, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return 0, fmt.Errorf("failed to count undelivered messages: %w", err)
	}
	return int(count), nil
}

// GetConversationsWithUndeliveredCount returns the count of distinct conversations (users) with undelivered messages
func (r *MongoMessageRepository) GetConversationsWithUndeliveredCount(ctx context.Context, recipientID string) (int, error) {
	filter := bson.M{
		"recipientId": recipientID,
		"status":      models.StatusUndelivered,
	}

	// Use distinct to get unique sender IDs
	senderIDs, err := r.collection.Distinct(ctx, "senderId", filter)
	if err != nil {
		return 0, fmt.Errorf("failed to get distinct senders: %w", err)
	}

	return len(senderIDs), nil
}

// Close closes the MongoDB connection
func (r *MongoMessageRepository) Close() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := r.client.Disconnect(ctx); err != nil {
		return fmt.Errorf("failed to disconnect from MongoDB: %w", err)
	}

	log.Println("MongoDB connection closed")
	return nil
}
