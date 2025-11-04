"use client"

import { useEffect, useState } from "react"

export function PlanetTransition({ onComplete }: { onComplete: () => void }) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onComplete()
    }, 2000)

    return () => clearTimeout(timer)
  }, [onComplete])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="relative w-32 h-32">
        {/* Central planet */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary via-accent to-primary animate-pulse shadow-2xl" />
        </div>

        {/* Orbiting smaller planets */}
        <div className="absolute inset-0 animate-spin-slow">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary/60 shadow-lg" />
        </div>

        <div className="absolute inset-0 animate-spin-slower">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-accent/60 shadow-lg" />
        </div>

        <div className="absolute inset-0 animate-spin-slowest">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary/40 shadow-lg" />
        </div>
      </div>

      <p className="absolute bottom-1/3 text-foreground/70 text-sm animate-pulse">Loading your marketplace...</p>
    </div>
  )
}
