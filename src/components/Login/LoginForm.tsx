'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  redirectTo: string
}

export function LoginForm({ redirectTo }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        if (res.status === 401) {
          setError('Email or password is incorrect.')
        } else {
          setError(`Sign in failed (${res.status}).`)
        }
        return
      }
      // Cookie is now set by the server; navigate.
      router.push(redirectTo)
      router.refresh()
    } catch {
      setError('Network error. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="block text-xs uppercase tracking-wider text-ink-faint mb-1">
          Email
        </span>
        <input
          type="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-surface border border-[color:var(--border-soft)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold"
        />
      </label>
      <label className="block">
        <span className="block text-xs uppercase tracking-wider text-ink-faint mb-1">
          Password
        </span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-surface border border-[color:var(--border-soft)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold"
        />
      </label>
      {error ? (
        <div className="text-sm" style={{ color: 'var(--seal)' }}>
          {error}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-seal text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
