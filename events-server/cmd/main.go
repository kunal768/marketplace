package main

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gobwas/ws"
	"github.com/joho/godotenv"
	"github.com/kunal768/cmpe202/events-server/internal/auth"
	"github.com/kunal768/cmpe202/events-server/internal/config"
	"github.com/kunal768/cmpe202/events-server/internal/delivery"
	"github.com/kunal768/cmpe202/events-server/internal/message"
	"github.com/kunal768/cmpe202/events-server/internal/presence"
	"github.com/kunal768/cmpe202/events-server/internal/queue"
	wsx "github.com/kunal768/cmpe202/events-server/internal/ws"
)

// readConnection starts an HTTP listener that upgrades requests to gobwas/ws
// websockets. Each upgraded connection is handled in its own goroutine.
// onConnection and onClose are hooks you can customize.
func readConnection(hub *wsx.Hub, pres presence.PresenceStore, authc auth.AuthClient, msgService *message.MessageService, cfg config.Config) {
	addr := cfg.Port
	if addr == "" {
		log.Fatal("PORT is not set")
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		// Upgrade the incoming HTTP connection to a WebSocket connection.
		// ws.UpgradeHTTP returns (net.Conn, http.Header, *http.Request, error) in common examples.
		conn, _, _, err := ws.UpgradeHTTP(r, w)
		if err != nil {
			log.Println("ws upgrade error:", err)
			return
		}
		// handle each websocket connection concurrently
		go handleConn(conn, hub, pres, authc, msgService, cfg)
	})

	srv := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	log.Printf("websocket server listening on %s", addr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("websocket ListenAndServe: %v", err)
	}
}

// handleConn provides a minimal read loop using wsutil. Replace the loop body
// with your application logic. onConnection and onClose are invoked for lifecycle.
func handleConn(conn net.Conn, hub *wsx.Hub, pres presence.PresenceStore, authc auth.AuthClient, msgService *message.MessageService, cfg config.Config) {
	onConnection(conn)
	defer func() {
		onClose(conn)
		conn.Close()
	}()

	client := wsx.NewClient(conn, hub, pres, authc, msgService, cfg.WSDeadSeconds)
	client.Serve(context.Background())
}

// onConnection is called when a new websocket connection is established.
func onConnection(conn net.Conn) {
	log.Printf("WebSocket connection established: %s", conn.RemoteAddr())
	// Connection state is managed by the Client struct
	// Authentication and registration happen in Client.Serve()
}

// onClose is called when a websocket connection is closed (or read loop exits).
func onClose(conn net.Conn) {
	log.Printf("WebSocket connection closed: %s", conn.RemoteAddr())
	// Cleanup is handled by Client.Close() which:
	// - Sets user offline in presence store
	// - Unregisters from hub (which unsubscribes from Redis)
	// - Closes the connection
}

func main() {
	// Load environment variables from .env if present (current dir, then parent)
	if err := godotenv.Load(); err != nil {
		log.Fatal("Failed to load environment variables:", err)
	}

	cfg := config.Load()

	// Wire dependencies
	pres := presence.NewRedisPresenceStore(cfg.RedisAddr, cfg.RedisPassword, cfg.RedisDB, cfg.PresenceTTLSeconds)
	authc := auth.OrchestratorClient{BaseURL: cfg.OrchestratorBaseURL, HTTPTimeout: 5 * time.Second}

	// Initialize Redis message subscriber
	subscriber := delivery.NewRedisMessageSubscriber(cfg.RedisAddr, cfg.RedisPassword, cfg.RedisDB)
	hub := wsx.NewHub(subscriber)

	// Initialize RabbitMQ publisher
	publisher, err := queue.NewRabbitMQPublisher(cfg.RabbitMQURL, cfg.RabbitMQQueueName)
	if err != nil {
		log.Fatalf("Failed to initialize RabbitMQ publisher: %v", err)
	}

	// Initialize message service
	msgService := message.NewMessageService(publisher)

	// Setup graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle shutdown signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		log.Println("Shutting down...")
		cancel()
	}()

	// Start the websocket listener
	log.Printf("Events server listening on %s", cfg.Port)
	log.Printf("RabbitMQ queue: %s", cfg.RabbitMQQueueName)

	// Start server in goroutine
	go readConnection(hub, pres, authc, msgService, cfg)

	// Wait for shutdown signal
	<-ctx.Done()

	// Graceful shutdown
	log.Println("Closing message service...")
	if err := msgService.Close(); err != nil {
		log.Printf("Error closing message service: %v", err)
	}

	log.Println("Closing Redis subscriber...")
	if err := subscriber.Close(); err != nil {
		log.Printf("Error closing Redis subscriber: %v", err)
	}

	log.Println("Server stopped")
}
