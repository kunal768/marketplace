package ws

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"sync/atomic"
	"time"

	"github.com/gobwas/ws/wsutil"
	"github.com/kunal768/cmpe202/events-server/internal/auth"
	"github.com/kunal768/cmpe202/events-server/internal/message"
	"github.com/kunal768/cmpe202/events-server/internal/presence"
)

type Client struct {
	ID       string
	conn     net.Conn
	Hub      *Hub
	Presence presence.PresenceStore
	Auth     auth.AuthClient
	Messages *message.MessageService

	lastBeat  atomic.Int64 // unix seconds
	deadAfter time.Duration
}

func NewClient(conn net.Conn, hub *Hub, store presence.PresenceStore, authc auth.AuthClient, msgService *message.MessageService, deadAfterSec int) *Client {
	return &Client{conn: conn, Hub: hub, Presence: store, Auth: authc, Messages: msgService, deadAfter: time.Duration(deadAfterSec) * time.Second}
}

func (c *Client) Close(ctx context.Context) {
	if c.ID != "" {
		_ = c.Presence.SetOffline(ctx, c.ID)
		c.Hub.Unregister(c.ID)
	}
	_ = c.conn.Close()
}

func (c *Client) Serve(ctx context.Context) {
	defer c.Close(ctx)

	// 1) Authenticate first message within 5s
	_ = c.conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	msg, _, err := wsutil.ReadClientData(c.conn)
	if err != nil {
		return
	}
	msgType, payload, err := ParseMessage(msg)
	if err != nil || msgType != "auth" {
		return
	}
	authMsg := payload.(AuthMessage)
	if authMsg.UserID == "" || authMsg.Token == "" {
		return
	}

	if err := c.Auth.Verify(ctx, authMsg.UserID, authMsg.Token); err != nil {
		log.Printf("auth failed for user %s: %v", authMsg.UserID, err)
		return
	}

	c.ID = authMsg.UserID
	c.Hub.Register(c)
	_ = c.Presence.SetOnline(ctx, c.ID)
	c.lastBeat.Store(time.Now().Unix())
	_ = c.conn.SetReadDeadline(time.Time{}) // clear deadline

	// Start watchdog
	go c.watchdog(ctx)

	for {
		b, _, err := wsutil.ReadClientData(c.conn)
		if err != nil {
			log.Printf("ws read error %s: %v", c.ID, err)
			return
		}
		kind, payload, err := ParseMessage(b)
		if err != nil {
			log.Printf("Failed to parse message from %s: %v", c.ID, err)
			return
		}
		switch kind {
		case "presence":
			c.lastBeat.Store(time.Now().Unix())
			_ = c.Presence.Refresh(ctx, c.ID)
		case "chat":
			chatMsg := payload.(ChatMessage)
			// Enqueue chat message (fire-and-forget)
			if err := c.Messages.EnqueueChatMessage(ctx, c.ID, chatMsg.RecipientID, chatMsg.Msg); err != nil {
				log.Printf("Failed to enqueue chat message from %s: %v", c.ID, err)
				// Continue serving client even if message queuing fails
			}
		default:
			log.Printf("Unknown message type from %s: %s", c.ID, kind)
		}
	}
}

func (c *Client) watchdog(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		last := time.Unix(c.lastBeat.Load(), 0)
		if time.Since(last) > c.deadAfter {
			c.Close(ctx)
			return
		}
	}
}

// SendMessage sends a message to the client over websocket
func (c *Client) SendMessage(msg []byte) error {
	// Parse the message to create a proper websocket message
	var messageData struct {
		MessageID   string    `json:"messageId"`
		SenderID    string    `json:"senderId"`
		RecipientID string    `json:"recipientId"`
		Content     string    `json:"content"`
		Timestamp   time.Time `json:"timestamp"`
		Type        string    `json:"type"`
	}

	if err := json.Unmarshal(msg, &messageData); err != nil {
		return fmt.Errorf("failed to unmarshal message: %w", err)
	}

	// Create websocket message format
	wsMessage := map[string]interface{}{
		"type": "message",
		"data": messageData,
	}

	wsData, err := json.Marshal(wsMessage)
	if err != nil {
		return fmt.Errorf("failed to marshal websocket message: %w", err)
	}

	// Send the message
	if err := wsutil.WriteServerText(c.conn, wsData); err != nil {
		return fmt.Errorf("failed to write websocket message: %w", err)
	}

	log.Printf("Message sent to user %s: %s", c.ID, messageData.Content)
	return nil
}
