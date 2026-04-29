'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type Props = {
  initialDisplayName: string
}

export function ProfileForm({ initialDisplayName }: Props) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'saving') return
    const trimmed = displayName.trim()
    if (!trimmed) {
      setErrorMessage('Display name cannot be empty.')
      setStatus('error')
      return
    }
    setErrorMessage(null)
    setStatus('saving')
    try {
      const res = await fetch('/api/me/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: trimmed }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setErrorMessage(json?.error || `Save failed (${res.status})`)
        setStatus('error')
        return
      }
      setStatus('saved')
      router.refresh()
    } catch (err) {
      console.error('Profile save failed', err)
      setErrorMessage('Network error. Try again.')
      setStatus('error')
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="block text-xs uppercase tracking-wider text-ink-faint mb-1">
          Display name
        </span>
        <input
          type="text"
          required
          maxLength={120}
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value)
            if (status === 'saved' || status === 'error') setStatus('idle')
          }}
          className="w-full bg-paper-warm border border-[color:var(--border-soft)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold"
        />
        <span className="text-xs text-ink-faint mt-1 block">
          Shown on doc pages and in editor dropdowns.
        </span>
      </label>

      {errorMessage ? (
        <div
          role="alert"
          className="text-sm text-seal rounded-md border border-seal/30 bg-seal/5 px-3 py-2"
        >
          {errorMessage}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === 'saving'}
          className="bg-seal text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {status === 'saving' ? 'Saving…' : 'Save'}
        </button>
        {status === 'saved' ? (
          <span className="text-xs text-ink-soft">Saved</span>
        ) : null}
      </div>
    </form>
  )
}
