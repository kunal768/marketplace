'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useWebSocketConnection } from '@/hooks/use-websocket-connection'
import { useUnreadCount } from '@/hooks/use-unread-count'
import { LoginForm } from '@/components/auth/login-form'
import { SignupForm } from '@/components/auth/signup-form'
import { ConnectionStatus } from '@/components/connection/connection-status'
import { TestControls } from '@/components/testing/test-controls'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LogOut, MessageSquare } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const [showSignup, setShowSignup] = useState(false)
  const { user, token, refreshToken, isAuthenticated, login, signup, logout } = useAuth()
  
  // WebSocket connection for receiving notifications
  const {
    notification,
    connectionState,
    lastHeartbeat,
    connectionError,
    messages,
    connect,
    disconnect,
    sendHeartbeat,
    clearMessages,
  } = useWebSocketConnection(user?.user_id || null, token, refreshToken)

  // Get unread conversation count (with polling enabled on homepage)
  const { unreadConversationCount } = useUnreadCount(
    user?.user_id || null,
    token,
    refreshToken,
    true // Enable polling on homepage
  )

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        {showSignup ? (
          <SignupForm
            onSignup={async (userName, email, password) => {
              return await signup(userName, email, password)
            }}
            onSwitchToLogin={() => setShowSignup(false)}
          />
        ) : (
          <LoginForm
            onLogin={async (email, password) => {
              return await login(email, password)
            }}
            onSwitchToSignup={() => setShowSignup(true)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold">Chat Testing Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Logged in as: {user.user_name} ({user.email})
                </p>
                <p className="text-xs text-muted-foreground">User ID: {user.user_id}</p>
              </div>
              <Button
                onClick={() => router.push('/inbox')}
                variant="outline"
                size="icon"
                className="relative h-11 w-11"
              >
                <MessageSquare className="h-5 w-5" />
                {unreadConversationCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary text-primary-foreground">
                    {unreadConversationCount > 9 ? "9+" : unreadConversationCount}
                  </Badge>
                )}
              </Button>
            </div>
            <Button onClick={logout} variant="outline">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </CardContent>
        </Card>

        {/* Connection Status and Test Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ConnectionStatus
            state={connectionState}
            lastHeartbeat={lastHeartbeat}
            messagesSent={messages.filter((m) => m.direction === 'sent').length}
            messagesReceived={messages.filter((m) => m.direction === 'received').length}
            error={connectionError}
          />
          <TestControls
            connectionState={connectionState}
            onConnect={() => {
              connect().catch((err) => {
                console.error('Failed to connect:', err)
              })
            }}
            onDisconnect={disconnect}
            onSendHeartbeat={() => {
              sendHeartbeat()
            }}
            onClearMessages={clearMessages}
          />
        </div>
      </div>
    </div>
  )
}

