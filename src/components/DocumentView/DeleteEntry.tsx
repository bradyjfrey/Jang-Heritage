'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog'

type Props = {
  documentId: number
  isNote: boolean
}

// "Delete entry" action for the document sidebar, sitting below Export Bundle.
// Opens a warning modal; on confirm it moves the entry to the Trash (a soft
// delete — nothing is permanently removed) and routes to the now-trashed entry
// page, where it can be restored or permanently deleted.
export function DeleteEntry({ documentId, isNote }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const noun = isNote ? 'note' : 'scan'
  const Noun = isNote ? 'Note' : 'Scan'
  const message =
    'This item is moved to the Trash, please visit it for permanent deletion.'

  async function handleConfirm() {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/documents/${documentId}/delete`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.error || `Delete failed (${res.status})`)
      }
      // Land on the entry's now-trashed page (banner + Restore / Delete Forever).
      router.push(`/doc/${documentId}`)
      router.refresh()
    } catch (err) {
      console.error('Delete failed', err)
      setError(err instanceof Error ? err.message : 'Delete failed')
      setDeleting(false)
      setOpen(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={deleting}
        className="block w-full bg-black hover:bg-seal border border-black hover:border-seal rounded-lg p-3 text-sm font-bold text-white text-center transition-colors disabled:opacity-50 disabled:pointer-events-none"
      >
        {deleting ? (
          'Deleting…'
        ) : (
          <span className="inline-flex items-center justify-center gap-1.5">
            <span className="text-lg leading-none">✕</span> Delete {Noun}
          </span>
        )}
      </button>
      {error ? (
        <p className="text-xs text-seal mt-2 text-center">{error}</p>
      ) : null}
      <ConfirmDialog
        open={open}
        destructive
        title={`Move this ${noun} to the Trash?`}
        message={message}
        confirmLabel="Move to Trash"
        cancelLabel={`Keep ${Noun}`}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}
