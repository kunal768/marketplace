"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight } from "lucide-react"

export function EmailForm({ onSubmit }: { onSubmit: (email: string) => void }) {
  const [email, setEmail] = useState("")

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(email)
  }

  return (
    <>
      {/* --- CM Logo --- */}
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-2xl">CM</span>
        </div>
      </div>

      {/* --- Welcome text --- */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white/90 mb-2">Welcome to CampusMart</h2>
        <p className="text-white/70">Your campus marketplace awaits</p>
      </div>


      <form onSubmit={handleContinue} className="space-y-4" autoComplete="off">
        {/* --- Email Input --- */}
        <div className="space-y-2">
          <label htmlFor="email" className="text-white/90 font-medium block">
            Your .edu Email Address
          </label>
          <div className="relative">
            <Input
              id="email"
              type="email"
              placeholder="student@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-14 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/15 focus:border-primary transition-all"
              required
              pattern=".*\.edu$"
              title="Please enter a valid .edu email address"
              autoComplete="email"
            />
          </div>
          <p className="text-sm text-white/70">We'll send you a verification code</p>
        </div>

        {/* --- Submit Button --- */}
        <Button
          type="submit"
          size="lg"
          className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 magnetic-button group"
        >
          Continue
          <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </Button>
      </form>

    </>
  )
}
