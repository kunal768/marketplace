package delivery

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// MessageSubscriber handles Redis pub/sub for message delivery
type MessageSubscriber interface {
	Subscribe(ctx context.Context, userID string, messageHandler func([]byte) error) error
	Unsubscribe(ctx context.Context, userID string) error
	Close() error
}

// RedisMessageSubscriber implements MessageSubscriber using Redis pub/sub
type RedisMessageSubscriber struct {
	client   *redis.Client
	subs     map[string]*redis.PubSub
	mu       sync.RWMutex
	closed   bool
	stopChan chan struct{}
}

// NewRedisMessageSubscriber creates a new Redis message subscriber
func NewRedisMessageSubscriber(addr, password string, db int) *RedisMessageSubscriber {
	return &RedisMessageSubscriber{
		client: redis.NewClient(&redis.Options{
			Addr:     addr,
			Password: password,
			DB:       db,
		}),
		subs:     make(map[string]*redis.PubSub),
		stopChan: make(chan struct{}),
	}
}

// Subscribe starts listening to messages for a specific user
func (r *RedisMessageSubscriber) Subscribe(ctx context.Context, userID string, messageHandler func([]byte) error) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.closed {
		return fmt.Errorf("subscriber is closed")
	}

	// Check if already subscribed
	if _, exists := r.subs[userID]; exists {
		return fmt.Errorf("already subscribed to user %s", userID)
	}

	channel := fmt.Sprintf("user:%s:messages", userID)
	pubsub := r.client.Subscribe(ctx, channel)
	r.subs[userID] = pubsub

	// Start goroutine to handle messages
	go r.handleMessages(ctx, userID, pubsub, messageHandler)

	log.Printf("Subscribed to messages for user %s on channel %s", userID, channel)
	return nil
}

// Unsubscribe stops listening to messages for a specific user
func (r *RedisMessageSubscriber) Unsubscribe(ctx context.Context, userID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.closed {
		return nil
	}

	pubsub, exists := r.subs[userID]
	if !exists {
		return nil // Already unsubscribed
	}

	if err := pubsub.Close(); err != nil {
		log.Printf("Error closing subscription for user %s: %v", userID, err)
	}

	delete(r.subs, userID)
	log.Printf("Unsubscribed from messages for user %s", userID)
	return nil
}

// Close closes all subscriptions and the Redis client
func (r *RedisMessageSubscriber) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.closed {
		return nil
	}

	r.closed = true
	close(r.stopChan)

	// Close all subscriptions
	for userID, pubsub := range r.subs {
		if err := pubsub.Close(); err != nil {
			log.Printf("Error closing subscription for user %s: %v", userID, err)
		}
	}
	r.subs = make(map[string]*redis.PubSub)

	// Close Redis client
	if err := r.client.Close(); err != nil {
		return fmt.Errorf("failed to close Redis client: %w", err)
	}

	log.Println("Redis message subscriber closed")
	return nil
}

// handleMessages processes incoming messages from Redis pub/sub
func (r *RedisMessageSubscriber) handleMessages(ctx context.Context, userID string, pubsub *redis.PubSub, messageHandler func([]byte) error) {
	defer func() {
		if err := pubsub.Close(); err != nil {
			log.Printf("Error closing pubsub for user %s: %v", userID, err)
		}
	}()

	// Wait for subscription confirmation
	_, err := pubsub.Receive(ctx)
	if err != nil {
		log.Printf("Failed to receive subscription confirmation for user %s: %v", userID, err)
		return
	}

	// Channel to receive messages
	ch := pubsub.Channel()

	for {
		select {
		case <-r.stopChan:
			return
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				log.Printf("Message channel closed for user %s", userID)
				return
			}

			if msg == nil {
				continue
			}

			// Parse the message payload
			var messageData struct {
				MessageID   string    `json:"messageId"`
				SenderID    string    `json:"senderId"`
				RecipientID string    `json:"recipientId"`
				Content     string    `json:"content"`
				Timestamp   time.Time `json:"timestamp"`
				Type        string    `json:"type"`
			}

			if err := json.Unmarshal([]byte(msg.Payload), &messageData); err != nil {
				log.Printf("Failed to unmarshal message for user %s: %v", userID, err)
				continue
			}

			// Call the message handler
			if err := messageHandler([]byte(msg.Payload)); err != nil {
				log.Printf("Error handling message for user %s: %v", userID, err)
			}
		}
	}
}
