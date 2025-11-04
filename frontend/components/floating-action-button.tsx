"use client"

import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"

export function FloatingActionButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className="fixed bottom-8 right-8 z-50 h-16 w-16 rounded-full shadow-2xl fab-pulse magnetic-button cursor-pointer"
    >
      <Sparkles className="h-6 w-6" />
    </Button>
  )
}
