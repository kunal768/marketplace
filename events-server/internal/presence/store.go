package presence

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type PresenceStore interface {
	SetOnline(ctx context.Context, userID string) error
	SetOffline(ctx context.Context, userID string) error
	Refresh(ctx context.Context, userID string) error
}

type RedisPresenceStore struct {
	Client *redis.Client
	TTL    time.Duration
}

func NewRedisPresenceStore(addr, password string, db int, ttlSeconds int) *RedisPresenceStore {
	return &RedisPresenceStore{
		Client: redis.NewClient(&redis.Options{Addr: addr, Password: password, DB: db}),
		TTL:    time.Duration(ttlSeconds) * time.Second,
	}
}

func (r *RedisPresenceStore) key(userID string) string { return fmt.Sprintf("presence:%s", userID) }

func (r *RedisPresenceStore) SetOnline(ctx context.Context, userID string) error {
	return r.Client.Set(ctx, r.key(userID), "ONLINE", r.TTL).Err()
}

func (r *RedisPresenceStore) Refresh(ctx context.Context, userID string) error {
	return r.Client.Expire(ctx, r.key(userID), r.TTL).Err()
}

func (r *RedisPresenceStore) SetOffline(ctx context.Context, userID string) error {
	return r.Client.Del(ctx, r.key(userID)).Err()
}
