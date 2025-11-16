import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { GlobalAIAssistant } from "@/components/global-ai-assistant"
import { Toaster } from "@/components/ui/toaster"
import { WebSocketProvider } from "@/contexts/websocket-context"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CampusMart - Student Marketplace",
  description: "Buy and sell textbooks, electronics, and more on your campus",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} font-sans antialiased`}>
        <WebSocketProvider>
          {children}
          <GlobalAIAssistant />
          <Toaster />
          <Analytics />
        </WebSocketProvider>
      </body>
    </html>
  )
}
