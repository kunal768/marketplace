# Real-time Chat Testing Guide

## Quick Start

### Automated Testing

1. **Set up test users:**
   ```bash
   export TEST_USER1_ID="user1-id"
   export TEST_USER1_TOKEN="user1-jwt-token"
   export TEST_USER1_REFRESH_TOKEN="user1-refresh-token"
   
   export TEST_USER2_ID="user2-id"
   export TEST_USER2_TOKEN="user2-jwt-token"
   export TEST_USER2_REFRESH_TOKEN="user2-refresh-token"
   ```

2. **Install dependencies:**
   ```bash
   npm install ws
   ```

3. **Run automated tests:**
   ```bash
   node test-realtime-chat.js
   ```

### Manual UI Testing

See `test-ui-chat.md` for detailed manual testing steps.

## What Was Fixed

### Problem
- Presence TTL was expiring while users were still connected
- Messages were marked as UNDELIVERED even though users were online
- No mechanism to refresh presence while connection was active

### Solution
1. **Background Presence Refresh Loop:**
   - Automatically refreshes presence TTL at half the TTL interval
   - Keeps users marked as online while connected
   - Stops when connection closes

2. **Activity-Based Refresh:**
   - Refreshes presence when sending messages
   - Refreshes presence when receiving messages
   - Ensures active users stay online

3. **Order of Operations:**
   - Set presence BEFORE subscribing to Redis
   - Ensures presence is set before messages can arrive

## Key Changes

### events-server/internal/ws/client.go

1. Added `refreshCancel` field to Client struct
2. Added `refreshPresenceLoop()` method
3. Modified `Serve()` to:
   - Set presence before Hub.Register()
   - Start refresh loop after registration
4. Modified message handlers to refresh on activity
5. Modified `SendMessage()` to refresh on delivery
6. Modified `Close()` to stop refresh loop

## Expected Behavior

### Presence Refresh Logs
```
[PresenceRefresh] [userId] Starting refresh loop with interval: 15s (TTL/2)
[PresenceRefresh] [userId] Successfully refreshed presence TTL
[PresenceRefresh] [userId] Refresh loop stopped (context cancelled)
```

### Message Delivery
- Messages should appear in < 1 second
- No duplicates
- All messages delivered in order
- Presence stays active during long connections

## Troubleshooting

### Messages not appearing
- Check WebSocket connection state
- Check browser console for errors
- Verify presence refresh is working

### User marked offline
- Check PRESENCE_TTL_SECONDS value
- Verify refresh loop is running
- Check Redis for presence key

### Multiple undelivered fetches
- Should only see ONE per connection
- Check for reconnection loops
- Verify WebSocket context is working

