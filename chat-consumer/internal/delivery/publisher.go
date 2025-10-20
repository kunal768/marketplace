package delivery

import (
	"context"
	"fmt"
	"log"

	"github.com/redis/go-redis/v9"
)

// MessagePublisher defines the interface for publishing messages
type MessagePublisher interface {
	PublishToUser(ctx context.Context, userID string, message []byte) error
	Close() error
}

// RedisMessagePublisher implements MessagePublisher using Redis pub/sub
type RedisMessagePublisher struct {
	client *redis.Client
}

// NewRedisMessagePublisher creates a new Redis message publisher
func NewRedisMessagePublisher(addr, password string, db int) *RedisMessagePublisher {
	return &RedisMessagePublisher{
		client: redis.NewClient(&redis.Options{
			Addr:     addr,
			Password: password,
			DB:       db,
		}),
	}
}

// PublishToUser publishes a message to a specific user's channel
func (r *RedisMessagePublisher) PublishToUser(ctx context.Context, userID string, message []byte) error {
	channel := fmt.Sprintf("user:%s:messages", userID)

	result := r.client.Publish(ctx, channel, message)
	if result.Err() != nil {
		return fmt.Errorf("failed to publish message to user %s: %w", userID, result.Err())
	}

	subscribers := result.Val()
	log.Printf("Published message to user %s on channel %s (subscribers: %d)", userID, channel, subscribers)

	// If no subscribers, the user is not online
	if subscribers == 0 {
		log.Printf("No subscribers for user %s - user may be offline", userID)
	}

	return nil
}

// Close closes the Redis client
func (r *RedisMessagePublisher) Close() error {
	if err := r.client.Close(); err != nil {
		return fmt.Errorf("failed to close Redis client: %w", err)
	}
	log.Println("Redis message publisher closed")
	return nil
}
