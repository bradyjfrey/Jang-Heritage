'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

// Posts to Payload's built-in logout endpoint (clears the auth cookie),
// then sends the user back to /login. The endpoint still works with
// disableLocalStrategy: true — it doesn't log you in, it just unsets the
// session cookie.
export function SignOutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function onClick() {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/users/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      /* swallow — we're going to /login regardless */
    }
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="text-ink-soft hover:text-ink disabled:opacity-60"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
