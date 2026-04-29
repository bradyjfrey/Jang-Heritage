'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog'
import type { Media } from '@/payload-types'

type Props = {
  documentId: number | null
  initialAttachments: Media[]
  initialUpdatedAt: string
  canEdit?: boolean
}

type SaveStatus = 'idle' | 'uploading' | 'saving' | 'error' | 'conflict'

// File attachments for notes. Lists existing attachments as download links.
// In edit mode, allows uploading new files (any type — images, PDFs, etc.)
// and removing existing ones. Each upload posts to /api/media, then PATCHes
// the document's attachments array. Concurrency via X-If-Unmodified-Since.
//
// If the document doesn't exist yet (new note before first save), the
// upload UI is hidden — the note has to autosave first so we have an id.
export function NoteAttachments({
  documentId,
  initialAttachments,
  initialUpdatedAt,
  canEdit = true,
}: Props) {
  const router = useRouter()
  const [attachments, setAttachments] = useState<Media[]>(initialAttachments)
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingDeleteLabel =
    pendingDeleteId !== null
      ? attachments.find((a) => a.id === pendingDeleteId)?.alt ||
        attachments.find((a) => a.id === pendingDeleteId)?.filename ||
        'this attachment'
      : ''

  useEffect(() => {
    setAttachments(initialAttachments)
    setUpdatedAt(initialUpdatedAt)
  }, [initialAttachments, initialUpdatedAt])

  async function persist(nextIds: number[]) {
    if (documentId == null) return
    setStatus('saving')
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-If-Unmodified-Since': updatedAt,
        },
        body: JSON.stringify({ attachments: nextIds }),
      })
      if (res.status === 409) {
        setStatus('conflict')
        return
      }
      if (!res.ok) {
        setStatus('error')
        setError(`Save failed (${res.status})`)
        return
      }
      const json = await res.json()
      const updated = json?.doc ?? json
      if (updated?.updatedAt) setUpdatedAt(updated.updatedAt)
      setStatus('idle')
      router.refresh()
    } catch (err) {
      console.error('Attachments save failed', err)
      setStatus('error')
      setError('Network error')
    }
  }

  async function onFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || documentId == null) return
    setError(null)
    setStatus('uploading')
    try {
      const newMedia: Media[] = []
      for (const file of Array.from(fileList)) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('_payload', JSON.stringify({ alt: file.name || 'Attachment' }))
        const res = await fetch('/api/media', {
          method: 'POST',
          credentials: 'include',
          body: fd,
        })
        if (!res.ok) {
          setStatus('error')
          setError(`Upload failed for ${file.name} (${res.status})`)
          return
        }
        const json = await res.json()
        const created = (json?.doc ?? json) as Media
        newMedia.push(created)
      }
      const next = [...attachments, ...newMedia]
      setAttachments(next)
      if (inputRef.current) inputRef.current.value = ''
      await persist(next.map((a) => a.id))
    } catch (err) {
      console.error('Attachment upload failed', err)
      setStatus('error')
      setError('Upload error')
    }
  }

  async function onRemove(id: number) {
    const next = attachments.filter((a) => a.id !== id)
    setAttachments(next)
    await persist(next.map((a) => a.id))
  }

  if (!canEdit) {
    if (attachments.length === 0) return null
    return (
      <section className="mt-8">
        <h2 className="font-serif-content text-xl mb-3">Attachments</h2>
        <ul className="space-y-1.5 text-sm">
          {attachments.map((a) => {
            const description =
              a.alt && a.alt !== a.filename ? a.alt : ''
            const href = a.url || `/api/media/file/${a.filename}`
            return (
              <li key={a.id}>
                <span className="text-ink-faint mr-2" aria-hidden="true">•</span>
                {description ? (
                  <span className="text-ink">{description}: </span>
                ) : null}
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-seal hover:underline"
                  title={a.filename || ''}
                >
                  {a.filename || `Attachment ${a.id}`}
                </a>
              </li>
            )
          })}
        </ul>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-end mb-3 min-h-[1.25rem]">
        <span className="text-xs text-ink-soft">
          {status === 'uploading'
            ? 'Uploading…'
            : status === 'saving'
              ? 'Saving…'
              : status === 'conflict'
                ? <span className="text-seal">Conflict, refresh</span>
                : status === 'error'
                  ? <span className="text-seal">{error || 'Save failed'}</span>
                  : null}
        </span>
      </div>
      {attachments.length > 0 ? (
        <ul className="space-y-1.5 mb-3">
          {attachments.map((a) => (
            <AttachmentRow
              key={a.id}
              media={a}
              onRemove={() => setPendingDeleteId(a.id)}
            />
          ))}
        </ul>
      ) : null}

      {documentId != null ? (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            onChange={(e) => void onFiles(e.target.files)}
            className="hidden"
            id={`attach-input-${documentId}`}
          />
          <label
            htmlFor={`attach-input-${documentId}`}
            className="inline-block bg-paper-warm hover:bg-seal hover:text-white border border-[color:var(--border-soft)] hover:border-seal rounded-md px-3 py-1.5 text-sm cursor-pointer transition-colors"
          >
            + Add files
          </label>
        </>
      ) : (
        <p className="text-xs text-ink-faint">
          Save the note first, then you can add attachments.
        </p>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Remove attachment?"
        message={`"${pendingDeleteLabel}" will be removed from this note. This can't be undone.`}
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (pendingDeleteId !== null) void onRemove(pendingDeleteId)
          setPendingDeleteId(null)
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </section>
  )
}

// "Photo of historic home: <URL>" — description on the left, colon, then
// the file URL rendered verbatim as a hyperlink. Description autosaves on
// blur via PATCH /api/media. No mode switching; the input is always there.
function AttachmentRow({
  media,
  onRemove,
}: {
  media: Media
  onRemove: () => void
}) {
  const initial = media.alt && media.alt !== media.filename ? media.alt : ''
  const [description, setDescription] = useState(initial)
  const [savedDescription, setSavedDescription] = useState(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const href = media.url || `/api/media/file/${media.filename}`

  async function save() {
    const trimmed = description.trim()
    if (trimmed === savedDescription) return
    // Media.alt is required, so empty descriptions revert to filename.
    const payload = trimmed || media.filename || `Attachment ${media.id}`
    setStatus('saving')
    try {
      const res = await fetch(`/api/media/${media.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt: payload }),
      })
      if (!res.ok) {
        setStatus('error')
        return
      }
      setSavedDescription(trimmed)
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  return (
    <li className="text-sm">
      <div className="flex items-center gap-2">
      <span className="text-ink-faint shrink-0" aria-hidden="true">•</span>
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => void save()}
        placeholder="Describe this attachment"
        className={`basis-1/6 shrink-0 min-w-0 bg-transparent border border-transparent rounded px-2 py-1 transition-colors hover:border-[color:var(--border-soft)] hover:bg-paper-warm focus:outline-none focus:border-gold focus:bg-paper-warm ${
          status === 'error' ? '!border-seal' : ''
        }`}
      />
      <span className="text-ink-faint shrink-0">:</span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-seal hover:underline truncate min-w-0"
        title={media.filename || ''}
      >
        {media.filename || `Attachment ${media.id}`}
      </a>
      <button
        type="button"
        onClick={onRemove}
        className="ml-3 shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-seal text-white text-xs leading-none hover:bg-black transition-colors"
        aria-label="Remove attachment"
        title="Remove attachment"
      >
        ×
      </button>
      </div>
    </li>
  )
}
