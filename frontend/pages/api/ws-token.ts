import type { NextApiRequest, NextApiResponse } from 'next'

// This endpoint requests a short-lived token from orchestrator for the WS handshake.
// It is stateless and does not persist anything. The token is returned in the response
// and should only be used in-memory by the browser to authenticate the WebSocket.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const orchestrator = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || ''
  // Expect caller to provide credentials (email/password) or a refresh token in the body.
  try {
    const r = await fetch(orchestrator + '/api/users/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req.body) })
    const data = await r.json()
    if (!r.ok) return res.status(r.status).json(data)
    // Return only the access token to the client (transient)
    return res.status(200).json({ token: data.token })
  } catch (err: any) {
    return res.status(500).json({ error: 'proxy error', message: err.message })
  }
}
