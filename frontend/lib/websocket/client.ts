import type {
  ConnectionState,
  AuthMessage,
  ChatMessage,
  IncomingMessage,
  AuthAckMessage,
  NotificationMessage,
  Message,
} from './types'
import { isTokenExpired } from '@/lib/utils/jwt'
import { refreshAccessToken } from '@/lib/api/orchestrator'

export interface WebSocketClientCallbacks {
  onStateChange?: (state: ConnectionState) => void
  onMessage?: (message: Message) => void
  onError?: (error: Error) => void
  onNotification?: (notification: NotificationMessage) => void
}

export class WebSocketClient {
  private ws: WebSocket | null = null
  private state: ConnectionState = 'disconnected'
  private callbacks: WebSocketClientCallbacks = {}
  private url: string
  private userId: string | null = null
  private token: string | null = null
  private refreshToken: string | null = null
  private authPending: boolean = false
  private connectResolve: (() => void) | null = null
  private connectReject: ((error: Error) => void) | null = null
  private onTokenUpdate?: (newToken: string, newRefreshToken: string) => void

  constructor(
    url: string,
    callbacks: WebSocketClientCallbacks = {},
    onTokenUpdate?: (newToken: string, newRefreshToken: string) => void
  ) {
    this.url = url
    this.callbacks = callbacks
    this.onTokenUpdate = onTokenUpdate
  }

  getState(): ConnectionState {
    return this.state
  }

  async connect(userId: string, token: string, refreshToken?: string | null): Promise<void> {
    return new Promise(async (resolve, reject) => {
      // Validate inputs
      if (!userId || !token) {
        reject(new Error('User ID and token are required'))
        return
      }

      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      if (this.ws?.readyState === WebSocket.CONNECTING) {
        // Wait for connection
        const checkConnection = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            clearInterval(checkConnection)
            resolve()
          } else if (this.ws?.readyState === WebSocket.CLOSED) {
            clearInterval(checkConnection)
            reject(new Error('Connection failed'))
          }
        }, 100)
        return
      }

      // Check token expiration and refresh if needed
      // Access tokens expire in 1 hour (per http-lib/library.go)
      // Only refresh if token is expired or will expire within 5 minutes (300 seconds)
      // This prevents unnecessary refreshes while ensuring tokens are valid
      let validToken = token
      let validRefreshToken = refreshToken || null
      
      // Only check expiry if token is close to expiring (within 5 minutes) or already expired
      // This is a fast operation (JWT decode) so it's fine to do on every connection attempt
      if (isTokenExpired(token, 300)) {
        // Only attempt refresh if refreshToken exists and is not null/empty
        if (refreshToken && refreshToken.trim() !== '') {
          try {
            console.log('[WebSocket] Token expired or expiring soon (within 5 min), refreshing before connection...')
            const newToken = await refreshAccessToken(refreshToken, this.onTokenUpdate)
            if (newToken) {
              validToken = newToken
              // Refresh token is updated in callback
              console.log('[WebSocket] Token refreshed successfully')
            } else {
              // Refresh failed silently - token may be expired
              reject(new Error('Failed to refresh expired token'))
              return
            }
          } catch (error) {
            // Handle expired refresh token gracefully - don't log as error
            const errorMessage = error instanceof Error ? error.message : 'Token refresh failed'
            if (errorMessage.includes('expired') || errorMessage.includes('401')) {
              console.debug('[WebSocket] Refresh token expired, connection rejected')
            } else {
              console.error('[WebSocket] Token refresh failed:', error)
            }
            reject(new Error('Token refresh failed'))
            return
          }
        } else {
          // No refresh token available - silently reject
          reject(new Error('Token expired and no refresh token available'))
          return
        }
      } else {
        // Token is still valid (not expiring within 5 minutes)
        // No need to refresh, proceed with existing token
      }

      this.userId = userId
      this.token = validToken
      this.refreshToken = validRefreshToken
      this.setState('connecting')

      try {
        console.log('[WebSocket] Attempting to connect to:', this.url)
        this.ws = new WebSocket(this.url)
        
        // Set error handler IMMEDIATELY after creation (Safari may fire errors synchronously)
        this.ws.onerror = (error) => {
          const errorDetails = {
            type: error.type || 'unknown',
            target: error.target ? (error.target as WebSocket).url : 'unknown',
            readyState: this.ws?.readyState,
            url: this.url,
          }
          console.error('[WebSocket] Connection error:', errorDetails, error)
          
          // Only set error state if we're not already handling a close
          if (this.ws?.readyState !== WebSocket.CLOSED) {
            this.setState('error')
          }
          this.authPending = false
          
          const errorMsg = `WebSocket connection error: ${this.url} (readyState: ${this.ws?.readyState})`
          this.callbacks.onError?.(new Error(errorMsg))
          
          if (this.connectReject) {
            this.connectReject(new Error(errorMsg))
            this.connectResolve = null
            this.connectReject = null
          } else {
            reject(new Error(errorMsg))
          }
        }

        this.ws.onopen = () => {
          console.log('[WebSocket] Connection opened, sending auth...')
          this.authPending = true
          this.connectResolve = resolve
          this.connectReject = (err: Error) => reject(err)
          
          // Send auth message with valid token
          try {
            const authMessage: AuthMessage = {
              type: 'auth',
              userId,
              token: validToken,
            }
            this.send(authMessage)
            console.log('[WebSocket] Auth message sent, waiting for acknowledgment...')
            this.setState('connecting')
            // Don't resolve yet - wait for auth_ack
          } catch (error) {
            console.error('[WebSocket] Failed to send auth:', error)
            this.setState('error')
            this.authPending = false
            reject(error instanceof Error ? error : new Error('Failed to send auth'))
          }
        }

        this.ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data)
            console.log('[WebSocket] Received message:', data.type, data)
            
