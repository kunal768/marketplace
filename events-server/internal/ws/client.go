package ws

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
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

	lastBeat           atomic.Int64 // unix seconds
	deadAfter          time.Duration
	undeliveredFetched bool // Track if we've already fetched undelivered messages for this connection
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

	// 1) Authenticate first message within 15s (increased for Safari compatibility)
	_ = c.conn.SetReadDeadline(time.Now().Add(15 * time.Second))
	msg, _, err := wsutil.ReadClientData(c.conn)
	if err != nil {
		log.Printf("Failed to read auth message: %v", err)
		// Send auth failure acknowledgment
		c.sendAuthAck("failed", "", fmt.Sprintf("Failed to read message: %v", err))
		return
	}
	msgType, payload, err := ParseMessage(msg)
	if err != nil || msgType != "auth" {
		log.Printf("Invalid auth message: type=%s, err=%v", msgType, err)
		// Send auth failure acknowledgment
		c.sendAuthAck("failed", "", "Invalid auth message format")
		return
	}
	authMsg := payload.(AuthMessage)
	if authMsg.UserID == "" || authMsg.Token == "" {
		log.Printf("Missing auth credentials: userId=%s, tokenPresent=%v", authMsg.UserID, authMsg.Token != "")
		// Send auth failure acknowledgment
		c.sendAuthAck("failed", "", "Missing userId or token")
		return
	}

	// Verify authentication with orchestrator
	if err := c.Auth.Verify(ctx, authMsg.UserID, authMsg.Token); err != nil {
		log.Printf("auth failed for user %s: %v", authMsg.UserID, err)
		// Send auth failure acknowledgment before closing
		c.sendAuthAck("failed", authMsg.UserID, err.Error())
		return
	}

	// Authentication successful - send ack FIRST before any other operations
	c.ID = authMsg.UserID
	c.lastBeat.Store(time.Now().Unix())
	_ = c.conn.SetReadDeadline(time.Time{}) // clear deadline

	// Send auth success acknowledgment IMMEDIATELY after verification
	// This ensures the client receives it before any potential errors in registration
	c.sendAuthAck("success", c.ID, "")
	log.Printf("User %s authenticated, sending auth_ack", c.ID)

	// Now register with hub and set presence (these might take time or error)
	// Hub.Register now waits for subscription confirmation before returning
	registerStart := time.Now()
	log.Printf("[TIMING] [%s] Starting Hub.Register at %v", c.ID, registerStart)
	c.Hub.Register(c)
	registerDuration := time.Since(registerStart)
	log.Printf("[TIMING] [%s] Hub.Register completed in %v", c.ID, registerDuration)

	setOnlineStart := time.Now()
	log.Printf("[TIMING] [%s] Starting SetOnline at %v", c.ID, setOnlineStart)
	if err := c.Presence.SetOnline(ctx, c.ID); err != nil {
		log.Printf("[TIMING] [%s] Failed to set user %s online: %v (took %v)", c.ID, c.ID, err, time.Since(setOnlineStart))
	} else {
		setOnlineDuration := time.Since(setOnlineStart)
		log.Printf("[TIMING] [%s] SetOnline completed successfully in %v", c.ID, setOnlineDuration)
		log.Printf("User %s registered and connected (marked online in Redis, subscription confirmed)", c.ID)
		// Trigger undelivered messages fetch now that user is online and subscription is confirmed
		// This runs in background and doesn't block the connection
		fetchStart := time.Now()
		log.Printf("[TIMING] [%s] Starting triggerUndeliveredMessagesFetch at %v (after SetOnline completed)", c.ID, fetchStart)
		go func() {
			c.triggerUndeliveredMessagesFetch(ctx, authMsg.Token)
		}()
	}

	// Start watchdog
	go c.watchdog(ctx)

	for {
		b, _, err := wsutil.ReadClientData(c.conn)
		if err != nil {
			log.Printf("ws read error %s: %v", c.ID, err)
			return
		}
		// Update lastBeat immediately when ANY message is received
		// This indicates the connection is alive, regardless of message type
		c.lastBeat.Store(time.Now().Unix())

		kind, payload, err := ParseMessage(b)
		if err != nil {
			log.Printf("Failed to parse message from %s: %v", c.ID, err)
			return
		}
		switch kind {
		case "presence":
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
		timeSinceLastBeat := time.Since(last)
		if timeSinceLastBeat > c.deadAfter {
			log.Printf("Watchdog closing connection for user %s: no activity for %v (deadAfter: %v)", c.ID, timeSinceLastBeat, c.deadAfter)
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

	log.Printf("[TIMING] [%s] Message %s sent to user %s via WebSocket at %v: %s", c.ID, messageData.MessageID, c.ID, time.Now(), messageData.Content)
	return nil
}

// sendAuthAck sends an authentication acknowledgment message to the client
func (c *Client) sendAuthAck(status, userID, errorMsg string) {
	ack := AuthAckMessage{
		Type:   "auth_ack",
		Status: status,
	}
	if status == "success" {
		ack.UserID = userID
	} else {
		ack.Error = errorMsg
	}

	ackData, err := json.Marshal(ack)
	if err != nil {
		log.Printf("Failed to marshal auth_ack: %v", err)
		return
	}

	if err := wsutil.WriteServerText(c.conn, ackData); err != nil {
		log.Printf("Failed to send auth_ack: %v", err)
	}
}

// SendNotification sends a notification message to the client over websocket
func (c *Client) SendNotification(notification NotificationMessage) error {
	notifData, err := json.Marshal(notification)
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %w", err)
	}

	if err := wsutil.WriteServerText(c.conn, notifData); err != nil {
		return fmt.Errorf("failed to write notification: %w", err)
	}

	log.Printf("Notification sent to user %s: %s (count: %d)", c.ID, notification.SubType, notification.Count)
	return nil
}

// triggerUndeliveredMessagesFetch calls orchestrator to fetch and republish undelivered messages
// This is called after user is marked as online in Redis and subscription is confirmed
// It only runs once per connection (tracked by undeliveredFetched flag)
func (c *Client) triggerUndeliveredMessagesFetch(ctx context.Context, token string) {
	// Check if we've already fetched for this connection
	if c.undeliveredFetched {
		log.Printf("[Client] Skipping undelivered messages fetch for user %s - already fetched for this connection", c.ID)
		return
	}

	log.Printf("[TIMING] [%s] Triggering undelivered messages fetch for user %s (subscription confirmed, user online) at %v", c.ID, c.ID, time.Now())

	// Get orchestrator URL from auth client
	orchestratorURL := c.Auth.GetBaseURL()
	if orchestratorURL == "" {
		log.Printf("[TIMING] [%s] Cannot fetch undelivered messages: orchestrator URL not configured", c.ID)
		return
	}

	// Create a new context with timeout for the HTTP request
	reqCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Call dedicated endpoint for fetching and republishing undelivered messages
	url := fmt.Sprintf("%s/api/chat/fetch-undelivered", orchestratorURL)
	httpStart := time.Now()
	log.Printf("[TIMING] [%s] Calling orchestrator endpoint: %s at %v", c.ID, url, httpStart)

	req, err := http.NewRequestWithContext(reqCtx, "POST", url, nil)
	if err != nil {
		log.Printf("[Client] Failed to create undelivered messages fetch request: %v", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	httpDuration := time.Since(httpStart)
	if err != nil {
		log.Printf("[TIMING] [%s] Failed to trigger undelivered messages fetch for user %s: %v (HTTP call took %v)", c.ID, c.ID, err, httpDuration)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("[TIMING] [%s] Orchestrator returned non-OK status when fetching undelivered messages for user %s: %d (HTTP call took %v)", c.ID, c.ID, resp.StatusCode, httpDuration)
		return
	}

	// Mark as fetched for this connection
	c.undeliveredFetched = true
	log.Printf("[TIMING] [%s] Successfully triggered undelivered messages fetch for user %s (one-time per connection, HTTP call took %v)", c.ID, c.ID, httpDuration)

	// Send initial notification with conversations count
	// This ensures the badge shows the correct count immediately on page load
	c.sendInitialNotification(ctx, token, orchestratorURL)
}

// sendInitialNotification fetches the conversations count and sends a notification to the client
func (c *Client) sendInitialNotification(ctx context.Context, token, orchestratorURL string) {
	// Fetch conversations with undelivered count
	url := fmt.Sprintf("%s/api/chat/conversations-with-undelivered-count", orchestratorURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		log.Printf("[Client] Failed to create conversations count request: %v", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[Client] Failed to fetch conversations count: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("[Client] Orchestrator returned non-OK status when fetching conversations count: %d", resp.StatusCode)
		return
	}

	var countResponse struct {
		Count int `json:"count"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&countResponse); err != nil {
		log.Printf("[Client] Failed to decode conversations count response: %v", err)
		return
	}

	// Send notification to client
	notification := NotificationMessage{
		Type:    "notification",
		SubType: "inbox",
		Count:   countResponse.Count,
	}
	if err := c.SendNotification(notification); err != nil {
		log.Printf("[Client] Failed to send initial notification: %v", err)
		return
	}

	log.Printf("[Client] Sent initial notification to user %s: %d conversations with undelivered messages", c.ID, countResponse.Count)
}
