package queue

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

// Publisher defines a minimal interface for publishing messages
type Publisher interface {
	Publish(ctx context.Context, message []byte) error
	Close() error
}

// RabbitMQPublisher implements MessagePublisher interface using RabbitMQ
type RabbitMQPublisher struct {
	url        string
	queueName  string
	conn       *amqp.Connection
	channel    *amqp.Channel
	mu         sync.RWMutex
	closed     bool
	reconnect  chan struct{}
	stopReconn chan struct{}
}

// NewRabbitMQPublisher creates a new RabbitMQ publisher
func NewRabbitMQPublisher(url, queueName string) (*RabbitMQPublisher, error) {
	p := &RabbitMQPublisher{
		url:        url,
		queueName:  queueName,
		reconnect:  make(chan struct{}, 1),
		stopReconn: make(chan struct{}),
	}

	if err := p.connect(); err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	// Start reconnection goroutine
	go p.reconnectLoop()

	return p, nil
}

// connect establishes connection to RabbitMQ and declares the queue
func (p *RabbitMQPublisher) connect() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Close existing connection if any
	if p.conn != nil {
		p.conn.Close()
	}
	if p.channel != nil {
		p.channel.Close()
	}

	// Connect to RabbitMQ
	conn, err := amqp.Dial(p.url)
	if err != nil {
		return fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	// Create channel
	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return fmt.Errorf("failed to open channel: %w", err)
	}

	// Declare queue (durable for persistence)
	_, err = ch.QueueDeclare(
		p.queueName, // name
		true,        // durable
		false,       // delete when unused
		false,       // exclusive
		false,       // no-wait
		nil,         // arguments
	)
	if err != nil {
		ch.Close()
		conn.Close()
		return fmt.Errorf("failed to declare queue: %w", err)
	}

	p.conn = conn
	p.channel = ch
	p.closed = false

	log.Printf("Connected to RabbitMQ queue: %s", p.queueName)
	return nil
}

// Publish sends a message to the queue
func (p *RabbitMQPublisher) Publish(ctx context.Context, message []byte) error {
	p.mu.RLock()
	channel := p.channel
	closed := p.closed
	p.mu.RUnlock()

	if closed || channel == nil {
		return fmt.Errorf("publisher is closed or not connected")
	}

	// Publish message with persistence
	err := channel.PublishWithContext(
		ctx,
		"",          // exchange (default)
		p.queueName, // routing key
		true,        // mandatory
		false,       // immediate
		amqp.Publishing{
			ContentType:  "application/json",
			Body:         message,
			DeliveryMode: amqp.Persistent, // Make message persistent
			Timestamp:    time.Now(),
		},
	)

	if err != nil {
		log.Printf("Failed to publish message: %v", err)
		// Trigger reconnection
		select {
		case p.reconnect <- struct{}{}:
		default:
		}
		return fmt.Errorf("failed to publish message: %w", err)
	}

	return nil
}

// Close gracefully closes the publisher
func (p *RabbitMQPublisher) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.closed {
		return nil
	}

	p.closed = true
	close(p.stopReconn)

	var err error
	if p.channel != nil {
		err = p.channel.Close()
	}
	if p.conn != nil {
		if closeErr := p.conn.Close(); closeErr != nil && err == nil {
			err = closeErr
		}
	}

	log.Println("RabbitMQ publisher closed")
	return err
}

// reconnectLoop handles automatic reconnection
func (p *RabbitMQPublisher) reconnectLoop() {
	for {
		select {
		case <-p.reconnect:
			log.Println("Attempting to reconnect to RabbitMQ...")
			if err := p.connect(); err != nil {
				log.Printf("Reconnection failed: %v", err)
				// Retry after delay
				time.Sleep(5 * time.Second)
				select {
				case p.reconnect <- struct{}{}:
				default:
				}
			} else {
				log.Println("Successfully reconnected to RabbitMQ")
			}
		case <-p.stopReconn:
			return
		}
	}
}
