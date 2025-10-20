package ws

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"

	"github.com/kunal768/cmpe202/events-server/internal/delivery"
)

type Hub struct {
	mu         sync.RWMutex
	clients    map[string]*Client
	subscriber delivery.MessageSubscriber
}

func NewHub(subscriber delivery.MessageSubscriber) *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		subscriber: subscriber,
	}
}

func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	h.clients[c.ID] = c
	h.mu.Unlock()

	// Subscribe to messages for this user
	if h.subscriber != nil {
		if err := h.subscriber.Subscribe(context.Background(), c.ID, h.handleMessage); err != nil {
			log.Printf("Failed to subscribe to messages for user %s: %v", c.ID, err)
		}
	}
}

func (h *Hub) Unregister(userID string) {
	h.mu.Lock()
	delete(h.clients, userID)
	h.mu.Unlock()

	// Unsubscribe from messages for this user
	if h.subscriber != nil {
		if err := h.subscriber.Unsubscribe(context.Background(), userID); err != nil {
			log.Printf("Failed to unsubscribe from messages for user %s: %v", userID, err)
		}
	}
}

func (h *Hub) Get(userID string) (*Client, bool) {
	h.mu.RLock()
	c, ok := h.clients[userID]
	h.mu.RUnlock()
	return c, ok
}

// handleMessage processes incoming messages from Redis pub/sub
func (h *Hub) handleMessage(msg []byte) error {
	// Parse the message to get recipient ID
	var messageData struct {
		RecipientID string `json:"recipientId"`
	}

	if err := json.Unmarshal(msg, &messageData); err != nil {
		return fmt.Errorf("failed to unmarshal message: %w", err)
	}

	// Find the client
	client, exists := h.Get(messageData.RecipientID)
	if !exists {
		log.Printf("Client %s not found for message delivery", messageData.RecipientID)
		return nil // Not an error, client might have disconnected
	}

	// Send the message to the client
	return client.SendMessage(msg)
}
