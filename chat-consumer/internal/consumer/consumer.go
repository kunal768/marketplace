package consumer

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"

	"github.com/kunal768/cmpe202/chat-consumer/internal/delivery"
	"github.com/kunal768/cmpe202/chat-consumer/internal/models"
	"github.com/kunal768/cmpe202/chat-consumer/internal/presence"
	"github.com/kunal768/cmpe202/chat-consumer/internal/storage"
)

// MessageConsumer handles consuming messages from RabbitMQ
type MessageConsumer struct {
	conn                *amqp.Connection
	channel             *amqp.Channel
	queueName           string
	messageRepo         storage.MessageRepository
	presenceChecker     presence.PresenceChecker
	messagePublisher    delivery.MessagePublisher
	mu                  sync.RWMutex
	closed              bool
	notificationSent    map[string]time.Time // Track when we last sent notification for a user
	notificationSentMu  sync.RWMutex         // Mutex for notificationSent map
}

// NewMessageConsumer creates a new message consumer
func NewMessageConsumer(
	rabbitMQURL, queueName string,
	messageRepo storage.MessageRepository,
	presenceChecker presence.PresenceChecker,
	messagePublisher delivery.MessagePublisher,
) (*MessageConsumer, error) {
	conn, err := amqp.Dial(rabbitMQURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	channel, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to open channel: %w", err)
	}

	// Declare the queue to ensure it exists
	_, err = channel.QueueDeclare(
		queueName, // name
		true,      // durable
		false,     // delete when unused
		false,     // exclusive
		false,     // no-wait
		nil,       // arguments
	)
	if err != nil {
		channel.Close()
		conn.Close()
		return nil, fmt.Errorf("failed to declare queue: %w", err)
	}

	// Set QoS to process one message at a time
	err = channel.Qos(1, 0, false)
	if err != nil {
		channel.Close()
		conn.Close()
		return nil, fmt.Errorf("failed to set QoS: %w", err)
	}

	return &MessageConsumer{
		conn:             conn,
		channel:          channel,
		queueName:        queueName,
		messageRepo:      messageRepo,
		presenceChecker:  presenceChecker,
		messagePublisher: messagePublisher,
		notificationSent: make(map[string]time.Time), // Initialize map to prevent nil map panic
	}, nil
}

// Start begins consuming messages from the queue
func (c *MessageConsumer) Start(ctx context.Context) error {
	msgs, err := c.channel.Consume(
		c.queueName, // queue
		"",          // consumer
		false,       // auto-ack
		false,       // exclusive
		false,       // no-local
		false,       // no-wait
		nil,         // args
	)
	if err != nil {
		return fmt.Errorf("failed to register consumer: %w", err)
	}

	log.Printf("Started consuming messages from queue: %s", c.queueName)

	// Process messages in a goroutine
	go func() {
		for {
			select {
			case <-ctx.Done():
				log.Println("Consumer context cancelled, stopping...")
				return
			case msg, ok := <-msgs:
				if !ok {
					log.Println("Message channel closed")
					return
				}
				c.processMessage(ctx, msg)
			}
		}
	}()

	return nil
}

