import React from 'react'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'

type Contact = { userId: string; userName: string }

export default function ContactsList({ contacts }: { contacts: Contact[] }) {
  const { presence, unread } = useAuth()
  return (
    <div className="space-y-2">
      {contacts.map((c) => {
        const online = presence[c.userId]
              const unreadCount = unread[c.userId] || 0
        return (
          <Link key={c.userId} href={`/chat/${c.userId}`} className="flex items-center justify-between p-2 rounded hover:bg-gray-100">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${online ? 'bg-green-400' : 'bg-gray-400'}`} />
              <div className="text-sm">{c.userName}</div>
            </div>
            {unreadCount > 0 && <div className="text-xs bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center">{unreadCount}</div>}
          </Link>
        )
      })}
    </div>
  )
}
