'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

// Global search input from the chrome bar. Submitting routes to /search?q=…
// (the search page itself is built in a follow-up commit).
export function SearchBar() {
  const router = useRouter()
  const [q, setQ] = useState('')

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = q.trim()
    if (!trimmed) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <form onSubmit={onSubmit} className="relative">
      <input
        type="text"
        placeholder="Search 中文 or English…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full bg-surface border border-[color:var(--border-soft)] rounded-md pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold"
      />
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="m21 21-4.35-4.35M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z"
        />
      </svg>
    </form>
  )
}
