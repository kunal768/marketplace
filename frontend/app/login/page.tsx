"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, Mail, Lock } from "lucide-react"
import Link from "next/link"

export default function LoginPage() {
  const [isFlipped, setIsFlipped] = useState(false)
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState(["", "", "", "", "", ""])

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault()
    setIsFlipped(true)
  }

  const handleOtpChange = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newOtp = [...otp]
      newOtp[index] = value
      setOtp(newOtp)

      // Auto-focus next input
      if (value && index < 5) {
        const nextInput = document.getElementById(`otp-${index + 1}`)
        nextInput?.focus()
      }
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      prevInput?.focus()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float-in-up" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float-in-up stagger-2" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo and title */}
        <div className="text-center mb-8 animate-float-in-up">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent mb-4 shadow-lg">
            <span className="text-2xl font-bold text-primary-foreground">CM</span>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2 text-balance">Welcome to CampusMart</h1>
          <p className="text-muted-foreground text-lg">Your campus marketplace awaits</p>
        </div>

        {/* 3D Flip Card */}
        <div className={`flip-card ${isFlipped ? "flipped" : ""} animate-scale-in-bounce stagger-2`}>
          <div className="flip-card-inner">
            {/* Front - Email Input */}
            <div className="flip-card-front">
              <Card className="border-2 shadow-2xl">
                <CardContent className="p-8">
                  <form onSubmit={handleContinue} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-base font-semibold">
                        Your .edu Email Address
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="student@university.edu"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10 h-12 text-base"
                          required
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">We'll send you a verification code</p>
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full h-12 text-base font-semibold magnetic-button group"
                    >
                      Continue
                      <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </Button>

                    <div className="text-center text-sm text-muted-foreground">
                      Already have an account?{" "}
                      <Link href="/" className="text-primary font-semibold hover:underline">
                        Sign in
                      </Link>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Back - OTP Verification */}
            <div className="flip-card-back">
              <Card className="border-2 shadow-2xl">
                <CardContent className="p-8">
                  <form className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-4">
                        <Lock className="h-5 w-5 text-primary" />
                        <Label className="text-base font-semibold">Enter Verification Code</Label>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        We sent a 6-digit code to <span className="font-semibold text-foreground">{email}</span>
                      </p>

                      {/* OTP Input Boxes */}
                      <div className="flex gap-2 justify-center">
                        {otp.map((digit, index) => (
                          <Input
                            key={index}
                            id={`otp-${index}`}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleOtpChange(index, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                            className="w-12 h-14 text-center text-xl font-bold"
                          />
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsFlipped(false)}
                        className="text-sm text-primary font-semibold hover:underline mt-4"
                      >
                        Change email address
                      </button>
                    </div>

                    <Button type="submit" size="lg" className="w-full h-12 text-base font-semibold magnetic-button">
                      Verify & Continue
                    </Button>

                    <div className="text-center text-sm text-muted-foreground">
                      Didn't receive the code?{" "}
                      <button type="button" className="text-primary font-semibold hover:underline">
                        Resend
                      </button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground animate-float-in-up stagger-3">
          <p>By continuing, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>
    </div>
  )
}
