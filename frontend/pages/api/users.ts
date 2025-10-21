import type { NextApiRequest, NextApiResponse } from 'next'

// This endpoint attempts to fetch users from orchestrator; if not available, returns a mock list.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const orchestrator = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || ''
  try {
    // Try common list endpoints
    const tryUrls = ['/api/users', '/api/users/list', '/api/users/all']
    for (const u of tryUrls) {
      try {
        const r = await fetch(orchestrator + u, { headers: { 'content-type': 'application/json' } })
        if (!r.ok) continue
        const data = await r.json()
        // If data contains users array, return it, otherwise return whole data
        if (Array.isArray(data.users)) return res.status(200).json({ users: data.users })
        if (Array.isArray(data)) return res.status(200).json({ users: data })
      } catch (e) {
        // try next
      }
    }
  } catch (e) {
    // continue to mock
  }

  // Fallback mock list
  const mock = [
    { userId: 'user-1', userName: 'Alice', email: 'alice@sjsu.edu' },
    { userId: 'user-2', userName: 'Bob', email: 'bob@sjsu.edu' },
    { userId: 'user-3', userName: 'Charlie', email: 'charlie@sjsu.edu' },
  ]
  return res.status(200).json({ users: mock })
}
