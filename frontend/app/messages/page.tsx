"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Send, Search, MoreVertical, Plus, Loader2, Trash2, Check } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useWebSocket } from "@/contexts/websocket-context"
import { useUnreadCount } from "@/hooks/use-unread-count"
import { orchestratorApi } from "@/lib/api/orchestrator"
import { getCurrentUserId } from "@/lib/utils/jwt"
import type { User } from "@/lib/api/types"

interface Conversation {
  otherUserId: string
  otherUserName?: string
  lastMessage: string
  lastTimestamp: string
  unreadCount: number
  isLastFromMe: boolean
}

interface ChatMessage {
  messageId: string
  senderId: string
  recipientId: string
  content: string
  timestamp: string
  type: string
  status: string
  createdAt: string
  updatedAt: string
  isRead?: boolean
}

export default function MessagesPage() {
  const router = useRouter()
  const { user, token, refreshToken, isAuthenticated, isHydrated } = useAuth()
  const {
    sendMessage: sendWebSocketMessage,
    messages: wsMessages,
    connectionState,
  } = useWebSocket()
  const { markConversationAsSeen, conversations: conversationsFromHook } = useUnreadCount(
    user?.user_id || null,
    token,
    refreshToken,
    false, // No polling on messages page
  )

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({})
  const [messageInput, setMessageInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [showNewChatDialog, setShowNewChatDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/")
    }
  }, [isAuthenticated, isHydrated, router])

  useEffect(() => {
    if (!isAuthenticated || !token) return

    const fetchConversations = async () => {
      try {
        setLoading(true)
        const response = await orchestratorApi.getConversations(token, refreshToken)
        setConversations(response.conversations)
        if (response.conversations.length > 0 && !selectedConversation) {
          setSelectedConversation(response.conversations[0])
        }
      } catch (error) {
        console.error("Failed to fetch conversations:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchConversations()
  }, [isAuthenticated, token, refreshToken])

  useEffect(() => {
    if (!isAuthenticated || !token || !selectedConversation) return

    const fetchMessages = async () => {
      if (messages[selectedConversation.otherUserId]) {
        return
      }

      try {
        const response = await orchestratorApi.getMessages(token, refreshToken, selectedConversation.otherUserId)
        const messagesWithReadStatus = response.messages.map((msg: ChatMessage) => ({
          ...msg,
          isRead: true,
        }))
        setMessages((prev) => ({
          ...prev,
          [selectedConversation.otherUserId]: messagesWithReadStatus,
        }))
        markConversationAsSeen(selectedConversation.otherUserId)
      } catch (error) {
        console.error("Failed to fetch messages:", error)
      }
    }

    fetchMessages()
  }, [selectedConversation, messages, isAuthenticated, token, refreshToken, markConversationAsSeen])

  useEffect(() => {
    if (!selectedConversation || !user?.user_id) return

    setMessages((prev) => {
      const conversationMessages = prev[selectedConversation.otherUserId]
      if (!conversationMessages) return prev

      const updatedMessages = conversationMessages.map((msg) => ({
        ...msg,
        isRead: true,
      }))

      return {
        ...prev,
        [selectedConversation.otherUserId]: updatedMessages,
      }
    })
  }, [selectedConversation, user?.user_id])

  useEffect(() => {
    if (!user?.user_id) return

    wsMessages.forEach((wsMessage) => {
      if (wsMessage.direction === "received" && wsMessage.senderId !== user.user_id) {
        const otherUserId = wsMessage.senderId
        const isCurrentlySelected = selectedConversation?.otherUserId === otherUserId

        const chatMessage: ChatMessage = {
          messageId: wsMessage.messageId,
          senderId: wsMessage.senderId,
          recipientId: wsMessage.recipientId,
          content: wsMessage.content,
          timestamp: wsMessage.timestamp.toISOString(),
          type: wsMessage.type,
          status: "delivered",
          createdAt: wsMessage.timestamp.toISOString(),
          updatedAt: wsMessage.timestamp.toISOString(),
          isRead: isCurrentlySelected, // Mark as read if conversation is open
        }

        setMessages((prev) => {
          const existingMessages = prev[otherUserId] || []
          if (existingMessages.some((m) => m.messageId === chatMessage.messageId)) {
            console.log('[MessagesPage] Skipping duplicate message:', chatMessage.messageId)
            return prev
          }
          console.log('[MessagesPage] Adding new message:', chatMessage.messageId, 'from:', otherUserId, 'content:', chatMessage.content.substring(0, 50))
          return {
            ...prev,
            [otherUserId]: [...existingMessages, chatMessage],
          }
        })

        setConversations((prev) => {
          const existing = prev.find((c) => c.otherUserId === otherUserId)

          if (existing) {
            return prev.map((c) =>
              c.otherUserId === otherUserId
                ? {
                    ...c,
                    lastMessage: chatMessage.content,
                    lastTimestamp: chatMessage.timestamp,
                    unreadCount: isCurrentlySelected ? 0 : c.unreadCount + 1,
                    isLastFromMe: false,
                  }
                : c,
            )
          }
          return [
            ...prev,
            {
              otherUserId,
              otherUserName: undefined,
              lastMessage: chatMessage.content,
              lastTimestamp: chatMessage.timestamp,
              unreadCount: isCurrentlySelected ? 0 : 1,
              isLastFromMe: false,
            },
          ]
        })

        if (isCurrentlySelected) {
          markConversationAsSeen(otherUserId)
        }
      }
    })
  }, [wsMessages, user?.user_id, selectedConversation, markConversationAsSeen])

  useEffect(() => {
    if (selectedConversation && messages[selectedConversation.otherUserId]) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, selectedConversation])

  useEffect(() => {
    if (!showNewChatDialog || !searchQuery.trim() || !token) {
      setSearchResults([])
      return
    }

    const searchUsers = async () => {
      setIsSearching(true)
      try {
        const results = await orchestratorApi.searchUsers(token, refreshToken, searchQuery)
        setSearchResults(results.users.filter((u) => u.user_id !== user?.user_id))
      } catch (error) {
        console.error("Failed to search users:", error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }

    const debounceTimeout = setTimeout(searchUsers, 300)
    return () => clearTimeout(debounceTimeout)
  }, [searchQuery, showNewChatDialog, token, refreshToken, user?.user_id])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim() || !selectedConversation || !user?.user_id) return

    const content = messageInput.trim()
    setMessageInput("")

    if (connectionState === "connected") {
      const result = sendWebSocketMessage(selectedConversation.otherUserId, content)
      if (result.success) {
        const newMessage: ChatMessage = {
          messageId: `temp-${Date.now()}`,
          senderId: user.user_id,
          recipientId: selectedConversation.otherUserId,
          content,
          timestamp: new Date().toISOString(),
          type: "text",
          status: "sending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isRead: false,
        }

        setMessages((prev) => ({
          ...prev,
          [selectedConversation.otherUserId]: [...(prev[selectedConversation.otherUserId] || []), newMessage],
        }))

        setConversations((prev) => {
          return prev.map((c) =>
            c.otherUserId === selectedConversation.otherUserId
              ? {
                  ...c,
                  lastMessage: content,
                  lastTimestamp: newMessage.timestamp,
                  isLastFromMe: true,
                }
              : c,
          )
        })

        setTimeout(() => {
          setMessages((prev) => ({
            ...prev,
            [selectedConversation.otherUserId]: prev[selectedConversation.otherUserId].map((msg) =>
              msg.messageId === newMessage.messageId ? { ...msg, isRead: true } : msg,
            ),
          }))
        }, 2000)
      } else {
        console.error("Failed to send message:", result.error)
      }
    } else {
      console.warn("WebSocket not connected. Cannot send message.")
    }
  }

  const handleStartConversation = (selectedUser: User) => {
    const existingConversation = conversations.find((conv) => conv.otherUserId === selectedUser.user_id)

    if (existingConversation) {
      setSelectedConversation(existingConversation)
      markConversationAsSeen(existingConversation.otherUserId)
    } else {
      const newConversation: Conversation = {
        otherUserId: selectedUser.user_id,
        otherUserName: selectedUser.user_name,
        lastMessage: "Start a conversation",
        lastTimestamp: new Date().toISOString(),
        unreadCount: 0,
        isLastFromMe: false,
      }
      setConversations((prev) => [newConversation, ...prev])
      setSelectedConversation(newConversation)
      setMessages((prev) => ({ ...prev, [selectedUser.user_id]: [] }))
    }

    setShowNewChatDialog(false)
    setSearchQuery("")
    setSearchResults([])
  }


  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const currentUserId = getCurrentUserId()

  const selectedMessages = selectedConversation ? messages[selectedConversation.otherUserId] || [] : []
  const selectedConversationName =
    selectedConversation?.otherUserName ||
    (selectedConversation ? `User ${selectedConversation.otherUserId.slice(0, 8)}` : "Select a conversation")

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-6">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-6">
          <p className="text-muted-foreground">Loading conversations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          <div className="md:col-span-1 border border-border rounded-2xl overflow-hidden bg-card animate-slide-in-left">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Messages</h2>
                <Button onClick={() => setShowNewChatDialog(true)} size="sm" className="magnetic-button">
                  <Plus className="h-4 w-4 mr-1" />
                  New
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search conversations..." className="pl-10" />
              </div>
            </div>

            <div className="overflow-y-auto h-[calc(100%-120px)]">
              {conversations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <p>No conversations yet</p>
                </div>
              ) : (
                conversations.map((conversation, index) => {
                  const isSelected = selectedConversation?.otherUserId === conversation.otherUserId
                  // Source of truth for unread counts comes from useUnreadCount (same as Navigation)
                  const unreadFromHook =
                    (Array.isArray(conversationsFromHook)
                      ? conversationsFromHook.find((c) => c.otherUserId === conversation.otherUserId)?.unreadCount
                      : undefined) ?? conversation.unreadCount
                  const unreadToDisplay = isSelected ? 0 : (unreadFromHook || 0)
                  return (
                    <button
                      key={conversation.otherUserId}
                      onClick={() => {
                        setSelectedConversation(conversation)
                        markConversationAsSeen(conversation.otherUserId)
                        setConversations((prev) =>
                          prev.map((conv) =>
                            conv.otherUserId === conversation.otherUserId ? { ...conv, unreadCount: 0 } : conv,
                          ),
                        )
                      }}
                      className={`w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors border-b border-border animate-float-in-up stagger-${index + 1} ${
                        isSelected ? "bg-muted" : ""
                      }`}
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src="/placeholder.svg?height=40&width=40" />
                          <AvatarFallback>
                            {conversation.otherUserName?.[0] || conversation.otherUserId[0]}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-foreground">
                            {conversation.otherUserName || `User ${conversation.otherUserId.slice(0, 8)}`}
                          </h3>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(conversation.lastTimestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {conversation.isLastFromMe && <span className="text-muted-foreground/70">You: </span>}
                          {conversation.lastMessage}
                        </p>
                      </div>
                      {unreadToDisplay > 0 && (
                        <Badge className="bg-primary text-primary-foreground">{unreadToDisplay}</Badge>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div className="md:col-span-2 border border-border rounded-2xl overflow-hidden bg-card flex flex-col animate-slide-in-right">
            {selectedConversation ? (
              <>
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src="/placeholder.svg?height=40&width=40" />
                      <AvatarFallback>{selectedConversationName[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-foreground">{selectedConversationName}</h3>
                      <p className="text-xs text-muted-foreground">Offline</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={isDeleting}>
                        <MoreVertical className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {}}
                        className="text-destructive focus:text-destructive cursor-pointer"
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {isDeleting ? "Deleting..." : "Delete Chat"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {selectedMessages.length === 0 ? (
                    <p className="text-center text-muted-foreground">No messages yet</p>
                  ) : (
                    selectedMessages.map((message, index) => {
                      const isOwn = currentUserId === message.senderId
                      return (
                        <div
                          key={message.messageId}
                          className={`flex ${isOwn ? "justify-end" : "justify-start"} animate-float-in-up stagger-${index + 1}`}
                        >
                          <div className={`max-w-[70%] ${isOwn ? "order-2" : "order-1"}`}>
                            <div
                              className={`rounded-2xl px-4 py-3 ${
                                isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                              }`}
                            >
                              <p className="text-sm">{message.content}</p>
                            </div>
                            <div className="flex items-center gap-1 mt-1 px-2">
                              <p className="text-xs text-muted-foreground">{formatMessageTime(message.timestamp)}</p>
                              {isOwn && message.isRead && <Check className="h-3 w-3 text-primary" />}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSend} className="p-4 border-t border-border">
                  {connectionState !== "connected" && (
                    <p className="text-xs text-muted-foreground mb-2">
                      WebSocket not connected. Messages may not be sent.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 h-12"
                      disabled={connectionState !== "connected"}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="h-12 w-12 magnetic-button"
                      disabled={connectionState !== "connected" || !messageInput.trim()}
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-muted-foreground">Select a conversation to start messaging</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] bg-card/95 backdrop-blur-xl border-2 border-border/50 shadow-2xl">
          <DialogHeader>
            <DialogTitle>Start New Chat</DialogTitle>
            <DialogDescription>Search for a user by name to start a conversation</DialogDescription>
          </DialogHeader>

          <Command className="rounded-lg border min-h-[400px]" shouldFilter={false}>
            <CommandInput placeholder="Search users by name..." value={searchQuery} onValueChange={setSearchQuery} />
            <CommandList>
              {isSearching ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : searchQuery && searchResults.length === 0 ? (
                <CommandEmpty>No users found</CommandEmpty>
              ) : searchResults.length > 0 ? (
                <CommandGroup heading="Users">
                  {searchResults.map((user) => (
                    <CommandItem
                      key={user.user_id}
                      onSelect={() => handleStartConversation(user)}
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted"
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src="/placeholder.svg?height=48&width=48" />
                        <AvatarFallback>{user.user_name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold">{user.user_name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">Start typing to search for users</div>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  )
}
