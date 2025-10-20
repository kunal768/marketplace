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
	conn             *amqp.Connection
	channel          *amqp.Channel
	queueName        string
	messageRepo      storage.MessageRepository
	presenceChecker  presence.PresenceChecker
	messagePublisher delivery.MessagePublisher
	mu               sync.RWMutex
	closed           bool
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

	// Create ChatMessage with SENT status
	chatMsg := &models.ChatMessage{
		MessageID:   incomingMsg.MessageID,
		SenderID:    incomingMsg.SenderID,
		RecipientID: incomingMsg.RecipientID,
		Content:     incomingMsg.Content,
		Timestamp:   incomingMsg.Timestamp,
		Type:        incomingMsg.Type,
		Status:      models.StatusSent,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	// Save message to MongoDB with SENT status
	if err := c.messageRepo.SaveMessage(msgCtx, chatMsg); err != nil {
		log.Printf("Failed to save message to database: %v", err)
		c.nackMessage(delivery)
		return
	}

	log.Printf("Message %s saved with SENT status", chatMsg.MessageID)

	// Check if recipient is online
	isOnline, err := c.presenceChecker.IsOnline(msgCtx, chatMsg.RecipientID)
	if err != nil {
		log.Printf("Failed to check presence for user %s: %v", chatMsg.RecipientID, err)
		// Mark as undelivered if we can't check presence
		chatMsg.UpdateStatus(models.StatusUndelivered)
		if err := c.messageRepo.SaveMessage(msgCtx, chatMsg); err != nil {
			log.Printf("Failed to update message status to UNDELIVERED: %v", err)
		}
		c.ackMessage(delivery)
		return
	}

	if isOnline {
		// User is online, try to deliver via Redis pub/sub
		messageBytes, err := json.Marshal(incomingMsg)
		if err != nil {
			log.Printf("Failed to marshal message for delivery: %v", err)
			chatMsg.UpdateStatus(models.StatusUndelivered)
			if err := c.messageRepo.SaveMessage(msgCtx, chatMsg); err != nil {
				log.Printf("Failed to update message status to UNDELIVERED: %v", err)
			}
			c.ackMessage(delivery)
			return
		}

		// Publish to Redis channel
		if err := c.messagePublisher.PublishToUser(msgCtx, chatMsg.RecipientID, messageBytes); err != nil {
			log.Printf("Failed to publish message to user %s: %v", chatMsg.RecipientID, err)
			chatMsg.UpdateStatus(models.StatusUndelivered)
		} else {
			// Message published successfully
			chatMsg.UpdateStatus(models.StatusDelivered)
			log.Printf("Message %s delivered to user %s", chatMsg.MessageID, chatMsg.RecipientID)
		}

		// Update status in database
		if err := c.messageRepo.SaveMessage(msgCtx, chatMsg); err != nil {
			log.Printf("Failed to update message status: %v", err)
		}
	} else {
		// User is offline, mark as undelivered
		chatMsg.UpdateStatus(models.StatusUndelivered)
		if err := c.messageRepo.SaveMessage(msgCtx, chatMsg); err != nil {
			log.Printf("Failed to update message status to UNDELIVERED: %v", err)
		}
		log.Printf("User %s is offline, message %s marked as UNDELIVERED", chatMsg.RecipientID, chatMsg.MessageID)
	}

	// Acknowledge the message
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
