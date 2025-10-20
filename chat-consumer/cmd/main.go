package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"github.com/kunal768/cmpe202/chat-consumer/internal/config"
	"github.com/kunal768/cmpe202/chat-consumer/internal/consumer"
	"github.com/kunal768/cmpe202/chat-consumer/internal/delivery"
	"github.com/kunal768/cmpe202/chat-consumer/internal/presence"
	"github.com/kunal768/cmpe202/chat-consumer/internal/storage"
)

func main() {
	// Load environment variables from .env if present
	if err := godotenv.Load(); err != nil {
		log.Fatal("Failed to load environment variables:", err)
	}

	// Load configuration (will fail if any required env vars are missing)
	cfg := config.Load()

	// Create context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize MongoDB repository
	log.Println("Connecting to MongoDB...")
	messageRepo, err := storage.NewMongoMessageRepository(cfg.MongoURI)
	if err != nil {
		log.Fatalf("Failed to initialize MongoDB repository: %v", err)
	}
	defer func() {
		if err := messageRepo.Close(); err != nil {
			log.Printf("Error closing MongoDB repository: %v", err)
		}
	}()

	// Initialize Redis presence checker
	log.Println("Connecting to Redis for presence checking...")
	presenceChecker := presence.NewRedisPresenceChecker(cfg.RedisAddr, cfg.RedisPassword, cfg.RedisDB)
	defer func() {
		if err := presenceChecker.Close(); err != nil {
			log.Printf("Error closing Redis presence checker: %v", err)
		}
	}()

	// Initialize Redis message publisher
	log.Println("Connecting to Redis for message publishing...")
	messagePublisher := delivery.NewRedisMessagePublisher(cfg.RedisAddr, cfg.RedisPassword, cfg.RedisDB)
	defer func() {
		if err := messagePublisher.Close(); err != nil {
			log.Printf("Error closing Redis message publisher: %v", err)
		}
	}()

	// Initialize RabbitMQ consumer
	log.Println("Connecting to RabbitMQ...")
	messageConsumer, err := consumer.NewMessageConsumer(
		cfg.RabbitMQURL,
		cfg.RabbitMQQueueName,
		messageRepo,
		presenceChecker,
		messagePublisher,
	)
	if err != nil {
		log.Fatalf("Failed to initialize message consumer: %v", err)
	}
	defer func() {
		if err := messageConsumer.Close(); err != nil {
			log.Printf("Error closing message consumer: %v", err)
		}
	}()

	// Start consuming messages
	log.Printf("Starting message consumer for queue: %s", cfg.RabbitMQQueueName)
	if err := messageConsumer.Start(ctx); err != nil {
		log.Fatalf("Failed to start message consumer: %v", err)
	}

	// Setup graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	log.Println("Chat consumer is running. Press Ctrl+C to stop.")

	// Wait for shutdown signal
	<-sigChan
	log.Println("Shutdown signal received, stopping...")

	// Cancel context to stop consumer
	cancel()

	// Give some time for graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	// Wait for shutdown or timeout
	select {
	case <-shutdownCtx.Done():
		log.Println("Shutdown timeout reached")
	default:
		log.Println("Chat consumer stopped gracefully")
	}
}
