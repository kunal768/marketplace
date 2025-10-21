import React, { createContext, useContext, useEffect, useRef, useState } from 'react'

type EventMessage = { type: string; data: any }

type AuthContextType = {
  token: string | null
  setToken: (t: string | null) => void
  connected: boolean
  send: (kind: string, data: any) => boolean
  messages: EventMessage[]
  presence: Record<string, boolean>
  unread: Record<string, number>
  clearUnread: (userId: string) => void
  setActiveChat: (userId: string | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  // safe env access (process may not be typed in the bundler)
  const env = (typeof (globalThis as any).process !== 'undefined' ? (globalThis as any).process.env : (typeof window !== 'undefined' ? (window as any).__env : {})) || {}

  const [messages, setMessages] = useState<EventMessage[]>([])
  const [presence, setPresence] = useState<Record<string, boolean>>({})
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [activeChat, setActiveChatState] = useState<string | null>(null)
  const heartbeatRef = useRef<number | null>(null)

  // manage websocket lifecycle when token changes
  useEffect(() => {
    // cleanup existing
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (!token) {
      setConnected(false)
      return
    }

  const url = env.NEXT_PUBLIC_EVENTS_WS_URL || ''
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      ws.send(JSON.stringify({ type: 'auth', data: { token } }))
    }

    ws.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data)
        setMessages((m: EventMessage[]) => [...m, payload])
        if (payload.type === 'message' && payload.data && payload.data.senderId) {
          setUnread((u: Record<string, number>) => ({ ...u, [payload.data.senderId]: (u[payload.data.senderId] || 0) + 1 }))
        }
        // handle presence messages
        if (payload.type === 'presence' && payload.data && payload.data.userId) {
          setPresence((p: Record<string, boolean>) => ({ ...p, [payload.data.userId]: payload.data.online }))
        }
      } catch (e) {
        // ignore parse errors
      }
    }

    ws.onclose = () => {
      setConnected(false)
      // stop heartbeat
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
    }
    ws.onerror = () => {
      setConnected(false)
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
    }

    // start heartbeat when connection established
    const tryStartHeartbeat = () => {
      if (heartbeatRef.current) return
      heartbeatRef.current = window.setInterval(() => {
        const wsInner = wsRef.current
        if (wsInner && wsInner.readyState === WebSocket.OPEN) {
          wsInner.send(JSON.stringify({ type: 'presence', data: { timestamp: Date.now() } }))
          if (activeChat) {
            wsInner.send(JSON.stringify({ type: 'cursor', data: { chatWith: activeChat, ts: Date.now() } }))
          }
        }
      }, 15000)
    }
    // start immediately if open
    if (ws.readyState === WebSocket.OPEN) tryStartHeartbeat()

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [token])

  function send(kind: string, data: any) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false
    wsRef.current.send(JSON.stringify({ type: kind, data }))
    return true
  }

  function clearUnread(userId: string) {
    setUnread((u: Record<string, number>) => {
      const copy = { ...u }
      delete copy[userId]
      return copy
    })
  }

  function setActiveChat(userId: string | null) {
    setActiveChatState(userId)
    if (userId) clearUnread(userId)
    // immediately send a cursor update for this chat
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && userId) {
      wsRef.current.send(JSON.stringify({ type: 'cursor', data: { chatWith: userId, ts: Date.now() } }))
    }
  }

  return (
    <AuthContext.Provider value={{ token, setToken, connected, send, messages, presence, unread, clearUnread, setActiveChat }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
