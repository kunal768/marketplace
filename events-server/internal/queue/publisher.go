package queue

import "context"

// MessagePublisher defines the interface for publishing messages to a queue
// Following Dependency Inversion Principle - high-level modules depend on abstractions
type MessagePublisher interface {
	// Publish sends a message to the queue
	// Returns error if the message cannot be published
	Publish(ctx context.Context, message []byte) error

	// Close gracefully closes the publisher and its connections
	Close() error
}
