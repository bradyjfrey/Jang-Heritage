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
  // The editor renders a pane header that already says "Attachments";
  // pass false there to suppress the duplicate inline heading.
  showHeading?: boolean
}

type SaveStatus = 'idle' | 'uploading' | 'saving' | 'error' | 'conflict'

// File attachments for notes, displayed as a thumbnail gallery so the
// images themselves carry context. Non-image files (PDFs, docs) fall back
// to a generic file glyph labelled with the extension. Each upload posts
// to /api/media, then PATCHes the document's attachments array. Concurrency
// is enforced with X-If-Unmodified-Since.
//
// If the document doesn't exist yet (new note before first save), the
// upload UI is hidden — the note has to autosave first so we have an id.
export function NoteAttachments({
  documentId,
  initialAttachments,
  initialUpdatedAt,
  canEdit = true,
  showHeading = true,
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
        <h2 className="font-serif-content text-xl mb-3">Attachments:</h2>
        <ul className="grid grid-cols-5 gap-3">
          {attachments.map((a) => (
            <ViewCard key={a.id} media={a} />
          ))}
        </ul>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3 min-h-[1.25rem]">
        {showHeading ? (
          <h2 className="font-serif-content text-xl">Attachments:</h2>
        ) : <span />}
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

      <ul className="grid grid-cols-5 gap-3">
        {attachments.map((a) => (
          <EditCard
            key={a.id}
            media={a}
            onRemove={() => setPendingDeleteId(a.id)}
          />
        ))}
        {documentId != null ? (
          <li>
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
              className="aspect-square flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[color:var(--border-soft)] bg-paper-warm/50 text-ink-soft text-xs hover:bg-seal hover:text-white hover:border-seal cursor-pointer transition-colors"
            >
              <span className="text-2xl leading-none">+</span>
              <span>Add files</span>
            </label>
          </li>
        ) : null}
      </ul>

      {documentId == null ? (
        <p className="text-xs text-ink-faint mt-3">
          Save the note first, then you can add attachments.
        </p>
      ) : null}

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

function isImage(media: Media): boolean {
  return (media.mimeType || '').startsWith('image/')
}

function fileExt(media: Media): string {
  const name = media.filename || ''
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toUpperCase() : 'FILE'
}

// Generic page-with-folded-corner glyph for non-image attachments.
function FileGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="36"
      height="36"
      aria-hidden="true"
      className="text-ink-soft"
    >
      <path
        d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M14 3v4h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Thumbnail({ media }: { media: Media }) {
  const href = media.url || `/api/media/file/${media.filename}`
  if (isImage(media)) {
    return (
      <img
        src={href}
        alt={media.alt || media.filename || ''}
        className="w-full h-full object-cover"
      />
    )
  }
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1 px-2">
      <FileGlyph />
      <span className="text-[10px] tracking-wider text-ink-soft uppercase">
        {fileExt(media)}
      </span>
    </div>
  )
}

// Read-only gallery card. Whole tile is the link.
function ViewCard({ media }: { media: Media }) {
  const href = media.url || `/api/media/file/${media.filename}`
  const description =
    media.alt && media.alt !== media.filename ? media.alt : ''
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block aspect-square rounded-md overflow-hidden border border-[color:var(--border-soft)] bg-paper-warm hover:ring-2 hover:ring-gold transition"
        title={media.filename || ''}
      >
        <Thumbnail media={media} />
      </a>
      {description ? (
        <p className="mt-1.5 text-xs text-ink-soft line-clamp-2">{description}</p>
      ) : null}
    </li>
  )
}

// Editable gallery card. Hover reveals a delete button in the corner;
// the description input below the thumbnail autosaves on blur via
// PATCH /api/media. Media.alt is required, so empty descriptions revert
// to the filename on save.
function EditCard({
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
    <li className="group relative">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block aspect-square rounded-md overflow-hidden border border-[color:var(--border-soft)] bg-paper-warm hover:ring-2 hover:ring-gold transition"
        title={media.filename || ''}
      >
        <Thumbnail media={media} />
      </a>
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-seal text-white text-xs leading-none opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-black transition"
        aria-label="Remove attachment"
        title="Remove attachment"
      >
        ×
      </button>
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => void save()}
        placeholder="Describe this attachment"
        className={`mt-1.5 w-full text-xs bg-transparent border border-transparent rounded px-1.5 py-1 transition-colors hover:border-[color:var(--border-soft)] hover:bg-paper-warm focus:outline-none focus:border-gold focus:bg-paper-warm ${
          status === 'error' ? '!border-seal' : ''
        }`}
      />
    </li>
  )
}
