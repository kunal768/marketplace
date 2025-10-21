import Link from 'next/link'
import Layout from '../components/Layout'
import { GetServerSideProps } from 'next'

type User = { userId: string; userName: string; email: string }

export default function Home({ users }: { users: User[] }) {
  return (
    <Layout>
      <div>
        <header className="header">
          <h1 className="text-2xl font-semibold">SJSU MarketPlace</h1>
          <Link href="/login" className="text-sjsu-500">Login</Link>
        </header>
        <section className="mt-6">
          <h2 className="text-lg font-medium">Users (mock listings)</h2>
          <ul className="mt-2 space-y-2">
            {users.map((u) => (
              <li key={u.userId} className="p-2 bg-white rounded shadow-sm">{u.userName} — {u.email}</li>
            ))}
          </ul>
        </section>
      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  // Server-side fetch users from orchestrator so the page is SSR'd
  const base = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || ''
  try {
    const r = await fetch(base + '/api/users/profile', { headers: { cookie: ctx.req.headers.cookie || '' } })
    // We don't require auth for users listing here; in your setup you can call another endpoint
    // For now we'll return an empty list if fetch fails.
    if (!r.ok) return { props: { users: [] } }
    const data = await r.json()
    // If orchestrator returns { user, role } for profile, we cannot assume a users list endpoint.
    // So keep this simple and return empty array as placeholder.
    return { props: { users: [] } }
  } catch (err) {
    return { props: { users: [] } }
  }
}
