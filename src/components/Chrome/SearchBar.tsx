'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

// Global search input from the chrome bar. Submitting routes to /search?q=….
// On /search the bar mirrors the current `q` so users see what they searched
// (the Google pattern); on other pages it starts empty.
export function SearchBar() {
  const router = useRouter()
  const sp = useSearchParams()
  const urlQ = sp.get('q') || ''
  const [q, setQ] = useState(urlQ)
  // Track urlQ so we can resync local state when the URL changes externally
  // (back/forward, sidebar filter changes, etc.). This is React's blessed
  // "derive state from props" pattern — guarded setState during render
  // avoids the cascading re-render that an effect-based sync would cause.
  const [trackedUrlQ, setTrackedUrlQ] = useState(urlQ)
  if (urlQ !== trackedUrlQ) {
    setTrackedUrlQ(urlQ)
    setQ(urlQ)
  }

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
        className="w-full bg-surface border border-[color:var(--border-soft)] rounded-md pl-10 pr-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold"
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
