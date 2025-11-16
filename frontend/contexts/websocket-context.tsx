"use client"

import React, { createContext, useContext, ReactNode } from 'react'
import { useWebSocketConnection } from '@/hooks/use-websocket-connection'
import { useAuth } from '@/hooks/use-auth'
import type { ConnectionState, Message, NotificationMessage } from '@/lib/websocket/types'

interface WebSocketContextType {
  connectionState: ConnectionState
  messages: Message[]
  connectionError: string | null
  notification: NotificationMessage | null
  sendMessage: (recipientId: string, content: string) => { success: boolean; error?: string }
  disconnect: () => void
  connect: () => Promise<{ success: boolean; error?: string }>
  clearMessages: () => void
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { user, token, refreshToken } = useAuth()
  const ws = useWebSocketConnection(user?.user_id || null, token, refreshToken)

  return (
    <WebSocketContext.Provider value={ws}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}

