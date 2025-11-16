# UI Testing Guide for Real-time Chat

## Prerequisites

1. All services running:
   - Orchestrator (port 8080)
   - Events-server (port 8001)
   - Chat-consumer
   - Frontend (port 3000)

2. Two user accounts created and logged in

## Manual UI Testing Steps

### Test 1: Basic Real-time Message Delivery

1. **Setup:**
   - Open Chrome browser → Login as User A
   - Open Safari browser → Login as User B
   - Navigate both to `/messages` page

2. **Test:**
   - In Chrome (User A): Select conversation with User B
   - Send message: "Hello from User A"
   - **Expected:** Message appears immediately in Safari (User B) without refresh
   - In Safari (User B): Reply with "Hello from User B"
   - **Expected:** Message appears immediately in Chrome (User A) without refresh

3. **Verify:**
   - Check browser console for WebSocket logs
   - Check events-server logs for presence refresh messages
   - Check chat-consumer logs for message processing

### Test 2: Presence Refresh (Long Connection)

1. **Setup:**
   - Both users connected and on messages page
   - Note the time

2. **Test:**
   - Wait 30+ seconds (longer than PRESENCE_TTL_SECONDS)
   - Send a message from User A to User B
   - **Expected:** Message should still be delivered immediately

3. **Verify:**
   - Check events-server logs for `[PresenceRefresh]` messages
   - Should see periodic refresh logs every TTL/2 seconds
   - Check chat-consumer logs - user should be marked as online

### Test 3: Multiple Rapid Messages

1. **Setup:**
   - Both users connected

2. **Test:**
   - User A sends 5 messages rapidly (within 2 seconds)
   - **Expected:** All 5 messages appear in User B's UI in order
   - User B sends 5 replies rapidly
   - **Expected:** All 5 messages appear in User A's UI in order

3. **Verify:**
   - Messages appear in correct order
   - No duplicates
   - All messages delivered

### Test 4: Connection Stability

1. **Setup:**
   - Both users connected

2. **Test:**
   - Keep connection open for 2+ minutes
   - Send messages periodically
   - **Expected:** Connection remains stable, messages delivered

3. **Verify:**
   - Check for reconnection logs (should be minimal)
   - Presence refresh logs should continue
   - No "fetched 0 undelivered messages" spam

### Test 5: Offline to Online Transition

1. **Setup:**
   - User A connected, User B disconnected

2. **Test:**
   - User A sends message to User B
   - **Expected:** Message marked as sent but not delivered
   - User B connects
   - **Expected:** Undelivered message fetched and delivered

3. **Verify:**
   - Check orchestrator logs for undelivered fetch
   - Should see only ONE fetch per connection
   - Message appears in User B's UI

## Browser Console Checks

### Expected Logs (User A):
```
[useWebSocketConnection] Credentials changed: ...
[useWebSocketConnection] Creating client
[useWebSocketConnection] Auto-connecting...
[WebSocket] Connection opened, sending auth...
[WebSocket] Auth successful, user: <userId>
[useWebSocketConnection] State changed: connected
[useWebSocketConnection] Received new message: <messageId> from: <senderId>
[MessagesPage] Adding new message: <messageId>
```

### Expected Logs (User B):
```
[useWebSocketConnection] Credentials changed: ...
[useWebSocketConnection] Creating client
[useWebSocketConnection] Auto-connecting...
[WebSocket] Connection opened, sending auth...
[WebSocket] Auth successful, user: <userId>
[useWebSocketConnection] State changed: connected
[useWebSocketConnection] Received new message: <messageId> from: <senderId>
[MessagesPage] Adding new message: <messageId>
```

## Backend Logs to Check

### Events-Server:
```
[TIMING] [userId] SetOnline completed successfully
[TIMING] [userId] Started presence refresh loop
[PresenceRefresh] [userId] Starting refresh loop with interval: 15s
[PresenceRefresh] [userId] Successfully refreshed presence TTL
[Hub] Processing regular message <messageId> for user <userId>
[TIMING] [userId] Message <messageId> sent to user <userId> via WebSocket
```

### Chat-Consumer:
```
[Consumer] Checking presence for user <userId>
[Consumer] Presence check result: isOnline=true
[Consumer] Publishing message to Redis channel
[Publisher] Published message to user <userId> (subscribers: 1)
[Consumer] Message delivered to user <userId>
```

## Common Issues to Watch For

1. **Messages not appearing:**
   - Check WebSocket connection state (should be "connected")
   - Check browser console for errors
   - Check if message deduplication is working

2. **User marked offline:**
   - Check presence refresh logs
   - Verify PRESENCE_TTL_SECONDS is set correctly
   - Check Redis for presence key expiration

3. **Multiple undelivered fetches:**
   - Should only see ONE fetch per connection
   - Check for reconnection loops
   - Verify WebSocket context is working

4. **Messages delayed:**
   - Check RabbitMQ queue processing
   - Check Redis pub/sub delivery
   - Check network latency

## Success Criteria

✅ Messages appear in real-time (< 1 second delay)
✅ Presence refresh working (logs show periodic refresh)
✅ No duplicate messages
✅ No reconnection loops
✅ Only one undelivered fetch per connection
✅ Connection stable for extended periods
✅ Messages delivered even after TTL expiration

