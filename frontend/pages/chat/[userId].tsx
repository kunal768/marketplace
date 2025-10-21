import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import Chat from '../../components/Chat'

export default function ChatWithUser() {
  const router = useRouter()
  const { userId } = router.query
  const { messages, send, presence, setActiveChat } = useAuth()
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    if (!userId) return
    const uid = Array.isArray(userId) ? userId[0] : (userId as string)
    // set active chat for presence/cursor and clear unread
    setActiveChat(uid)
    // filter messages for this chat
    const h = messages.filter((m: any) => m.type === 'message' && ((m.data.senderId === uid) || (m.data.recipientId === uid)))
    setHistory(h.map((m: any) => m.data))
    return () => {
      setActiveChat(null)
    }
  }, [messages, userId, setActiveChat])

  function handleSend(content: string) {
    const uid = Array.isArray(userId) ? userId[0] : (userId as string)
    send('chat', { recipientId: uid, msg: content })
    // optimistic add
    setHistory((h) => [...h, { messageId: Date.now().toString(), senderId: 'me', recipientId: uid, content, timestamp: new Date().toISOString(), status: 'SENT' }])
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Chat with {userId}</h3>
          <div className="text-sm">{presence[userId as string] ? 'Online' : 'Offline'}</div>
        </div>
        <div className="chat bg-white p-4 rounded shadow">
          <Chat chatWith={Array.isArray(userId) ? userId[0] : (userId as string)} />
        </div>
      </div>
    </Layout>
  )
}

function ChatInput({ onSend }: { onSend: (s: string) => void }) {
  const [val, setVal] = useState('')
  return (
    <div className="flex gap-2">
      <input value={val} onChange={(e) => setVal(e.target.value)} className="flex-1 p-2 border rounded" onKeyDown={(e) => { if (e.key === 'Enter') { onSend(val); setVal('') } }} />
      <button className="px-3 py-2 bg-sjsu-500 text-white rounded" onClick={() => { onSend(val); setVal('') }}>Send</button>
    </div>
  )
}
