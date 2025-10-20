package presence

import (
	"context"
	"fmt"
	"log"

	"github.com/redis/go-redis/v9"
)

// PresenceChecker defines the interface for checking user presence
type PresenceChecker interface {
	IsOnline(ctx context.Context, userID string) (bool, error)
	Close() error
}

// RedisPresenceChecker implements PresenceChecker using Redis
type RedisPresenceChecker struct {
	client *redis.Client
}

// NewRedisPresenceChecker creates a new Redis presence checker
func NewRedisPresenceChecker(addr, password string, db int) *RedisPresenceChecker {
	return &RedisPresenceChecker{
		client: redis.NewClient(&redis.Options{
			Addr:     addr,
			Password: password,
			DB:       db,
		}),
	}
}

// IsOnline checks if a user is currently online by checking Redis presence key
func (r *RedisPresenceChecker) IsOnline(ctx context.Context, userID string) (bool, error) {
	key := fmt.Sprintf("presence:%s", userID)

	result := r.client.Get(ctx, key)
	if result.Err() != nil {
		if result.Err() == redis.Nil {
			// Key doesn't exist, user is offline
			return false, nil
		}
		return false, fmt.Errorf("failed to check presence for user %s: %w", userID, result.Err())
	}

	// Key exists, user is online
	value, err := result.Result()
	if err != nil {
		return false, fmt.Errorf("failed to get presence value for user %s: %w", userID, err)
	}

	// Check if the value indicates online status
	isOnline := value == "ONLINE"

	if isOnline {
		log.Printf("User %s is online", userID)
	} else {
		log.Printf("User %s is offline (value: %s)", userID, value)
	}

	return isOnline, nil
}

// Close closes the Redis client
func (r *RedisPresenceChecker) Close() error {
	if err := r.client.Close(); err != nil {
		return fmt.Errorf("failed to close Redis client: %w", err)
	}
	log.Println("Redis presence checker closed")
	return nil
}
