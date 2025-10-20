package ws

import (
	"encoding/json"
	"fmt"
)

// Generic message envelope for routing by type
type Message struct {
	Type string `json:"type"`
}

// AuthMessage initiates the handshake
type AuthMessage struct {
	Type   string `json:"type"` // "auth"
	UserID string `json:"userId"`
	Token  string `json:"token"`
}

// PresenceMessage indicates liveness (renamed from HeartbeatMessage)
type PresenceMessage struct {
	Type string `json:"type"` // "presence"
}

// ChatMessage for sending chat messages
type ChatMessage struct {
	Type        string `json:"type"`        // "chat"
	RecipientID string `json:"recipientId"` // target user
	Msg         string `json:"msg"`         // message content
}

func ParseMessage(b []byte) (string, any, error) {
	var env Message
	if err := json.Unmarshal(b, &env); err != nil {
		return "", nil, fmt.Errorf("invalid message envelope: %w", err)
	}
	switch env.Type {
	case "auth":
		var m AuthMessage
		if err := json.Unmarshal(b, &m); err != nil {
			return "", nil, err
		}
		return env.Type, m, nil
	case "presence":
		var m PresenceMessage
		if err := json.Unmarshal(b, &m); err != nil {
			return "", nil, err
		}
		return env.Type, m, nil
	case "chat":
		var m ChatMessage
		if err := json.Unmarshal(b, &m); err != nil {
			return "", nil, err
		}
		// Validate required fields
		if m.RecipientID == "" || m.Msg == "" {
			return "", nil, fmt.Errorf("chat message missing required fields: recipientId and msg")
		}
		return env.Type, m, nil
	default:
		return env.Type, nil, nil
	}
}
