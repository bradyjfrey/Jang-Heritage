'use client'

import { Download } from 'lucide-react'
import { useState } from 'react'

type Props = {
  href: string
  // Fallback name if the response has no Content-Disposition filename.
  fallbackName: string
  children: React.ReactNode
}

type State = 'idle' | 'working' | 'error'

// Download trigger with an inline "Preparing…" indicator to the right of the
// button. The server assembles the whole archive before responding, so a plain
// link would sit silent during that gap. Fetching via JS lets us show progress
// from click until the file is in hand, then we hand the blob to the browser to
// save. Trade-off: the blob is held in browser memory briefly, fine at current
// archive sizes; revisit if exports grow into the multi-GB range.
export function DownloadButton({ href, fallbackName, children }: Props) {
  const [state, setState] = useState<State>('idle')

  async function handleClick() {
    if (state === 'working') return
    setState('working')
    try {
      const res = await fetch(href, { credentials: 'include' })
      if (!res.ok) throw new Error(`Request failed (${res.status})`)

      const blob = await res.blob()
      const disposition = res.headers.get('content-disposition') || ''
      const match = disposition.match(/filename="?([^"]+)"?/)
      const name = match?.[1] || fallbackName

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      setState('idle')
    } catch (err) {
      console.error('Download failed', err)
      setState('error')
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === 'working'}
        className="inline-flex items-center gap-1.5 bg-seal text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-black transition-colors disabled:opacity-70 disabled:cursor-wait"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        {children}
      </button>
      {state === 'working' ? (
        <span
          role="status"
          className="flex items-center gap-1.5 text-xs text-ink-soft"
        >
          <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-[color:var(--border-soft)] border-t-seal animate-spin" />
          Preparing…
        </span>
      ) : state === 'error' ? (
        <span role="alert" className="text-xs text-seal">
          Failed, try again
        </span>
      ) : null}
    </div>
  )
}