// processMessage processes a single message from the queue
func (c *MessageConsumer) processMessage(ctx context.Context, delivery amqp.Delivery) {
	// Create a context with timeout for message processing
	msgCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	log.Printf("Processing message: %s", delivery.MessageId)

	// Parse the incoming message
	var incomingMsg struct {
		MessageID   string    `json:"messageId"`
		SenderID    string    `json:"senderId"`
		RecipientID string    `json:"recipientId"`
		Content     string    `json:"content"`
		Timestamp   time.Time `json:"timestamp"`
		Type        string    `json:"type"`
	}

	if err := json.Unmarshal(delivery.Body, &incomingMsg); err != nil {
		log.Printf("Failed to unmarshal message: %v", err)
		c.ackMessage(delivery)
		return
	}

	// Check if message already exists in database (might be a republished undelivered message)
	existingMsg, err := c.messageRepo.GetMessageByID(msgCtx, incomingMsg.MessageID)
	if err != nil {
		log.Printf("Failed to check for existing message %s: %v", incomingMsg.MessageID, err)
	}

	// Determine initial status: if message exists and is UNDELIVERED, keep it as UNDELIVERED
	// Otherwise, set to SENT (new message)
	initialStatus := models.StatusSent
	wasUndelivered := false
	if existingMsg != nil {
		if existingMsg.Status == models.StatusUndelivered {
			initialStatus = models.StatusUndelivered
			wasUndelivered = true
			log.Printf("Message %s is a republished undelivered message", incomingMsg.MessageID)
		}
	}

	// Create ChatMessage with appropriate status
	chatMsg := &models.ChatMessage{
		MessageID:   incomingMsg.MessageID,
		SenderID:    incomingMsg.SenderID,
		RecipientID: incomingMsg.RecipientID,
		Content:     incomingMsg.Content,
		Timestamp:   incomingMsg.Timestamp,
		Type:        incomingMsg.Type,
		Status:      initialStatus,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	// If message exists, preserve its CreatedAt
	if existingMsg != nil {
		chatMsg.CreatedAt = existingMsg.CreatedAt
	}

	// Save message to MongoDB with appropriate status
	if err := c.messageRepo.SaveMessage(msgCtx, chatMsg); err != nil {
		log.Printf("Failed to save message to database: %v", err)
		c.nackMessage(delivery)
		return
	}

	log.Printf("[TIMING] [Consumer] Message %s saved with %s status at %v", chatMsg.MessageID, chatMsg.Status, time.Now())

	// Check if recipient is online
	presenceCheckStart := time.Now()
	log.Printf("[TIMING] [Consumer] Checking presence for user %s (message %s) at %v", chatMsg.RecipientID, chatMsg.MessageID, presenceCheckStart)
	isOnline, err := c.presenceChecker.IsOnline(msgCtx, chatMsg.RecipientID)
	presenceCheckDuration := time.Since(presenceCheckStart)
	if err != nil {
		log.Printf("[TIMING] [Consumer] Failed to check presence for user %s: %v (took %v)", chatMsg.RecipientID, err, presenceCheckDuration)
		// Mark as undelivered if we can't check presence
		chatMsg.UpdateStatus(models.StatusUndelivered)
		if saveErr := c.messageRepo.SaveMessage(msgCtx, chatMsg); saveErr != nil {
			log.Printf("[TIMING] [Consumer] ERROR: Failed to save UNDELIVERED status after presence check error for message %s: %v - message will be redelivered", chatMsg.MessageID, saveErr)
			c.nackMessage(delivery) // Don't ack if save fails
			return
		}
		c.ackMessage(delivery)
		return
	}

	log.Printf("[TIMING] [Consumer] Presence check result for user %s (message %s): isOnline=%v (took %v)", chatMsg.RecipientID, chatMsg.MessageID, isOnline, presenceCheckDuration)

	if isOnline {

		// User is online, try to deliver via Redis pub/sub
		marshalStart := time.Now()
		messageBytes, err := json.Marshal(incomingMsg)
		if err != nil {
			log.Printf("[TIMING] [Consumer] Failed to marshal message %s for delivery: %v (took %v)", chatMsg.MessageID, err, time.Since(marshalStart))
			chatMsg.UpdateStatus(models.StatusUndelivered)
			if saveErr := c.messageRepo.SaveMessage(msgCtx, chatMsg); saveErr != nil {
				log.Printf("[TIMING] [Consumer] ERROR: Failed to save UNDELIVERED status after marshal error for message %s: %v - message will be redelivered", chatMsg.MessageID, saveErr)
				c.nackMessage(delivery) // Don't ack if save fails
				return
			}
			c.ackMessage(delivery)
			return
		}
		marshalDuration := time.Since(marshalStart)
		log.Printf("[TIMING] [Consumer] Marshaled message %s for user %s (took %v)", chatMsg.MessageID, chatMsg.RecipientID, marshalDuration)

		// Publish to Redis channel and get subscriber count
		publishStart := time.Now()
		log.Printf("[TIMING] [Consumer] Publishing message %s to Redis channel for user %s at %v", chatMsg.MessageID, chatMsg.RecipientID, publishStart)
		subscribers, err := c.messagePublisher.PublishToUser(msgCtx, chatMsg.RecipientID, messageBytes)
		publishDuration := time.Since(publishStart)
		if err != nil {
			log.Printf("[TIMING] [Consumer] Failed to publish message %s to user %s: %v (took %v)", chatMsg.MessageID, chatMsg.RecipientID, err, publishDuration)
			chatMsg.UpdateStatus(models.StatusUndelivered)
			// Save status and ack even if publish failed (message will be retried if needed)
			if saveErr := c.messageRepo.SaveMessage(msgCtx, chatMsg); saveErr != nil {
				log.Printf("[TIMING] [Consumer] ERROR: Failed to save UNDELIVERED status for message %s: %v - message will be redelivered", chatMsg.MessageID, saveErr)
				c.nackMessage(delivery) // Don't ack if save fails
				return
			}
			c.ackMessage(delivery)
			return
		} else if subscribers > 0 {
			// Message published successfully and there was at least one subscriber
			// This means events-server is subscribed for this userId
			chatMsg.UpdateStatus(models.StatusDelivered)
			log.Printf("[TIMING] [Consumer] Message %s delivered to user %s (subscribers: %d, publish took %v)", chatMsg.MessageID, chatMsg.RecipientID, subscribers, publishDuration)

			// CRITICAL: Save status to DB BEFORE acking message
			// If save fails, do NOT ack - message will be redelivered and status will be updated correctly
			if saveErr := c.messageRepo.SaveMessage(msgCtx, chatMsg); saveErr != nil {
				log.Printf("[TIMING] [Consumer] ERROR: Failed to save DELIVERED status for message %s: %v - NOT acking message, will retry", chatMsg.MessageID, saveErr)
				c.nackMessage(delivery) // Don't ack if save fails - prevents loop
				return
			}
			log.Printf("[TIMING] [Consumer] Successfully saved DELIVERED status for message %s to database", chatMsg.MessageID)

			// If this was a previously undelivered message, send notification (only once per user per minute)
			if wasUndelivered {
				c.sendUndeliveredNotification(msgCtx, chatMsg.RecipientID)
			}
		} else {
			// No subscribers, mark as undelivered
			chatMsg.UpdateStatus(models.StatusUndelivered)
			log.Printf("[TIMING] [Consumer] Message %s published to user %s but NO SUBSCRIBERS (events-server not subscribed for this userId), marked as UNDELIVERED (publish took %v)", chatMsg.MessageID, chatMsg.RecipientID, publishDuration)
			// Save status and ack (no subscribers is not a retryable error)
			if saveErr := c.messageRepo.SaveMessage(msgCtx, chatMsg); saveErr != nil {
				log.Printf("[TIMING] [Consumer] ERROR: Failed to save UNDELIVERED status for message %s: %v - message will be redelivered", chatMsg.MessageID, saveErr)
				c.nackMessage(delivery) // Don't ack if save fails
				return
			}
		}
	} else {
		// User is offline, mark as undelivered
		chatMsg.UpdateStatus(models.StatusUndelivered)
		log.Printf("User %s is offline, message %s marked as UNDELIVERED", chatMsg.RecipientID, chatMsg.MessageID)
		// Save status before acking
		if saveErr := c.messageRepo.SaveMessage(msgCtx, chatMsg); saveErr != nil {
			log.Printf("[TIMING] [Consumer] ERROR: Failed to save UNDELIVERED status for offline user message %s: %v - message will be redelivered", chatMsg.MessageID, saveErr)
			c.nackMessage(delivery) // Don't ack if save fails
			return
		}
		c.ackMessage(delivery)
		return
	}

	// If we reach here, status was saved successfully, ack the message
	c.ackMessage(delivery)
}

// ackMessage acknowledges a message
func (c *MessageConsumer) ackMessage(delivery amqp.Delivery) {
	if err := delivery.Ack(false); err != nil {
		log.Printf("Failed to ack message: %v", err)
	}
}

// nackMessage negatively acknowledges a message
func (c *MessageConsumer) nackMessage(delivery amqp.Delivery) {
	if err := delivery.Nack(false, true); err != nil {
		log.Printf("Failed to nack message: %v", err)
	}
}

// sendUndeliveredNotification sends a notification to the user about undelivered messages
// It sends the count of distinct conversations (users) with undelivered messages
func (c *MessageConsumer) sendUndeliveredNotification(ctx context.Context, recipientID string) {
	// Check if we've sent a notification for this user recently (within last minute)
	c.notificationSentMu.RLock()
	lastSent, exists := c.notificationSent[recipientID]
	c.notificationSentMu.RUnlock()

	if exists && time.Since(lastSent) < time.Minute {
		// Already sent notification recently, skip
		return
	}

	// Count distinct conversations (users) with undelivered messages
	count, err := c.messageRepo.GetConversationsWithUndeliveredCount(ctx, recipientID)
	if err != nil {
		log.Printf("Failed to count conversations with undelivered messages for user %s: %v", recipientID, err)
		return
	}

	if count == 0 {
		// No conversations with undelivered messages, send notification with count 0 to clear badge
		notification := map[string]interface{}{
			"type":        "notification",
			"subType":     "inbox",
			"count":       0,
			"recipientId": recipientID,
		}

		notificationBytes, err := json.Marshal(notification)
		if err != nil {
			log.Printf("Failed to marshal notification: %v", err)
			return
		}

		// Publish notification to Redis channel
		if _, err := c.messagePublisher.PublishToUser(ctx, recipientID, notificationBytes); err != nil {
			log.Printf("Failed to publish notification to user %s: %v", recipientID, err)
			return
		}
		return
	}

	// Create notification message
	notification := map[string]interface{}{
		"type":        "notification",
		"subType":     "inbox",
		"count":       count,
		"recipientId": recipientID,
	}

	notificationBytes, err := json.Marshal(notification)
	if err != nil {
		log.Printf("Failed to marshal notification: %v", err)
		return
	}

	// Publish notification to Redis channel (ignore subscriber count for notifications)
	if _, err := c.messagePublisher.PublishToUser(ctx, recipientID, notificationBytes); err != nil {
		log.Printf("Failed to publish notification to user %s: %v", recipientID, err)
		return
	}

	// Mark that we've sent notification for this user
	c.notificationSentMu.Lock()
	c.notificationSent[recipientID] = time.Now()
	c.notificationSentMu.Unlock()

	log.Printf("Notification sent to user %s: %d conversations with undelivered messages", recipientID, count)
}

// Close closes the consumer and connections
func (c *MessageConsumer) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil
	}

	c.closed = true

	var err error
	if c.channel != nil {
		if closeErr := c.channel.Close(); closeErr != nil {
			err = closeErr
		}
	}
	if c.conn != nil {
		if closeErr := c.conn.Close(); closeErr != nil && err == nil {
			err = closeErr
		}
	}

	log.Println("Message consumer closed")
	return err
}