            if (data.type === 'auth_ack') {
              const ack: AuthAckMessage = data
              
              if (ack.status === 'success') {
                this.authPending = false
                console.log('[WebSocket] Auth successful, user:', ack.userId)
                this.setState('connected')
                if (this.connectResolve) {
                  this.connectResolve()
                  this.connectResolve = null
                  this.connectReject = null
                }
              } else {
                const errorMsg = ack.error || 'Authentication failed'
                console.error('[WebSocket] Auth failed:', errorMsg)
                
                // If 401 and we have refresh token, try refreshing and retry once
                if (errorMsg.includes('401') && this.refreshToken && this.refreshToken.trim() !== '' && this.authPending) {
                  console.log('[WebSocket] 401 error, attempting token refresh and retry...')
                  try {
                    const newToken = await refreshAccessToken(this.refreshToken, this.onTokenUpdate)
                    if (newToken) {
                      // Retry connection with new token
                      this.token = newToken
                      const retryAuthMessage: AuthMessage = {
                        type: 'auth',
                        userId: this.userId!,
                        token: newToken,
                      }
                      this.send(retryAuthMessage)
                      console.log('[WebSocket] Retried auth with refreshed token')
                      return // Don't reject yet, wait for auth_ack
                    } else {
                      // Refresh token expired - handle gracefully
                      console.debug('[WebSocket] Refresh token expired during retry')
                      this.authPending = false
                    }
                  } catch (refreshError) {
                    const refreshErrorMsg = refreshError instanceof Error ? refreshError.message : 'Token refresh failed'
                    if (refreshErrorMsg.toLowerCase().includes('expired') || refreshErrorMsg.includes('401')) {
                      console.debug('[WebSocket] Refresh token expired during retry')
                    } else {
                      console.error('[WebSocket] Token refresh failed during retry:', refreshError)
                    }
                    this.authPending = false
                  }
                }
                
                this.authPending = false
                this.setState('error')
                if (this.connectReject) {
                  this.connectReject(new Error(errorMsg))
                  this.connectResolve = null
                  this.connectReject = null
                }
                // Close connection on auth failure
                if (this.ws) {
                  this.ws.close()
                }
              }
              return
            }
            
            if (data.type === 'message') {
              const incoming: IncomingMessage = data
              const message: Message = {
                messageId: incoming.data.messageId,
                senderId: incoming.data.senderId,
                recipientId: incoming.data.recipientId,
                content: incoming.data.content,
                timestamp: new Date(incoming.data.timestamp),
                type: incoming.data.type,
                direction: 'received',
              }
              console.log('[WebSocket] Received message via WebSocket:', message.messageId, 'from:', message.senderId, 'content:', message.content.substring(0, 50))
              this.callbacks.onMessage?.(message)
              return
            }
            
            if (data.type === 'notification') {
              const notification: NotificationMessage = data
              console.log('[WebSocket] Received notification:', notification)
              this.callbacks.onNotification?.(notification)
              return
            }
          } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error)
          }
        }

        // Error handler is already set up immediately after WebSocket creation
        // This prevents duplicate error handling

        this.ws.onclose = (event) => {
          const wasAuthPending = this.authPending
          const closeInfo = {
            code: event.code,
            reason: event.reason || 'No reason provided',
            wasClean: event.wasClean,
            authPending: wasAuthPending,
            url: this.url,
          }
          
          // Provide helpful error messages for common close codes
          let closeMessage = `Connection closed (code: ${event.code})`
          if (event.code === 1006) {
            closeMessage = `Connection failed - server may be down or unreachable (code: 1006). Check if events-server is running on ${this.url}`
          } else if (event.code === 1000) {
            closeMessage = 'Connection closed normally'
          } else if (event.code === 1001) {
            closeMessage = 'Connection going away'
          } else if (event.code === 1002) {
            closeMessage = 'Protocol error'
          } else if (event.code === 1003) {
            closeMessage = 'Unsupported data type'
          } else if (event.code === 1008) {
            closeMessage = 'Policy violation'
          } else if (event.code === 1011) {
            closeMessage = 'Server error'
          }
          
          console.log('[WebSocket] Connection closed', closeInfo, closeMessage)
          this.authPending = false
          
          // If auth was pending and connection closed, it likely failed
          if (wasAuthPending && this.connectReject) {
            this.connectReject(new Error('Connection closed during authentication'))
            this.connectResolve = null
            this.connectReject = null
          }
          
          this.setState('disconnected')
        }
      } catch (error) {
        this.setState('error')
        reject(error)
      }
    })
  }

  disconnect(): void {
    console.log('[WebSocket] Disconnecting...')
    this.authPending = false
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.setState('disconnected')
  }

  sendChatMessage(recipientId: string, content: string): void {
    if (this.state !== 'connected' || !this.ws) {
      throw new Error('WebSocket is not connected')
    }

    const chatMessage: ChatMessage = {
      type: 'chat',
      recipientId,
      msg: content,
    }
    console.log('[WebSocket] Sending chat message to:', recipientId)
    this.send(chatMessage)
  }

  private send(message: AuthMessage | ChatMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
    try {
      this.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error('[WebSocket] Failed to send message:', error)
      throw error
    }
  }

  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      console.log(`[WebSocket] State change: ${this.state} -> ${state}`)
      this.state = state
      this.callbacks.onStateChange?.(state)
    }
  }
}

