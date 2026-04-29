'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Status = 'idle' | 'uploading' | 'creating' | 'error'

// Best-effort error message extraction from a Payload 4xx/5xx response.
async function readErrorDetail(res: Response): Promise<string> {
  const cloned = res.clone()
  try {
    const json = await res.json()
    const msg =
      json?.errors?.[0]?.message ||
      json?.message ||
      (typeof json === 'string' ? json : '')
    if (msg) return msg
    return JSON.stringify(json).slice(0, 200)
  } catch {
    try {
      const text = await cloned.text()
      return text.slice(0, 200)
    } catch {
      return ''
    }
  }
}

// Drag-and-drop / file-picker target. On selection: uploads each file to
// /api/media (multipart, attaches to R2), then POSTs a new Document with
// those media IDs as scans, then routes into /doc/<newId>/edit.
//
// No row is created until the user actually drops a file, matching the
// note flow's "create only on intent" rule.
export function ScanDropzone() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  async function uploadAndCreate(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    setError(null)
    setStatus('uploading')
    setProgress({ done: 0, total: files.length })

    try {
      const mediaIds: number[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fd = new FormData()
        fd.append('file', file)
        // Payload 3 accepts a JSON envelope as `_payload` alongside the
        // file part. Cleaner than appending each field individually.
        fd.append(
          '_payload',
          JSON.stringify({ alt: file.name || 'Untitled scan' }),
        )
        const res = await fetch('/api/media', {
          method: 'POST',
          credentials: 'include',
          body: fd,
        })
        if (!res.ok) {
          const detail = await readErrorDetail(res)
          throw new Error(
            `Upload failed for ${file.name} (${res.status})${detail ? `: ${detail}` : ''}`,
          )
        }
        const json = await res.json()
        const created = json?.doc ?? json
        if (created?.id != null) mediaIds.push(created.id)
        setProgress({ done: i + 1, total: files.length })
      }

      setStatus('creating')
      const docRes = await fetch('/api/documents', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled',
          documentType: 'letter',
          scans: mediaIds,
        }),
      })
      if (!docRes.ok) {
        const detail = await readErrorDetail(docRes)
        throw new Error(
          `Document create failed (${docRes.status})${detail ? `: ${detail}` : ''}`,
        )
      }
      const docJson = await docRes.json()
      const createdDoc = docJson?.doc ?? docJson
      if (createdDoc?.id != null) {
        router.push(`/doc/${createdDoc.id}/edit`)
      } else {
        throw new Error('Document created but no id returned')
      }
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    }
  }

  const isBusy = status === 'uploading' || status === 'creating'

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault()
        if (!isBusy) setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        if (!isBusy) void uploadAndCreate(e.dataTransfer.files)
      }}
      className={`w-full max-w-md aspect-[3/4] flex flex-col items-center justify-center text-center rounded-lg p-6 transition border-2 border-dashed ${
        isDragging
          ? 'border-seal bg-paper-warm'
          : 'border-[color:var(--border-strong)] hover:border-seal hover:bg-paper-warm'
      } ${isBusy ? 'cursor-wait pointer-events-none' : 'cursor-pointer'}`}
    >
      {status === 'idle' ? (
        <>
          <svg
            className="w-12 h-12 text-ink-soft mb-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
            />
          </svg>
          <div className="font-serif-content text-base mb-1">
            Drop a scan to begin
          </div>
          <div className="text-sm text-ink-soft mb-3">
            or click to choose a file
          </div>
          <div className="text-xs text-ink-faint">
            JPEG, TIFF, or PNG. You can add more scans after.
          </div>
        </>
      ) : null}
      {status === 'uploading' ? (
        <div className="text-sm text-ink-soft">
          Uploading {progress.done} of {progress.total}…
        </div>
      ) : null}
      {status === 'creating' ? (
        <div className="text-sm text-ink-soft">Creating document…</div>
      ) : null}
      {status === 'error' ? (
        <div className="text-sm text-seal">
          {error || 'Upload failed'}
          <div className="text-xs text-ink-faint mt-2">Click to try again.</div>
        </div>
      ) : null}
      <input
        type="file"
        accept="image/jpeg,image/tiff,image/tif,image/png"
        multiple
        className="sr-only"
        disabled={isBusy}
        onChange={(e) => void uploadAndCreate(e.target.files)}
      />
    </label>
  )
}
