import { useState, useEffect, useRef, useCallback } from 'react'
import { WebSocketClient } from '@/lib/websocket/client'
import type { ConnectionState, Message, NotificationMessage } from '@/lib/websocket/types'
import { setTokenUpdateCallback } from '@/lib/api/orchestrator'
import { setGlobalWebSocketDisconnect, clearGlobalWebSocketDisconnect } from '@/lib/websocket/manager'

const EVENTS_SERVER_URL = process.env.NEXT_PUBLIC_EVENTS_SERVER_URL || 'ws://localhost:8001/ws'

/**
 * Simple WebSocket connection hook with auto-connect.
 * Auto-connects when userId and token are available.
 * 
 * @param userId - User ID for authentication (null if not authenticated)
 * @param token - Auth token for authentication (null if not authenticated)
 * @param refreshToken - Refresh token for token refresh (null if not authenticated)
 */
export function useWebSocketConnection(
  userId: string | null,
  token: string | null,
  refreshToken?: string | null
) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [messages, setMessages] = useState<Message[]>([])
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [notification, setNotification] = useState<NotificationMessage | null>(null)

  const clientRef = useRef<WebSocketClient | null>(null)
  const autoConnectAttemptedRef = useRef(false)
  const tokenUpdateCallbackRef = useRef<((newToken: string, newRefreshToken: string) => void) | null>(null)
  const processedMessageIdsRef = useRef<Set<string>>(new Set())
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const lastDisconnectTimeRef = useRef<number>(0)

  // Set up token update callback for WebSocket client
  useEffect(() => {
    const callback = (newToken: string, newRefreshToken: string) => {
      // Update token in WebSocket client if connected
      if (clientRef.current) {
        clientRef.current['token'] = newToken
        clientRef.current['refreshToken'] = newRefreshToken
      }
      // Also update via API callback
      tokenUpdateCallbackRef.current?.(newToken, newRefreshToken)
    }
    setTokenUpdateCallback(callback)
    tokenUpdateCallbackRef.current = callback
  }, [])

  // Simple check: do we have credentials?
  const hasCredentials = !!userId && !!token

  // Debug logging - only log when credentials actually change or connection state changes significantly
  // This prevents excessive logging on every render
  const prevCredentialsRef = useRef<{ hasCredentials: boolean; userId: string | null; hasToken: boolean } | null>(null)
  useEffect(() => {
    const current = { hasCredentials, userId, hasToken: !!token }
    const prev = prevCredentialsRef.current
    
    // Only log if credentials changed or connection state changed to/from connected
    if (!prev || 
        prev.hasCredentials !== current.hasCredentials ||
        prev.userId !== current.userId ||
        prev.hasToken !== current.hasToken) {
      console.log('[useWebSocketConnection] Credentials changed:', {
        hasCredentials,
        userId,
        hasToken: !!token,
        hasClient: !!clientRef.current,
        connectionState,
        autoConnectAttempted: autoConnectAttemptedRef.current,
      })
      prevCredentialsRef.current = current
    }
  }, [hasCredentials, userId, token, connectionState])

  // Create client when credentials are available
  useEffect(() => {
    if (!hasCredentials) {
      // No credentials - clean up only if client exists
      if (clientRef.current) {
        console.log('[useWebSocketConnection] Cleaning up - no credentials')
        clientRef.current.disconnect()
        clientRef.current = null
      }
      autoConnectAttemptedRef.current = false
      setConnectionState('disconnected')
      setConnectionError(null)
      return
    }

    // We have credentials - create client if needed
    // Only create new client if userId changes or client doesn't exist
    // Don't recreate on token changes - just update the token
    if (!clientRef.current || (clientRef.current && clientRef.current['userId'] !== userId)) {
      // If userId changed, disconnect old client first
      if (clientRef.current && clientRef.current['userId'] !== userId) {
        console.log('[useWebSocketConnection] User changed, disconnecting old client')
        clientRef.current.disconnect()
        clientRef.current = null
        processedMessageIdsRef.current.clear() // Clear processed messages for new user
      }
      
      console.log('[useWebSocketConnection] Creating client', { userId })
      
      const client = new WebSocketClient(
        EVENTS_SERVER_URL,
        {
          onStateChange: (state) => {
            console.log('[useWebSocketConnection] State changed:', state)
            setConnectionState(state)
            if (state === 'connected') {
              setConnectionError(null)
              autoConnectAttemptedRef.current = false
              reconnectAttemptsRef.current = 0 // Reset reconnect attempts on successful connection
              // Clear any pending reconnect timeout
              if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
                reconnectTimeoutRef.current = null
              }
            } else if (state === 'disconnected') {
              // Track when connection was lost for backoff calculation
              lastDisconnectTimeRef.current = Date.now()
            }
          },
          onMessage: (message) => {
            // Deduplicate messages by messageId to prevent duplicates during reconnections
            if (!processedMessageIdsRef.current.has(message.messageId)) {
              processedMessageIdsRef.current.add(message.messageId)
              console.log('[useWebSocketConnection] Received new message:', message.messageId, 'from:', message.senderId, 'content:', message.content.substring(0, 50))
              setMessages((prev) => {
                // Double-check for duplicates (race condition protection)
                if (prev.some(m => m.messageId === message.messageId)) {
                  console.log('[useWebSocketConnection] Duplicate detected in state, skipping')
                  return prev
                }
                return [...prev, message]
              })
            } else {
              console.log('[useWebSocketConnection] Skipping duplicate message:', message.messageId)
            }
          },
          onError: (error) => {
            console.error('[useWebSocketConnection] Error:', error)
            setConnectionError(error.message)
          },
          onNotification: (notification) => {
            console.log('[useWebSocketConnection] Notification received:', notification)
            setNotification(notification)
          },
        },
        tokenUpdateCallbackRef.current || undefined
      )

      // Store userId for comparison
      client['userId'] = userId
      clientRef.current = client
      console.log('[useWebSocketConnection] Client created successfully')
    } else if (clientRef.current && token) {
      // Update token if it changed (but userId is same)
      clientRef.current['token'] = token
      clientRef.current['refreshToken'] = refreshToken || null
    }
  }, [hasCredentials, userId, token])

  // Separate effect for auto-connect to avoid cleanup issues
  useEffect(() => {
    if (!hasCredentials || !clientRef.current) {
      return
    }

    // Auto-connect if disconnected and haven't attempted yet
    // Prevent rapid reconnections with exponential backoff
    if (connectionState === 'disconnected' && !autoConnectAttemptedRef.current) {
      const now = Date.now()
      const timeSinceLastDisconnect = now - lastDisconnectTimeRef.current
      
      // Minimum delay between reconnection attempts (exponential backoff)
      const baseDelay = 1000 // 1 second base
      const maxDelay = 30000 // 30 seconds max
      const delay = Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current), maxDelay)
      
      // If we just disconnected, wait before reconnecting
      if (timeSinceLastDisconnect < delay && lastDisconnectTimeRef.current > 0) {
        console.log(`[useWebSocketConnection] Waiting ${delay - timeSinceLastDisconnect}ms before reconnecting (attempt ${reconnectAttemptsRef.current + 1})`)
        reconnectTimeoutRef.current = setTimeout(() => {
          autoConnectAttemptedRef.current = false
        }, delay - timeSinceLastDisconnect)
        return
      }

      console.log('[useWebSocketConnection] Auto-connecting...', { userId, hasToken: !!token, attempt: reconnectAttemptsRef.current + 1 })
      autoConnectAttemptedRef.current = true
      reconnectAttemptsRef.current++

      clientRef.current
        .connect(userId!, token!, refreshToken || null)
        .then(() => {
          console.log('[useWebSocketConnection] Auto-connect successful')
        })
        .catch((error) => {
          console.error('[useWebSocketConnection] Auto-connect failed:', error)
          setConnectionError(error instanceof Error ? error.message : 'Auto-connect failed')
          // Allow retry after delay with exponential backoff
          const retryDelay = Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current), maxDelay)
          reconnectTimeoutRef.current = setTimeout(() => {
            autoConnectAttemptedRef.current = false
          }, retryDelay)
        })
    }

    // Cleanup timeout on unmount or when connection succeeds
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [hasCredentials, userId, token, refreshToken, connectionState])

  // Manual connect function
  const connect = useCallback(async () => {
    if (!hasCredentials) {
      const errorMsg = 'Cannot connect: missing userId or token'
      console.warn('[useWebSocketConnection]', errorMsg)
      setConnectionError(errorMsg)
      return { success: false, error: errorMsg }
    }

    if (!clientRef.current) {
      // Create client on-demand
      const client = new WebSocketClient(
        EVENTS_SERVER_URL,
        {
          onStateChange: setConnectionState,
          onMessage: (msg) => {
            // Deduplicate messages by messageId
            if (!processedMessageIdsRef.current.has(msg.messageId)) {
              processedMessageIdsRef.current.add(msg.messageId)
              setMessages((prev) => [...prev, msg])
            }
          },
          onError: (err) => setConnectionError(err.message),
          onNotification: (notif) => setNotification(notif),
        },
        tokenUpdateCallbackRef.current || undefined
      )
      clientRef.current = client
    }

    if (connectionState === 'connected' || connectionState === 'connecting') {
      return { success: true }
    }

    console.log('[useWebSocketConnection] Manual connect...', { userId })
    setConnectionError(null)
    autoConnectAttemptedRef.current = true

    try {
      await clientRef.current.connect(userId!, token!, refreshToken || null)
      console.log('[useWebSocketConnection] Manual connect successful')
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Connection failed'
      console.error('[useWebSocketConnection] Manual connect failed:', errorMsg)
      setConnectionError(errorMsg)
      autoConnectAttemptedRef.current = false
      return { success: false, error: errorMsg }
    }
  }, [hasCredentials, userId, token, refreshToken, connectionState])

  const disconnect = useCallback(() => {
    console.log('[useWebSocketConnection] Disconnect')
    lastDisconnectTimeRef.current = Date.now()
    reconnectAttemptsRef.current = 0 // Reset reconnect attempts on manual disconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (clientRef.current) {
      clientRef.current.disconnect()
    }
    autoConnectAttemptedRef.current = false
    setConnectionState('disconnected')
  }, [])

  // Register global disconnect function for logout
  useEffect(() => {
    if (hasCredentials) {
      setGlobalWebSocketDisconnect(disconnect)
      return () => {
        clearGlobalWebSocketDisconnect()
      }
    } else {
      clearGlobalWebSocketDisconnect()
    }
  }, [hasCredentials, disconnect])

  const sendMessage = useCallback(
    (recipientId: string, content: string) => {
      if (!clientRef.current || connectionState !== 'connected') {
        return { success: false, error: 'Not connected' }
      }

      try {
        clientRef.current.sendChatMessage(recipientId, content)
        const sentMessage: Message = {
          messageId: `temp-${Date.now()}`,
          senderId: userId || '',
          recipientId,
          content,
          timestamp: new Date(),
          type: 'text',
          direction: 'sent',
        }
        setMessages((prev) => [...prev, sentMessage])
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send message',
        }
      }
    },
    [userId, connectionState]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    processedMessageIdsRef.current.clear()
  }, [])

  return {
    connectionState,
    messages,
    connectionError,
    notification,
    connect,
    disconnect,
    sendMessage,
    clearMessages,
  }
}

