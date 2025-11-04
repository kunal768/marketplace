"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, ArrowRight } from "lucide-react"

interface OtpFormProps {
  email: string
  onVerify: (otp: string) => void
  onBack: () => void
}

export function OtpForm({ email, onVerify, onBack }: OtpFormProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""])

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

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      prevInput?.focus()
    }
  }

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault()
    onVerify(otp.join(""))
  }

  return (
    <>
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-white/70 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        Back
      </button>

      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-2xl">CM</span>
        </div>
      </div>

      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Verify Your Email</h2>
        <p className="text-white/70">
          We sent a code to <span className="font-semibold">{email}</span>
        </p>
      </div>

      <form onSubmit={handleVerifyOtp} className="space-y-6" autoComplete="off">
        <div className="space-y-2">
          <label className="text-white font-medium block text-center">Enter 6-digit code</label>
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
                className="w-12 h-14 text-center text-2xl font-bold bg-white/10 border-white/20 text-white focus:bg-white/15 focus:border-primary transition-all"
                required
                autoComplete="one-time-code"
              />
            ))}
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 magnetic-button group"
          disabled={otp.some((digit) => !digit)}
        >
          Verify & Continue
          <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </Button>
      </form>

      <p className="text-center text-white/70 mt-6">
        Didn't receive the code?{" "}
        <button type="button" className="text-primary font-semibold hover:underline">
          Resend
        </button>
      </p>
    </>
  )
}
