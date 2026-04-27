'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  documentId: number
  initialPinned: boolean
}

// Toggle pin state via PATCH /api/documents/<id>. Optimistic: flip local
// state immediately, revert on error. After success, refresh server data
// so home/list views reflect the change.
export function PinButton({ documentId, initialPinned }: Props) {
  const router = useRouter()
  const [pinned, setPinned] = useState(initialPinned)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    if (saving) return
    const next = !pinned
    setPinned(next)
    setSaving(true)
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: next }),
      })
      if (!res.ok) {
        setPinned(!next)
      } else {
        router.refresh()
      }
    } catch {
      setPinned(!next)
    } finally {
      setSaving(false)
    }
  }

  const label = pinned ? 'Pinned' : 'Pin'
  const title = pinned ? 'Unpin this document' : 'Pin this document'

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      title={title}
      aria-pressed={pinned}
      className={
        pinned
          ? 'shrink-0 inline-flex items-center gap-1.5 text-sm border border-seal/30 bg-seal/10 text-seal rounded-md px-3 py-1.5 hover:bg-seal hover:text-white hover:border-seal transition-colors disabled:opacity-60'
          : 'shrink-0 inline-flex items-center gap-1.5 text-sm border border-[color:var(--border-soft)] bg-surface text-ink-soft rounded-md px-3 py-1.5 hover:border-seal hover:text-seal transition-colors disabled:opacity-60'
      }
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
      </svg>
      {label}
    </button>
  )
}
