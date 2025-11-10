"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, ArrowRight, Mail, Lock, User } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

interface AuthFormProps {
  onLoginSuccess: () => void
  isFlipped: boolean
  onFlip: (isFlipped: boolean) => void
}

export function AuthForm({ onLoginSuccess, isFlipped, onFlip }: AuthFormProps) {
  const { login, signup } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Login state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  
  // Signup state
  const [userName, setUserName] = useState("")
  const [signupEmail, setSignupEmail] = useState("")
  const [signupPassword, setSignupPassword] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await login(email, password)
    setLoading(false)

    if (result.success) {
      onLoginSuccess() // This tells the page to run the planet transition
    } else {
      setError(result.error || "Login failed")
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await signup(userName, signupEmail, signupPassword)
    setLoading(false)

    if (result.success) {
      onLoginSuccess() // This tells the page to run the planet transition
    } else {
      setError(result.error || "Signup failed")
    }
  }

  return (
    <div className="max-w-md mx-auto perspective-1000">
      <div
        className={`relative transition-transform duration-700 transform-style-3d h-[740px] ${
          isFlipped ? "rotate-y-180" : ""
        }`}
      >
        {/* Front Side - Login Form */}
        <div className={`absolute inset-0 backface-hidden ${isFlipped ? "invisible" : "visible"} flex flex-col justify-center`}>
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl">CM</span>
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white/90 mb-2">Welcome to CampusMart</h2>
            <p className="text-white/70">Your campus marketplace awaits</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/20 rounded-md text-white border border-destructive/30">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-white/90 font-medium block">
                Your .edu Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
                <Input
                  id="email"
                  type="email"
                  placeholder="student@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-14 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/15 focus:border-primary transition-all"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-white/90 font-medium block">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-14 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/15 focus:border-primary transition-all"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 magnetic-button group"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>

            <p className="text-center text-white/70 mt-6">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => onFlip(true)}
                className="text-primary font-semibold hover:underline"
              >
                Sign up
              </button>
            </p>
          </form>
        </div>

        {/* Back Side - Signup Form */}
        <div
          className={`absolute inset-0 backface-hidden rotate-y-180 flex flex-col justify-center ${
            isFlipped ? "visible" : "invisible"
          }`}
        >
          

          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl">CM</span>
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Create Your Account</h2>
            <p className="text-white/70">Join CampusMart today</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4" autoComplete="off">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/20 rounded-md text-white border border-destructive/30">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="userName" className="text-white/90 font-medium block">
                User Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
                <Input
                  id="userName"
                  type="text"
                  placeholder="John Doe"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="pl-10 h-14 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/15 focus:border-primary transition-all"
                  required
                  minLength={3}
                  maxLength={50}
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="signupEmail" className="text-white/90 font-medium block">
                Your .edu Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
                <Input
                  id="signupEmail"
                  type="email"
                  placeholder="student@university.edu"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="pl-10 h-14 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/15 focus:border-primary transition-all"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="signupPassword" className="text-white/90 font-medium block">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
                <Input
                  id="signupPassword"
                  type="password"
                  placeholder="Create a password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="pl-10 h-14 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/15 focus:border-primary transition-all"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 magnetic-button group"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Sign Up"}
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>

            <p className="text-center text-white/70 mt-6">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => onFlip(false)}
                className="text-primary font-semibold hover:underline"
              >
                Login
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
