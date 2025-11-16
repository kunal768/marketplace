import { useState, useEffect, useCallback, useRef } from 'react'
import { orchestratorApi } from '@/lib/api/orchestrator'
import { useWebSocket } from '@/contexts/websocket-context'

const STORAGE_KEY_PREFIX = 'frontend-conversationSeen-'
const POLL_INTERVAL = 30000 // 30 seconds

interface Conversation {
  otherUserId: string
  otherUserName?: string
  lastMessage: string
  lastTimestamp: string
  unreadCount: number
  isLastFromMe: boolean
}

export function useUnreadCount(
  userId: string | null,
  token: string | null,
  refreshToken: string | null,
  enablePolling: boolean = false
) {
  const [unreadConversationCount, setUnreadConversationCount] = useState(0)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const { notification, messages: wsMessages } = useWebSocket()
  const processedMessageIdsRef = useRef<Set<string>>(new Set())

  // Get seen timestamp for a conversation from localStorage
  const getConversationSeenTimestamp = useCallback((otherUserId: string): string | null => {
    if (typeof window === 'undefined') return null
    const key = `${STORAGE_KEY_PREFIX}${otherUserId}`
    return localStorage.getItem(key)
  }, [])

  // Calculate unread conversation count
  const calculateUnreadCount = useCallback((convs: Conversation[]): number => {
    return convs.filter((conv) => {
      // Must have unread messages
      if (conv.unreadCount <= 0) return false

      // Check if conversation has been seen
      const seenTimestamp = getConversationSeenTimestamp(conv.otherUserId)
      if (!seenTimestamp) {
        // Not seen, include in count
        return true
      }

      // Check if last message timestamp is after seen timestamp
      const lastTimestamp = new Date(conv.lastTimestamp)
      const seen = new Date(seenTimestamp)
      
      // If last message is after seen timestamp, it's unread
      return lastTimestamp > seen
    }).length
  }, [getConversationSeenTimestamp])

  // Mark a conversation as seen
  const markConversationAsSeen = useCallback((otherUserId: string) => {
    if (typeof window === 'undefined') return
    
    const key = `${STORAGE_KEY_PREFIX}${otherUserId}`
    const now = new Date().toISOString()
    localStorage.setItem(key, now)
    try {
      // Notify other hook instances (e.g., Navigation) that a conversation was seen
      window.dispatchEvent(new CustomEvent('conversation-seen', { detail: { otherUserId, seenAt: now } }))
    } catch {
      // no-op if CustomEvent is not available
    }

    // Update local state immediately and recalculate count
    setConversations((prev) => {
      const updated = prev.map((conv) =>
        conv.otherUserId === otherUserId
          ? { ...conv, unreadCount: 0 }
          : conv
      )
      // Recalculate unread count with updated conversations
      const count = calculateUnreadCount(updated)
      setUnreadConversationCount(count)
      return updated
    })
  }, [calculateUnreadCount])

  // Fetch conversations and calculate unread count
  const refreshUnreadCount = useCallback(async () => {
    if (!token || !userId) {
      setUnreadConversationCount(0)
      setLoading(false)
      return
    }

    try {
      const response = await orchestratorApi.getConversations(token, refreshToken)
      const fetchedConversations = response.conversations.map((conv: any) => ({
        otherUserId: conv.otherUserId,
        otherUserName: conv.otherUserName,
        lastMessage: conv.lastMessage,
        lastTimestamp: conv.lastTimestamp,
        unreadCount: conv.unreadCount || 0,
        isLastFromMe: conv.isLastFromMe || false,
      }))

      setConversations(fetchedConversations)
      const count = calculateUnreadCount(fetchedConversations)
      setUnreadConversationCount(count)
    } catch (error) {
      console.error('[useUnreadCount] Failed to fetch conversations:', error)
    } finally {
      setLoading(false)
    }
  }, [token, refreshToken, userId, calculateUnreadCount])

  // Initial fetch on mount
  useEffect(() => {
    refreshUnreadCount()
  }, [refreshUnreadCount])

  // Listen to WebSocket notifications and refresh
  useEffect(() => {
    if (notification) {
      // WebSocket notification received, refresh conversations
      refreshUnreadCount()
    }
  }, [notification, refreshUnreadCount])

  // Listen to incoming messages and update unread count optimistically
  useEffect(() => {
    if (!userId) return

    let hasNewMessages = false

    // Process new received messages
    wsMessages.forEach((msg) => {
      // Only process received messages that we haven't seen before
      if (
        msg.direction === 'received' &&
        msg.recipientId === userId &&
        !processedMessageIdsRef.current.has(msg.messageId)
      ) {
        processedMessageIdsRef.current.add(msg.messageId)
        hasNewMessages = true
        const senderId = msg.senderId

        // Check if this conversation has been seen
        const seenTimestamp = getConversationSeenTimestamp(senderId)
        const messageTimestamp = msg.timestamp

        // If conversation hasn't been seen, or message is newer than seen timestamp
        if (!seenTimestamp || messageTimestamp > new Date(seenTimestamp)) {
          console.log('[useUnreadCount] New unread message received from:', senderId)
          
          // Optimistically update conversations and count
          setConversations((prev) => {
            const existing = prev.find((c) => c.otherUserId === senderId)
            
            if (existing) {
              // Update existing conversation
              const updated = prev.map((c) =>
                c.otherUserId === senderId
                  ? {
                      ...c,
                      lastMessage: msg.content,
                      lastTimestamp: messageTimestamp.toISOString(),
                      unreadCount: c.unreadCount + 1,
                      isLastFromMe: false,
                    }
                  : c
              )
              
              // Recalculate count
              const newCount = calculateUnreadCount(updated)
              console.log('[useUnreadCount] Updated unread count to:', newCount)
              setUnreadConversationCount(newCount)
              
              return updated
            } else {
              // New conversation - definitely unread
              const newConv: Conversation = {
                otherUserId: senderId,
                otherUserName: undefined,
                lastMessage: msg.content,
                lastTimestamp: messageTimestamp.toISOString(),
                unreadCount: 1,
                isLastFromMe: false,
              }
              
              const updated = [newConv, ...prev]
              const newCount = calculateUnreadCount(updated)
              console.log('[useUnreadCount] New conversation, unread count:', newCount)
              setUnreadConversationCount(newCount)
              
              return updated
            }
          })
        }
      }
    })

    // Also refresh from API in background to ensure accuracy (but don't block)
    // Use a small delay to batch multiple rapid messages
    if (hasNewMessages) {
      const timeoutId = setTimeout(() => {
        refreshUnreadCount()
      }, 1000)

      return () => clearTimeout(timeoutId)
    }
  }, [wsMessages, userId, getConversationSeenTimestamp, calculateUnreadCount, refreshUnreadCount])

  // Listen for cross-component/localStorage updates to seen state
  useEffect(() => {
    const onConversationSeen = () => {
      // Recompute from API to ensure accuracy
      refreshUnreadCount()
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith(STORAGE_KEY_PREFIX)) {
        refreshUnreadCount()
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('conversation-seen', onConversationSeen as EventListener)
      window.addEventListener('storage', onStorage)
      return () => {
        window.removeEventListener('conversation-seen', onConversationSeen as EventListener)
        window.removeEventListener('storage', onStorage)
      }
    }
  }, [refreshUnreadCount])

  // Polling when enabled (e.g., on homepage)
  useEffect(() => {
    if (enablePolling && token && userId) {
      // Clear any existing interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }

      // Set up polling
      pollingIntervalRef.current = setInterval(() => {
        refreshUnreadCount()
      }, POLL_INTERVAL)

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      }
    } else {
      // Disable polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [enablePolling, token, userId, refreshUnreadCount])

  return {
    unreadConversationCount,
    conversations,
    loading,
    refreshUnreadCount,
    markConversationAsSeen,
  }
}

