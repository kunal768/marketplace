'use client'

import type React from 'react'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useWebSocketConnection } from '@/hooks/use-websocket-connection'
import { useUnreadCount } from '@/hooks/use-unread-count'
import { orchestratorApi } from '@/lib/api/orchestrator'
import { getCurrentUserId } from '@/lib/utils/jwt'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Send, ArrowLeft, ChevronDown, ChevronUp, UserPlus } from 'lucide-react'

interface Conversation {
  otherUserId: string
  otherUserName?: string
  lastMessage: string
  lastTimestamp: string
  unreadCount: number
  isLastFromMe: boolean
}

interface ChatMessage {
  id?: string
  messageId: string
  senderId: string
  recipientId: string
  content: string
  timestamp: string
  type: string
  status: string
  createdAt: string
  updatedAt: string
}

export default function InboxPage() {
  const router = useRouter()
  const { user, token, refreshToken, isAuthenticated, isHydrated } = useAuth()
  const { sendMessage: sendWebSocketMessage, messages: wsMessages, connectionState } = useWebSocketConnection(
    user?.user_id || null,
    token,
    refreshToken
  )
  const { markConversationAsSeen } = useUnreadCount(
    user?.user_id || null,
    token,
    refreshToken,
    false // No polling on inbox page
  )
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({})
  const [messageInputs, setMessageInputs] = useState<Record<string, string>>({})
  const [newRecipientId, setNewRecipientId] = useState('')
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expandedConversations, setExpandedConversations] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Redirect if not authenticated (only after hydration to avoid premature redirect)
  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, isHydrated, router])

  // Fetch conversations on mount
  useEffect(() => {
    if (!isAuthenticated || !token) return

    const fetchConversations = async () => {
      try {
        setLoading(true)
        const response = await orchestratorApi.getConversations(token, refreshToken)
        setConversations(response.conversations)
      } catch (error) {
        console.error('Failed to fetch conversations:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchConversations()
  }, [isAuthenticated, token, refreshToken])

  // Fetch messages when a conversation is expanded
  useEffect(() => {
    if (!isAuthenticated || !token) return

    const fetchMessages = async (otherUserId: string) => {
      if (messages[otherUserId]) {
        return // Already loaded
      }

      try {
        const response = await orchestratorApi.getMessages(token, refreshToken, otherUserId)
        setMessages((prev) => ({
          ...prev,
          [otherUserId]: response.messages,
        }))
      } catch (error) {
        console.error('Failed to fetch messages:', error)
      }
    }

    expandedConversations.forEach((userId) => {
      fetchMessages(userId)
    })
  }, [expandedConversations, messages, isAuthenticated, token, refreshToken])

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!user?.user_id) return

    wsMessages.forEach((wsMessage) => {
      // Only process received messages (not ones we sent)
      if (wsMessage.direction === 'received' && wsMessage.senderId !== user.user_id) {
        const otherUserId = wsMessage.senderId
        const chatMessage: ChatMessage = {
          messageId: wsMessage.messageId,
          senderId: wsMessage.senderId,
          recipientId: wsMessage.recipientId,
          content: wsMessage.content,
          timestamp: wsMessage.timestamp.toISOString(),
          type: wsMessage.type,
          status: 'delivered',
          createdAt: wsMessage.timestamp.toISOString(),
          updatedAt: wsMessage.timestamp.toISOString(),
        }

        setMessages((prev) => {
          const existingMessages = prev[otherUserId] || []
          // Check if message already exists to avoid duplicates
          if (existingMessages.some((m) => m.messageId === chatMessage.messageId)) {
            return prev
          }
          return {
            ...prev,
            [otherUserId]: [...existingMessages, chatMessage],
          }
        })

        // Update conversation list with new message
        setConversations((prev) => {
          const existing = prev.find((c) => c.otherUserId === otherUserId)
          if (existing) {
            return prev.map((c) =>
              c.otherUserId === otherUserId
                ? {
                    ...c,
                    lastMessage: chatMessage.content,
                    lastTimestamp: chatMessage.timestamp,
                    unreadCount: c.unreadCount + 1,
                    isLastFromMe: false,
                  }
                : c
            )
          }
          // New conversation
          return [
            ...prev,
            {
              otherUserId,
              otherUserName: undefined,
              lastMessage: chatMessage.content,
              lastTimestamp: chatMessage.timestamp,
              unreadCount: 1,
              isLastFromMe: false,
            },
          ]
        })
      }
    })
  }, [wsMessages, user?.user_id])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (selectedConversation && messages[selectedConversation]) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, selectedConversation])

  const toggleConversation = (otherUserId: string) => {
    setExpandedConversations((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(otherUserId)) {
        newSet.delete(otherUserId)
        setSelectedConversation(null)
      } else {
        newSet.add(otherUserId)
        setSelectedConversation(otherUserId)
        // Mark conversation as seen when expanded
        markConversationAsSeen(otherUserId)
        // Update local conversation state to clear unread count
        setConversations((prev) =>
          prev.map((conv) =>
            conv.otherUserId === otherUserId
              ? { ...conv, unreadCount: 0 }
              : conv
          )
        )
      }
      return newSet
    })
  }

  const handleStartNewConversation = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRecipientId.trim() || !user?.user_id) return

    const recipientId = newRecipientId.trim()
    
    // Don't allow messaging yourself
    if (recipientId === user.user_id) {
      alert('You cannot message yourself')
      return
    }

    // Check if conversation already exists
    const existingConversation = conversations.find((c) => c.otherUserId === recipientId)
    
    if (existingConversation) {
      // Open existing conversation
      if (!expandedConversations.has(recipientId)) {
        toggleConversation(recipientId)
      }
    } else {
      // Create new conversation entry
      const newConversation: Conversation = {
        otherUserId: recipientId,
        otherUserName: undefined,
        lastMessage: '',
        lastTimestamp: new Date().toISOString(),
        unreadCount: 0,
        isLastFromMe: false,
      }
      setConversations((prev) => [newConversation, ...prev])
      // Expand the new conversation
      setExpandedConversations((prev) => {
        const newSet = new Set(prev)
        newSet.add(recipientId)
        return newSet
      })
      setSelectedConversation(recipientId)
    }

    setNewRecipientId('')
    setShowNewConversation(false)
  }

  const handleSend = async (e: React.FormEvent, otherUserId: string) => {
    e.preventDefault()
    const messageInput = messageInputs[otherUserId] || ''
    if (!messageInput.trim() || !selectedConversation || !user?.user_id) return

    const content = messageInput.trim()
    setMessageInputs((prev) => ({ ...prev, [otherUserId]: '' }))

    // Send message via WebSocket
    if (connectionState === 'connected') {
      const result = sendWebSocketMessage(otherUserId, content)
      if (result.success) {
        // Add message to local state immediately for optimistic UI
        const newMessage: ChatMessage = {
          messageId: `temp-${Date.now()}`,
          senderId: user.user_id,
          recipientId: otherUserId,
          content,
          timestamp: new Date().toISOString(),
          type: 'text',
          status: 'sending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        setMessages((prev) => ({
          ...prev,
          [otherUserId]: [...(prev[otherUserId] || []), newMessage],
        }))

        // Update conversation list
        setConversations((prev) => {
          return prev.map((c) =>
            c.otherUserId === otherUserId
              ? {
                  ...c,
                  lastMessage: content,
                  lastTimestamp: newMessage.timestamp,
                  isLastFromMe: true,
                }
              : c
          )
        })
      } else {
        console.error('Failed to send message:', result.error)
        // Could show an error toast here
      }
    } else {
      console.warn('WebSocket not connected. Cannot send message.')
      // Could show a warning to the user
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const currentUserId = getCurrentUserId()

  // Show loading state while hydrating or if not authenticated
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground">Loading conversations...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-3xl font-bold text-foreground">Inbox</h1>
            </div>
              <Button
                onClick={() => setShowNewConversation(!showNewConversation)}
                variant="default"
                className="flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                New Message
              </Button>
            </div>

            {/* New Conversation Form */}
            {showNewConversation && (
              <Card className="mb-4 border-primary/20">
                <CardContent className="p-4">
                  <form onSubmit={handleStartNewConversation} className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Recipient User ID
                      </label>
                      <Input
                        value={newRecipientId}
                        onChange={(e) => setNewRecipientId(e.target.value)}
                        placeholder="Enter user ID to message..."
                        className="w-full"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowNewConversation(false)
                          setNewRecipientId('')
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={!newRecipientId.trim() || newRecipientId.trim() === user?.user_id}
                      >
                        Start Conversation
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <p className="text-muted-foreground text-lg">No conversations yet</p>
                <p className="text-muted-foreground text-sm mt-2">Start a conversation by messaging a user</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conversation) => {
                  const isExpanded = expandedConversations.has(conversation.otherUserId)
                  const conversationMessages = messages[conversation.otherUserId] || []

                  return (
                    <Card key={conversation.otherUserId} className="overflow-hidden">
                      {/* Conversation Preview */}
                      <button
                        onClick={() => toggleConversation(conversation.otherUserId)}
                        className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
                      >
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={`/placeholder.svg?height=48&width=48`} />
                          <AvatarFallback>
                            {conversation.otherUserName?.[0] || conversation.otherUserId[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-semibold text-foreground">
                              {conversation.otherUserName || `User ${conversation.otherUserId.slice(0, 8)}`}
                            </h3>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {formatTime(conversation.lastTimestamp)}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-muted-foreground truncate flex-1">
                              {conversation.isLastFromMe && (
                                <span className="text-muted-foreground/70">You: </span>
                              )}
                              {conversation.lastMessage}
                            </p>
                            {conversation.unreadCount > 0 && (
                              <Badge className="bg-primary text-primary-foreground">
                                {conversation.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Expanded Messages */}
                      {isExpanded && (
                        <div className="border-t border-border flex flex-col max-h-[500px]">
                          {/* Messages Area */}
                          <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {conversationMessages.length === 0 ? (
                              <p className="text-center text-muted-foreground">No messages yet</p>
                            ) : (
                              conversationMessages.map((message) => {
                                const isOwn = currentUserId === message.senderId
                                return (
                                  <div
                                    key={message.messageId}
                                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                                  >
                                    <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
                                      <div
                                        className={`rounded-2xl px-4 py-3 ${
                                          isOwn
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-foreground'
                                        }`}
                                      >
                                        <p className="text-sm">{message.content}</p>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1 px-2">
                                        {formatMessageTime(message.timestamp)}
                                      </p>
                                    </div>
                                  </div>
                                )
                              })
                            )}
                            <div ref={messagesEndRef} />
                          </div>

                          {/* Message Input */}
                          <form
                            onSubmit={(e) => handleSend(e, conversation.otherUserId)}
                            className="p-4 border-t border-border"
                          >
                            {connectionState !== 'connected' && (
                              <p className="text-xs text-muted-foreground mb-2">
                                WebSocket not connected. Messages may not be sent.
                              </p>
                            )}
                            <div className="flex gap-2">
                              <Input
                                value={messageInputs[conversation.otherUserId] || ''}
                                onChange={(e) =>
                                  setMessageInputs((prev) => ({
                                    ...prev,
                                    [conversation.otherUserId]: e.target.value,
                                  }))
                                }
                                placeholder="Type a message..."
                                className="flex-1 h-12"
                                disabled={connectionState !== 'connected'}
                              />
                              <Button
                                type="submit"
                                size="icon"
                                className="h-12 w-12"
                                disabled={
                                  connectionState !== 'connected' ||
                                  !(messageInputs[conversation.otherUserId] || '').trim()
                                }
                              >
                                <Send className="h-5 w-5" />
                              </Button>
                            </div>
                          </form>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

