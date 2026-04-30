'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

type Props = {
  documentId: number
  initialNotes: string
  initialUpdatedAt: string
}

// Inline editor for the document's sidecar Notes field. Lives below the
// translation on the doc detail page. Explicit Save button (no autosave)
// because notes are often longer-form thinking that benefits from being
// committed only when the writer is ready. Concurrency via
// X-If-Unmodified-Since, matching TagEditor / DetailsEditor.
export function NotesEditor({
  documentId,
  initialNotes,
  initialUpdatedAt,
}: Props) {
  const router = useRouter()
  const [text, setText] = useState(initialNotes)
  const [savedText, setSavedText] = useState(initialNotes)
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt)
  const [status, setStatus] = useState<SaveStatus>('idle')

  // Resync local state when the server rerenders with newer initial values.
  // Derived-state pattern: guarded setState during render, not via effect.
  const [trackedInitial, setTrackedInitial] = useState({
    notes: initialNotes,
    updatedAt: initialUpdatedAt,
  })
  if (
    trackedInitial.notes !== initialNotes ||
    trackedInitial.updatedAt !== initialUpdatedAt
  ) {
    setTrackedInitial({
      notes: initialNotes,
      updatedAt: initialUpdatedAt,
    })
    setSavedText(initialNotes)
    setUpdatedAt(initialUpdatedAt)
  }

  const dirty = text !== savedText

  async function onSave() {
    if (!dirty || status === 'saving') return
    setStatus('saving')
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-If-Unmodified-Since': updatedAt,
        },
        body: JSON.stringify({ notes: text }),
      })
      if (res.status === 409) {
        setStatus('conflict')
        return
      }
      if (!res.ok) {
        setStatus('error')
        return
      }
      const json = await res.json()
      const updated = json?.doc ?? json
      if (updated?.updatedAt) setUpdatedAt(updated.updatedAt)
      setSavedText(text)
      setStatus('saved')
      router.refresh()
    } catch (err) {
      console.error('Notes save failed', err)
      setStatus('error')
    }
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-serif-content text-xl">Notes</h2>
        <span className="text-xs text-ink-soft">
          {status === 'saving' ? (
            'Saving…'
          ) : status === 'saved' && !dirty ? (
            'Saved'
          ) : status === 'error' ? (
            <span className="text-seal">Save failed</span>
          ) : status === 'conflict' ? (
            <span className="text-seal">Conflict, refresh</span>
          ) : dirty ? (
            'Unsaved changes'
          ) : null}
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          if (status === 'saved' || status === 'error') setStatus('idle')
        }}
        rows={6}
        placeholder="Side information regarding..."
        className="w-full bg-paper-warm border border-[color:var(--border-soft)] rounded-lg p-5 text-sm text-ink leading-relaxed focus:outline-none focus:border-gold"
      />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={!dirty || status === 'saving'}
          className="bg-seal text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === 'saving' ? 'Saving…' : 'Save Notes'}
        </button>
      </div>
    </section>
  )
}
