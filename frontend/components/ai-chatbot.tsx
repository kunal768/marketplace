"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { X, Send, Sparkles } from 'lucide-react'
import { useAuth } from "@/hooks/use-auth"
import { orchestratorApi } from "@/lib/api/orchestrator"

interface Message {
  role: "user" | "assistant"
  content: string
}

export function AIChatbot({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { token } = useAuth()
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRefreshToken(localStorage.getItem('frontend-refreshToken'))
    }
  }, [])

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! What are you looking for today? I can help you find textbooks, electronics, furniture, and more!",
    },
  ])
  const [input, setInput] = useState("")
  const [isSearching, setIsSearching] = useState(false)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !token || !refreshToken) return

    const userMessage = input.trim()
    setMessages([...messages, { role: "user", content: userMessage }])
    setInput("")
    setIsSearching(true)

    try {
      console.log("[v0] AI chatbot searching for:", userMessage)
      
      const response = await orchestratorApi.chatSearch(token, refreshToken, userMessage)
      
      console.log("[v0] AI chatbot full response:", response)
      console.log("[v0] AI chatbot listings:", response?.listings)
      console.log("[v0] AI chatbot listings length:", response?.listings?.length)

      if (response && Array.isArray(response.listings) && response.listings.length > 0) {
        // Emit custom event with search results to navigation
        const event = new CustomEvent("ai-search-results", {
          detail: {
            query: userMessage,
            results: response.listings.slice(0, 4), // Top 4 results
          },
        })
        window.dispatchEvent(event)

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `I found ${response.listings.length} listing${response.listings.length === 1 ? "" : "s"} matching your search! Check the search bar to see the top results.`,
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "I couldn't find any listings matching your search. Try different keywords!",
          },
        ])
      }
    } catch (error) {
      console.error("[v0] AI chatbot search error:", error)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error while searching. Please try again.",
        },
      ])
    } finally {
      setIsSearching(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed bottom-28 right-8 z-50">
      <div className="animate-spring-in-bottom-right">
        <Card className="w-full md:w-96 h-[600px] flex flex-col shadow-2xl border-2 border-border bg-card">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary to-accent">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-primary-foreground">AI Search Assistant</h3>
                <p className="text-xs text-primary-foreground/80">Powered by AI</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-primary-foreground hover:bg-primary-foreground/20 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-card">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-float-in-up`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            ))}
            {isSearching && (
              <div className="flex justify-start animate-float-in-up">
                <div className="bg-muted text-foreground rounded-2xl px-4 py-2">
                  <p className="text-sm">Searching...</p>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-4 border-t border-border bg-card">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Search for a "CMPE 202" textbook...'
                className="flex-1 bg-input border-border"
                disabled={isSearching}
              />
              <Button type="submit" size="icon" className="magnetic-button cursor-pointer" disabled={isSearching}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
