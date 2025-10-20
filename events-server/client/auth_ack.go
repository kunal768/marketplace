package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gobwas/ws"
	"github.com/gobwas/ws/wsutil"
)

// Simple CLI client for manual testing of events-server
// Usage: go run ./events-server/client -url ws://localhost:8001/ws -user <id> -token <jwt>
func main() {
	url := flag.String("url", "ws://localhost:8001/ws", "websocket url")
	user := flag.String("user", "test-user", "user id")
	token := flag.String("token", "", "bearer access token")
	period := flag.Int("period", 3, "heartbeat seconds")
	flag.Parse()

	conn, _, _, err := ws.Dial(context.Background(), *url)
	if err != nil {
		log.Fatalf("dial error: %v", err)
	}
	defer conn.Close()

	// 1) Send auth handshake
	authMsg := map[string]string{"type": "auth", "userId": *user, "token": *token}
	b, _ := json.Marshal(authMsg)
	if err := wsutil.WriteClientText(conn, b); err != nil {
		log.Fatalf("auth send error: %v", err)
	}
	log.Println("sent auth handshake")

	// 2) Start heartbeat ticker
	ticker := time.NewTicker(time.Duration(*period) * time.Second)
	defer ticker.Stop()

	// 3) Handle exit
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)

	for {
		select {
		case <-ticker.C:
			hb := map[string]string{"type": "alive"}
			b, _ := json.Marshal(hb)
			if err := wsutil.WriteClientText(conn, b); err != nil {
				log.Printf("heartbeat send error: %v", err)
				return
			}
			fmt.Print(".")
		case <-sig:
			log.Println("\nshutting down client")
			return
		}
	}
}
