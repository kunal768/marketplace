import { useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { setToken } = useAuth()

  async function handleSubmit(e: any) {
    e.preventDefault()
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const data = await r.json()
      if (!r.ok) throw new Error(data.message || 'login failed')
      // Store token in memory (AuthContext) only, then redirect to chat
      if (data.token) setToken(data.token)
      router.push('/chat')
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20">
      <h2 className="text-2xl font-semibold mb-4">Login</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full p-2 border rounded" />
        </div>
        <div>
          <label className="block text-sm">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full p-2 border rounded" />
        </div>
        <div>
          <button type="submit" className="px-4 py-2 bg-sjsu-500 text-white rounded">Login</button>
        </div>
        {error && <div className="text-red-600">{error}</div>}
      </form>
    </div>
  )
}
