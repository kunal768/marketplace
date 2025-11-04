"use client"

import { useState } from "react"
import { EmailForm } from "./email-form" 
import { OtpForm } from "./otp-form"   

interface AuthFormProps {
  onLoginSuccess: () => void
}

export function AuthForm({ onLoginSuccess }: AuthFormProps) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [email, setEmail] = useState("")

  const handleEmailSubmit = (submittedEmail: string) => {
    setEmail(submittedEmail)
    // trigger your API call to send the OTP here
    setIsFlipped(true)
  }

  const handleOtpVerify = (otp: string) => {
    // trigger your API to verify the OTP here
    // For now, we just assume it's successful
    console.log("Verifying OTP:", otp)
    onLoginSuccess() // This tells the page to run the planet transition
  }

  const handleBack = () => {
    setIsFlipped(false)
  }

  return (
    <div className="max-w-md mx-auto perspective-1000">
      <div
        className={`relative transition-transform duration-700 transform-style-3d ${
          isFlipped ? "rotate-y-180" : ""
        }`}
      >
        {/* Front Side - Email Input */}
        <div className={`backface-hidden ${isFlipped ? "invisible" : "visible"}`}>
          <EmailForm onSubmit={handleEmailSubmit} />
        </div>

        {/* Back Side - OTP Verification */}
        <div
          className={`absolute inset-0 backface-hidden rotate-y-180 ${
            isFlipped ? "visible" : "invisible"
          }`}
        >
          <OtpForm
            email={email}
            onVerify={handleOtpVerify}
            onBack={handleBack}
          />
        </div>
      </div>
    </div>
  )
}
