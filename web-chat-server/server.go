package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

var clients = make(map[string]*websocket.Conn) // userID -> connection
var clientsMu sync.RWMutex                     // protects clients map

func handleConnections(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println("Upgrade error:", err)
		return
	}
	defer ws.Close()

	// Register client safely
	clientsMu.Lock()
	clients[userID] = ws
	clientsMu.Unlock()

	for {
		_, msgBytes, err := ws.ReadMessage()
		if err != nil {
			fmt.Println("Read error:", err)
			break
		}
		var msg Message
		if err := json.Unmarshal(msgBytes, &msg); err != nil {
			fmt.Println("Invalid message format:", err)
			continue
		}
		// Route message to recipient
		clientsMu.RLock()
		recipientConn, ok := clients[msg.Recipient]
		clientsMu.RUnlock()
		if ok {
			err := recipientConn.WriteMessage(websocket.TextMessage, msgBytes)
			if err != nil {
				fmt.Println("Write to recipient error:", err)
			}
		} else {
			fmt.Println("Recipient not connected:", msg.Recipient)
		}
	}

	// Cleanup client connection on disconnect
	clientsMu.Lock()
	delete(clients, userID)
	clientsMu.Unlock()
}

func main() {
	http.HandleFunc("/ws", handleConnections)
	http.ListenAndServe(":8080", nil) // Start server on port 8080

}
