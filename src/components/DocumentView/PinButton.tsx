'use client'

import { Pin } from 'lucide-react'
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
          ? 'shrink-0 inline-flex items-center gap-1.5 text-sm border border-seal bg-seal text-white rounded-md px-3 py-[9px] hover:bg-seal/10 hover:text-seal hover:border-seal/30 transition-colors disabled:opacity-60'
          : 'shrink-0 inline-flex items-center gap-1.5 text-sm border border-[color:var(--border-soft)] bg-surface text-ink-soft rounded-md px-3 py-[9px] hover:border-seal hover:text-seal transition-colors disabled:opacity-60'
      }
    >
      <Pin
        className="w-4 h-4"
        fill={pinned ? 'currentColor' : 'none'}
        aria-hidden="true"
      />
      {label}
    </button>
  )
}
