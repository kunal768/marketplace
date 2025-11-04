"use client"

import type React from "react"

import { useState } from "react"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Send, Search, MoreVertical } from "lucide-react"

const conversations = [
  {
    id: 1,
    name: "Alice Johnson",
    avatar: "/placeholder.svg?height=40&width=40",
    lastMessage: "Is the textbook still available?",
    time: "2m ago",
    unread: 2,
    online: true,
  },
  {
    id: 2,
    name: "Bob Smith",
    avatar: "/placeholder.svg?height=40&width=40",
    lastMessage: "Thanks for the quick response!",
    time: "1h ago",
    unread: 0,
    online: false,
  },
  {
    id: 3,
    name: "Carol Davis",
    avatar: "/placeholder.svg?height=40&width=40",
    lastMessage: "Can we meet tomorrow?",
    time: "3h ago",
    unread: 1,
    online: true,
  },
]

const messages = [
  {
    id: 1,
    sender: "Alice Johnson",
    content: "Hi! Is the Calculus textbook still available?",
    time: "10:30 AM",
    isOwn: false,
  },
  { id: 2, sender: "You", content: "Yes, it's still available! Are you interested?", time: "10:32 AM", isOwn: true },
  { id: 3, sender: "Alice Johnson", content: "Great! Can I see it today?", time: "10:33 AM", isOwn: false },
  {
    id: 4,
    sender: "You",
    content: "I'm free after 3 PM. Where would you like to meet?",
    time: "10:35 AM",
    isOwn: true,
  },
]

export default function MessagesPage() {
  const [selectedConversation, setSelectedConversation] = useState(conversations[0])
  const [messageInput, setMessageInput] = useState("")

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim()) return
    // Handle send message
    setMessageInput("")
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          <div className="md:col-span-1 border border-border rounded-2xl overflow-hidden bg-card animate-slide-in-left">
            <div className="p-4 border-b border-border">
              <h2 className="text-2xl font-bold mb-4">Messages</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search conversations..." className="pl-10" />
              </div>
            </div>

            <div className="overflow-y-auto h-[calc(100%-120px)]">
              {conversations.map((conversation, index) => (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation)}
                  className={`w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors border-b border-border animate-float-in-up stagger-${index + 1} ${
                    selectedConversation.id === conversation.id ? "bg-muted" : ""
                  }`}
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={conversation.avatar || "/placeholder.svg"} />
                      <AvatarFallback>{conversation.name[0]}</AvatarFallback>
                    </Avatar>
                    {conversation.online && (
                      <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-card" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-foreground">{conversation.name}</h3>
                      <span className="text-xs text-muted-foreground">{conversation.time}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{conversation.lastMessage}</p>
                  </div>
                  {conversation.unread > 0 && (
                    <Badge className="bg-primary text-primary-foreground">{conversation.unread}</Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 border border-border rounded-2xl overflow-hidden bg-card flex flex-col animate-slide-in-right">
            {/* Chat Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedConversation.avatar || "/placeholder.svg"} />
                  <AvatarFallback>{selectedConversation.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-foreground">{selectedConversation.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedConversation.online ? "Active now" : "Offline"}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`flex ${message.isOwn ? "justify-end" : "justify-start"} animate-float-in-up stagger-${index + 1}`}
                >
                  <div className={`max-w-[70%] ${message.isOwn ? "order-2" : "order-1"}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        message.isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 px-2">{message.time}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            <form onSubmit={handleSend} className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 h-12"
                />
                <Button type="submit" size="icon" className="h-12 w-12 magnetic-button">
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
