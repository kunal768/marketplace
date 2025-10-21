import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'

type Message = {
  messageId: string
  clientMessageId?: string
  senderId: string
  recipientId: string
  content: string
  timestamp: string
  status?: string
}

export default function Chat({ chatWith }: { chatWith: string }) {
  const { messages: wsMessages, send } = useAuth()
  const [history, setHistory] = useState<Message[]>([])
  const listRef = useRef<HTMLDivElement | null>(null)

  // process incoming WS messages and reconcile with optimistic messages
  useEffect(() => {
    wsMessages.forEach((m: any) => {
      if (m.type === 'message' && m.data) {
        const data = m.data as Message & { status?: string; clientMessageId?: string }

        // If server sends back a status inside the message data, use it to update existing optimistic messages
        if (data.status) {
          setHistory((h: Message[]) => {
            const copy = h.map((msg: Message) => {
              if (data.clientMessageId && msg.clientMessageId === data.clientMessageId) return { ...msg, status: data.status }
              if (data.messageId && msg.messageId === data.messageId) return { ...msg, status: data.status }
              return msg
            })
            return copy
          })
          // also proceed to merge/append message object in case this is a full message payload
        }

        // if server echoes back our clientMessageId, update that message
        if (data.clientMessageId) {
          setHistory((h: Message[]) => {
            const idx = h.findIndex((x: Message) => x.clientMessageId === data.clientMessageId)
            if (idx >= 0) {
              const copy = [...h]
              copy[idx] = { ...copy[idx], ...data }
              return copy
            }
            // otherwise, append as normal
            return [...h, { ...data }]
          })
        } else if (data.messageId) {
          // if server-sent message (incoming or confirmed sent), merge by messageId
          setHistory((h: Message[]) => {
            const idx = h.findIndex((x: Message) => x.messageId === data.messageId)
            if (idx >= 0) {
              const copy = [...h]
              copy[idx] = { ...copy[idx], ...data }
              return copy
            }
            // filter messages for this conversation only
            if (data.senderId === chatWith || data.recipientId === chatWith) {
              return [...h, { ...data }]
            }
            return h
          })
        }
      }
    })
  }, [wsMessages, chatWith])

  // auto-scroll to bottom on history change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [history])

  function handleSend(content: string) {
    const clientMessageId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const ts = new Date().toISOString()
    const ok = send('chat', { recipientId: chatWith, msg: content, clientMessageId })
    if (ok) {
      setHistory((h) => [...h, { messageId: clientMessageId, clientMessageId, senderId: 'me', recipientId: chatWith, content, timestamp: ts, status: 'SENT' }])
    } else {
      // show failed state
      setHistory((h) => [...h, { messageId: clientMessageId, clientMessageId, senderId: 'me', recipientId: chatWith, content, timestamp: ts, status: 'FAILED' }])
    }
  }

  return (
    <div className="chat bg-white shadow-sm rounded">
      <div className="message-list" ref={listRef}>
        {history.map((m: Message) => (
          <div key={m.messageId} className={`message ${m.senderId === 'me' ? 'out' : 'in'}`}>
            <div className="meta">{m.senderId} • {new Date(m.timestamp).toLocaleTimeString()}</div>
            <div className="content flex items-center justify-between gap-2">
              <div className="flex-1">{m.content}</div>
              {m.senderId === 'me' && (
                <div className="text-xs text-gray-400 ml-2">{m.status || 'SENT'}</div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="input">
        <MessageInput onSend={handleSend} />
      </div>
    </div>
  )
}

function MessageInput({ onSend }: { onSend: (content: string) => void }) {
  const [val, setVal] = useState('')
  return (
    <div className="message-input flex gap-2 p-2">
      <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { onSend(val); setVal('') } }} className="flex-1 p-2 border rounded" />
      <button onClick={() => { if (val.trim()) { onSend(val); setVal('') } }} className="px-3 py-2 bg-sjsu-500 text-white rounded">Send</button>
    </div>
  )
}
