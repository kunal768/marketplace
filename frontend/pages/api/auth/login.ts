import type { NextApiRequest, NextApiResponse } from 'next'

// This route proxies login requests to the orchestrator to avoid storing tokens on the client.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const orchestrator = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || ''
  try {
    const r = await fetch(orchestrator + '/api/users/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req.body) })
    const data = await r.json()
    // Return the orchestrator response directly. Client will not persist tokens.
    res.status(r.status).json(data)
  } catch (err: any) {
    res.status(500).json({ error: 'proxy error', message: err.message })
  }
}
