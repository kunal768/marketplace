import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../context/AuthContext'

const Chat = dynamic(() => import('../components/Chat'), { ssr: false })

export default function ChatPage() {
  const router = useRouter()
  const { token } = useAuth()

  useEffect(() => {
    if (!token) {
      router.push('/login')
    }
  }, [token])

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Inbox</h2>
      <Chat chatWith={token ?? ''} />
    </div>
  )
}
