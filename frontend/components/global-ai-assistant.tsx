"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { FloatingActionButton } from "./floating-action-button"
import { AIChatbot } from "./ai-chatbot"

export function GlobalAIAssistant() {
  const [isChatbotOpen, setIsChatbotOpen] = useState(false)
  const pathname = usePathname()
  const chatbotRef = useRef<HTMLDivElement>(null)

  const isLoginPage = pathname === "/"

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (chatbotRef.current && !chatbotRef.current.contains(event.target as Node)) {
        setIsChatbotOpen(false)
      }
    }

    if (isChatbotOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isChatbotOpen])

  if (isLoginPage) return null

  return (
    <>
      <FloatingActionButton onClick={() => setIsChatbotOpen(true)} />
      <div ref={chatbotRef}>
        <AIChatbot isOpen={isChatbotOpen} onClose={() => setIsChatbotOpen(false)} />
      </div>
    </>
  )
}
