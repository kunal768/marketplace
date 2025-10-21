export async function apiFetch(path: string, opts: RequestInit = {}) {
  const base = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || ''
  const res = await fetch(base + path, opts)
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`API error ${res.status}: ${txt}`)
  }
  return res.json()
}
