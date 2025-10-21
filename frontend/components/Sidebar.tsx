import React from 'react'
import { useAuth } from '../context/AuthContext'
import ContactsList from './ContactsList'

export default function Sidebar() {
  const { messages, presence } = useAuth()
  const unread = messages.filter((m: any) => m.type === 'message' && m.data && m.data.senderId !== 'me').length

  // TODO: replace with server-side fetched contacts
  const contacts = [
    { userId: 'user-1', userName: 'Alice' },
    { userId: 'user-2', userName: 'Bob' },
    { userId: 'user-3', userName: 'Charlie' },
  ]

  return (
    <aside className="sidebar">
      <div className="inbox relative">
        <span className="icon text-2xl">📥</span>
        {unread > 0 && <span className="absolute -right-2 -top-2 bg-red-500 text-white rounded-full text-xs w-6 h-6 flex items-center justify-center">{unread}</span>}
      </div>
      <div className="mt-4 w-full">
        <ContactsList contacts={contacts} />
      </div>
    </aside>
  )
}
