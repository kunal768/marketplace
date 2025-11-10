"use client"

import { useState } from "react"
import { PlanetTransition } from "@/components/planet-transition"
import { AuthForm } from "@/components/auth-form" 

export default function LoginPage() {
  const [showTransition, setShowTransition] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)

  const handleLoginSuccess = () => {
    setShowTransition(true)
  }

  const handleTransitionComplete = () => {
    window.location.href = "/home"
  }

  return (
    <>
      {showTransition && <PlanetTransition onComplete={handleTransitionComplete} />}

      <div className="min-h-screen flex flex-row items-stretch relative overflow-hidden">
        {/* Background Image */}
        {!showTransition && (
          <div className="absolute inset-0 z-0">
            <img
              src="/bg-image.jpg" 
              alt="Magic Alley" 
              className="w-full h-full object-cover object-position-right" 
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
          </div>
        )}

        {/* Logo  */}
        {!showTransition && (
          <div className="absolute top-8 left-8 z-20 flex items-center gap-2 animate-float-in-up">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-white/90 font-semibold text-lg">CampusMart</span>
          </div>
        )}

        {/* Main Content Container */}
        <div className="relative z-10 w-1/2 flex px-8 md:px-16 lg:px-24 flex-col justify-center"> 
          
          {/* Content Wrapper  */}
          {!showTransition && (
            <div className="max-w-md w-full animate-scale-in-bounce"> 
              
              <AuthForm 
              onLoginSuccess={handleLoginSuccess} 
              isFlipped={isFlipped}       
              onFlip={setIsFlipped}
              />
            </div>
          )}
        </div>
        
        <div className="w-1/2 shrink-0" />
      </div>
    </>
  )
}

