package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	dbclient "github.com/kunal768/cmpe202/orchestrator/clients/db"
	"github.com/kunal768/cmpe202/orchestrator/users"
)

func main() {
	// Load environment variables from .env if present (current dir, then parent)
	if err := godotenv.Load(); err != nil {
		log.Fatal("Failed to load environment variables:", err)
	}

	// Database connection via clients/db
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}
	dbsvc := dbclient.NewDBService(dbURL)
	dbPool, err := dbsvc.Connect()
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer dbPool.Close()

	// Initialize user components
	userRepo := users.NewRepository(dbPool)
	userService := users.NewService(userRepo)
	userEndpoints := users.NewEndpoints(userService)

	// Setup HTTP server
	mux := http.NewServeMux()

	// Register user routes with middleware
	userEndpoints.RegisterRoutes(mux, dbPool)

	// Health check endpoint
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Server starting on port %s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
