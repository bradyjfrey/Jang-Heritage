'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog'

type Props = {
  documentId: number
  isNote: boolean
}

// Sidebar actions shown on a trashed entry's read-only page. Restore clears
// the trash flag and returns the entry to the archive; Delete Forever (behind
// a warning modal) permanently removes the entry, its transcription/translation,
// and every image file from R2.
export function TrashActions({ documentId, isNote }: Props) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState<null | 'restore' | 'purge'>(null)
  const [error, setError] = useState<string | null>(null)

  const Noun = isNote ? 'Note' : 'Scan'
  const noun = isNote ? 'note' : 'scan'
  const purgeMessage = isNote
    ? 'This permanently deletes this note and any attached files from storage. This cannot be undone.'
    : 'This permanently deletes this scan, its transcription and translation, and every image file from storage. This cannot be undone.'

  async function run(path: 'restore' | 'purge') {
    setBusy(path)
    setError(null)
    try {
      const res = await fetch(`/api/documents/${documentId}/${path}`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.error || `Request failed (${res.status})`)
      }
      if (path === 'restore') {
        router.push(`/doc/${documentId}`)
      } else {
        router.push('/trash')
      }
      router.refresh()
    } catch (err) {
      console.error(`${path} failed`, err)
      setError(err instanceof Error ? err.message : 'Action failed')
      setBusy(null)
      setConfirmOpen(false)
    }
  }

  return (
    <div className="space-y-2 mt-8 md:mt-0">
      <button
        type="button"
        onClick={() => void run('restore')}
        disabled={busy !== null}
        className="block w-full text-center bg-seal text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-black transition-colors disabled:opacity-50 disabled:pointer-events-none"
      >
        {busy === 'restore' ? 'Restoring…' : `↩ Restore ${Noun}`}
      </button>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={busy !== null}
        className="block w-full bg-black hover:bg-seal border border-black hover:border-seal rounded-lg p-3 text-sm font-bold text-white text-center transition-colors disabled:opacity-50 disabled:pointer-events-none"
      >
        {busy === 'purge' ? (
          'Deleting…'
        ) : (
          <span className="inline-flex items-center justify-center gap-1.5">
            <span className="text-lg leading-none">✕</span> Delete {Noun} Forever
          </span>
        )}
      </button>
      {error ? (
        <p className="text-xs text-seal mt-2 text-center">{error}</p>
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        destructive
        title={`Permanently delete this ${noun}?`}
        message={purgeMessage}
        confirmLabel={`Delete ${Noun} Forever`}
        cancelLabel={`Keep ${Noun}`}
        onConfirm={() => void run('purge')}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
