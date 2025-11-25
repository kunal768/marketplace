package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	httplib "github.com/kunal768/cmpe202/http-lib"
	"github.com/kunal768/cmpe202/orchestrator/analytics"
	chatmessage "github.com/kunal768/cmpe202/orchestrator/chat-message"
	dbclient "github.com/kunal768/cmpe202/orchestrator/clients/db"
	mongoclient "github.com/kunal768/cmpe202/orchestrator/clients/mongo"
	"github.com/kunal768/cmpe202/orchestrator/internal/queue"
	"github.com/kunal768/cmpe202/orchestrator/listings"
	"github.com/kunal768/cmpe202/orchestrator/users"
	"go.mongodb.org/mongo-driver/mongo"
)

func main() {
	// Load environment variables from .env if present (current dir, then parent)
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found; continuing with environment variables")
	}

	// Database connection via clients/db
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}
	log.Println("Connecting to: ", dbURL)
	dbsvc := dbclient.NewDBService(dbURL)
	dbPool, err := dbsvc.Connect()
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer dbPool.Close()

	// Initialize user components
	userRepo := users.NewRepository(dbPool)

	// Connect to MongoDB for chat/undelivered messages (optional) using clients/mongo
	var mc *mongo.Client
	chatMongoURI := os.Getenv("CHAT_MONGO_URI")
	if chatMongoURI != "" {
		mongoSvc := mongoclient.NewMongoService(chatMongoURI)
		client, err := mongoSvc.Connect()
		if err != nil {
			log.Fatalf("Failed to connect to MongoDB: %v", err)
		}
		// ensure disconnection on exit
		defer func() { _ = client.Disconnect(context.Background()) }()
		mc = client
		log.Println("Connected to CHAT_MONGO_URI")
	}

	// Setup RabbitMQ publisher if configured
	rabbitURL := os.Getenv("RABBITMQ_URL")
	queueName := os.Getenv("RABBITMQ_QUEUE_NAME")
	var publisher queue.Publisher
	if rabbitURL != "" && queueName != "" {
		pub, err := queue.NewRabbitMQPublisher(rabbitURL, queueName)
		if err != nil {
			log.Fatalf("Failed to create RabbitMQ publisher: %v", err)
		}
		publisher = pub
		defer pub.Close()
	}

	// Create user service and endpoints. Publisher is no longer needed for users service.
	userService := users.NewService(userRepo, publisher)
	userEndpoints := users.NewEndpoints(userService)

	// Create chat service and endpoints
	chatService := chatmessage.NewChatService(mc, publisher)
	chatEndpoints := chatmessage.NewEndpoints(chatService)

	// Create listing service and endpoints
	baseUrl := os.Getenv("LISTING_SERVICE_URL")
	sharedSecret := os.Getenv("LISTING_SERVICE_SHARED_SECRET")
	listingService := listings.NewListingService(baseUrl, sharedSecret)
	listingEndpoints := listings.NewEndpoints(listingService)

	// Create analytics service and endpoints
	analyticsRepo := analytics.NewRepository(dbPool)
	analyticsService := analytics.NewService(analyticsRepo)
	analyticsEndpoints := analytics.NewEndpoints(analyticsService)

	// Setup HTTP server
	mux := http.NewServeMux()

	// Register user routes with middleware
	userEndpoints.RegisterRoutes(mux, dbPool)

	// Register chat routes with middleware
	chatEndpoints.RegisterRoutes(mux, dbPool)

	// Register listing routes with middleware
	listingEndpoints.RegisterRoutes(mux, dbPool)

	// Register analytics routes with middleware
	analyticsEndpoints.RegisterRoutes(mux, dbPool)

	// Health check endpoint
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Wrap the mux with CORS middleware
	handler := httplib.CORSMiddleware(mux)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Server starting on port %s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}
