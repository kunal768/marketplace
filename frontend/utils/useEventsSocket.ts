import { useEffect, useRef, useState } from 'react'

type EventMessage = { type: string; data: any }

export default function useEventsSocket(token: string | null) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState<EventMessage[]>([])

  useEffect(() => {
    if (!token) return
    const url = process.env.NEXT_PUBLIC_EVENTS_WS_URL || ''
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      // send auth first, keep token in-memory only
      ws.send(JSON.stringify({ type: 'auth', data: { token } }))
    }
    ws.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data)
        setMessages((m) => [...m, payload])
      } catch (e) {
        // ignore
      }
    }
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

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

  return { connected, messages, send }
}
