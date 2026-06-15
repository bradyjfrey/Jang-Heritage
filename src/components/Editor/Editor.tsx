'use client'

import { ArrowDownToLine, ArrowLeft, ArrowRight, Maximize, Minus, Plus } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Document, Media, Transcription, Translation, User } from '@/payload-types'

import styles from './Editor.module.css'
import { useAutosave } from './useAutosave'

type Props = {
  document: Document
  transcription: Transcription | null
  translation: Translation | null
  user: User | null
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

// Side-by-side editor matching mockups/edit.html. Autosave on a 3s debounce
// per field, plus immediate save on blur. Conflict detection lands as a
// follow-up commit (will use If-Match on updatedAt).
export function Editor({ document: doc, transcription, translation, user }: Props) {
  // Initial values from server-fetched data.
  const [title, setTitle] = useState(doc.title)
  const [chineseText, setChineseText] = useState(transcription?.text || '')
  const [englishText, setEnglishText] = useState(translation?.text || '')

  // The Transcription / Translation rows may not exist yet. Track whether
  // we have IDs; first save creates the row and stores the ID, subsequent
  // saves PATCH it.
  const [transcriptionId, setTranscriptionId] = useState<number | null>(
    transcription?.id ?? null,
  )
  const [translationId, setTranslationId] = useState<number | null>(
    translation?.id ?? null,
  )

  // Per-row updatedAt for optimistic concurrency. We send these as
  // If-Unmodified-Since on each PATCH; the server's beforeChange hook
  // (checkIfUnmodifiedSince) returns 409 if the row has moved on.
  const [docUpdatedAt, setDocUpdatedAt] = useState<string>(doc.updatedAt)
  // Always-fresh copy of the document's concurrency token, plus a promise
  // chain that serializes every document-row PATCH (see patchDocument).
  const docUpdatedAtRef = useRef<string>(doc.updatedAt)
  const docWriteChain = useRef<Promise<unknown>>(Promise.resolve())
  const [transcriptionUpdatedAt, setTranscriptionUpdatedAt] = useState<string | null>(
    transcription?.updatedAt ?? null,
  )
  const [translationUpdatedAt, setTranslationUpdatedAt] = useState<string | null>(
    translation?.updatedAt ?? null,
  )

  // Save state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  // `now` is updated every 5s by the effect below while in 'saved' status,
  // so the derived `savedAgoLabel` keeps ticking. We can't call Date.now()
  // directly in render — it's impure and the React 19 hooks lint flags it.
  const [now, setNow] = useState(0)

  // Per-field flush handles for "save now" on blur or unmount.
  const flushTitle = useRef<(() => void) | null>(null)
  const flushChinese = useRef<(() => void) | null>(null)
  const flushEnglish = useRef<(() => void) | null>(null)

  const [chineseSize, setChineseSize] = useState(16)
  const [englishSize, setEnglishSize] = useState(16)

  const initialScans = (Array.isArray(doc.scans) ? doc.scans : []).filter(
    (s): s is Media => typeof s === 'object' && s !== null,
  )
  const [scans, setScans] = useState<Media[]>(initialScans)
  const [scanIndex, setScanIndex] = useState(0)
  const currentScan = scans[scanIndex]

  // Adding scans to an existing document: upload each file to Media (same
  // flow as ScanDropzone), then PATCH the document's scans array. This is
  // what makes the dropzone's "you can add more scans after" promise true.
  const addScanInputRef = useRef<HTMLInputElement | null>(null)
  const [scanUpload, setScanUpload] = useState<{
    status: 'idle' | 'uploading' | 'error'
    done: number
    total: number
    error: string | null
  }>({ status: 'idle', done: 0, total: 0, error: null })

  const [zoom, setZoom] = useState(100)
  const zoomOut = () => setZoom((z) => Math.max(25, z - 25))
  const zoomIn = () => setZoom((z) => Math.min(400, z + 25))
  const zoomReset = () => setZoom(100)

  const userInitial =
    user?.displayName?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    '?'

  const wordCount = englishText.trim()
    ? englishText.trim().split(/\s+/).length
    : 0

  // ---- save helpers --------------------------------------------------------

  async function withSaveStatus(work: () => Promise<void>) {
    setSaveStatus('saving')
    try {
      await work()
      setSavedAt(Date.now())
      setSaveError(null)
      setSaveStatus('saved')
    } catch (err) {
      if (err instanceof Error && err.message === 'CONFLICT') {
        setSaveStatus('conflict')
      } else {
        console.error('Save failed', err)
        setSaveError(err instanceof Error ? err.message : null)
        setSaveStatus('error')
      }
    }
  }

  function jsonHeaders(ifUnmodifiedSince?: string | null): HeadersInit {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    // Custom header (not standard If-Unmodified-Since) so we can use ISO-8601
    // timestamps. Standard HTTP-date format is awkward for milliseconds.
    if (ifUnmodifiedSince) h['X-If-Unmodified-Since'] = ifUnmodifiedSince
    return h
  }

  // Pull Payload's first field-level validation message out of an error
  // response so a failed save can say *why* (e.g. a maxLength violation on a
  // hidden field) instead of a bare status code.
  async function errorDetail(res: Response, fallback: string): Promise<string> {
    try {
      const json = await res.json()
      const fieldMsg = json?.errors?.[0]?.data?.errors?.[0]?.message
      return fieldMsg || json?.errors?.[0]?.message || fallback
    } catch {
      return fallback
    }
  }

  async function patch(url: string, body: object, ifUnmodifiedSince: string | null) {
    const res = await fetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: jsonHeaders(ifUnmodifiedSince),
      body: JSON.stringify(body),
    })
    if (res.status === 409) throw new Error('CONFLICT')
    if (!res.ok) throw new Error(await errorDetail(res, `PATCH ${url} failed: ${res.status}`))
    return res.json()
  }

  async function post(url: string, body: object) {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await errorDetail(res, `POST ${url} failed: ${res.status}`))
    return res.json()
  }

  // Title and scans both write the document row and share one updatedAt
  // token. A title autosave firing mid scan-upload would bump the token and
  // 409 the upload (it captured the old one). Funnel every document PATCH
  // through a promise chain so they run one at a time, each reading the
  // freshest token from the ref — same-tab writers never conflict with each
  // other, while a real cross-device edit still 409s as intended.
  function patchDocument(body: object) {
    const run = docWriteChain.current
      .catch(() => {})
      .then(async () => {
        const json = await patch(
          `/api/documents/${doc.id}`,
          body,
          docUpdatedAtRef.current,
        )
        const updated = json?.doc ?? json
        if (updated?.updatedAt) {
          docUpdatedAtRef.current = updated.updatedAt
          setDocUpdatedAt(updated.updatedAt)
        }
        return json
      })
    docWriteChain.current = run.catch(() => {})
    return run
  }

  async function saveTitle(value: string) {
    if (value === doc.title && docUpdatedAt === doc.updatedAt) return
    await withSaveStatus(async () => {
      await patchDocument({ title: value })
    })
  }

  async function saveTranscription(value: string) {
    await withSaveStatus(async () => {
      if (transcriptionId == null) {
        const json = await post('/api/transcriptions', { document: doc.id, text: value })
        const created = json?.doc ?? json
        if (created?.id != null) setTranscriptionId(created.id)
        if (created?.updatedAt) setTranscriptionUpdatedAt(created.updatedAt)
      } else {
        const json = await patch(
          `/api/transcriptions/${transcriptionId}`,
          { text: value },
          transcriptionUpdatedAt,
        )
        const updated = json?.doc ?? json
        if (updated?.updatedAt) setTranscriptionUpdatedAt(updated.updatedAt)
      }
    })
  }

  async function saveTranslation(value: string) {
    await withSaveStatus(async () => {
      if (translationId == null) {
        const json = await post('/api/translations', { document: doc.id, text: value })
        const created = json?.doc ?? json
        if (created?.id != null) setTranslationId(created.id)
        if (created?.updatedAt) setTranslationUpdatedAt(created.updatedAt)
      } else {
        const json = await patch(
          `/api/translations/${translationId}`,
          { text: value },
          translationUpdatedAt,
        )
        const updated = json?.doc ?? json
        if (updated?.updatedAt) setTranslationUpdatedAt(updated.updatedAt)
      }
    })
  }

  // Upload one or more files to Media, then append them to this document's
  // scans. Persists the full (existing + new) array so the order is explicit,
  // then jumps the viewer to the first newly added scan.
  async function addScans(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    setScanUpload({ status: 'uploading', done: 0, total: files.length, error: null })
    try {
      const uploaded: Media[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fd = new FormData()
        fd.append('file', file)
        fd.append('_payload', JSON.stringify({ alt: file.name || 'Untitled scan' }))
        const res = await fetch('/api/media', {
          method: 'POST',
          credentials: 'include',
          body: fd,
        })
        if (!res.ok) {
          throw new Error(`Upload failed for ${file.name} (${res.status})`)
        }
        const json = await res.json()
        const created = (json?.doc ?? json) as Media
        if (created?.id != null) uploaded.push(created)
        setScanUpload((s) => ({ ...s, done: i + 1 }))
      }

      const firstNewIndex = scans.length
      const newScans = [...scans, ...uploaded]
      await patchDocument({ scans: newScans.map((s) => s.id) })

      setScans(newScans)
      setScanIndex(firstNewIndex)
      setScanUpload({ status: 'idle', done: 0, total: 0, error: null })
    } catch (err) {
      console.error('Add scan failed', err)
      const message =
        err instanceof Error && err.message === 'CONFLICT'
          ? 'Document changed elsewhere — refresh and try again'
          : err instanceof Error
            ? err.message
            : 'Upload failed'
      setScanUpload({ status: 'error', done: 0, total: 0, error: message })
    }
  }

  useAutosave({ value: title, onSave: saveTitle, flushRef: flushTitle })
  useAutosave({ value: chineseText, onSave: saveTranscription, flushRef: flushChinese })
  useAutosave({ value: englishText, onSave: saveTranslation, flushRef: flushEnglish })

  // Update `now` every 5s while in 'saved' status so `savedAgoLabel` stays
  // fresh. Date.now() is read only inside the effect's deferred / interval
  // callbacks, never during render. The initial setTimeout(0) seeds `now`
  // after commit so the label appears immediately rather than waiting 5s.
  useEffect(() => {
    if (saveStatus !== 'saved' || savedAt == null) return
    const tid = setTimeout(() => setNow(Date.now()), 0)
    const id = setInterval(() => setNow(Date.now()), 5000)
    return () => {
      clearTimeout(tid)
      clearInterval(id)
    }
  }, [saveStatus, savedAt])

  const savedAgoLabel = useMemo(() => {
    if (saveStatus !== 'saved' || savedAt == null || now === 0) return ''
    const seconds = Math.max(0, Math.floor((now - savedAt) / 1000))
    if (seconds < 5) return 'Saved just now'
    if (seconds < 60) return `Saved ${seconds}s ago`
    if (seconds < 3600) return `Saved ${Math.floor(seconds / 60)}m ago`
    return 'Saved'
  }, [saveStatus, savedAt, now])

  // Warn before leaving with pending edits (during the debounce window).
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (saveStatus === 'saving') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [saveStatus])

  function statusLabel(): { text: string; cls: string } {
    if (saveStatus === 'saving') return { text: 'Saving…', cls: 'save-status saving' }
    if (saveStatus === 'conflict') return { text: 'Conflict, refresh', cls: 'save-status' }
    if (saveStatus === 'error') return { text: saveError || 'Save failed', cls: 'save-status' }
    if (saveStatus === 'saved') return { text: savedAgoLabel || 'Saved', cls: 'save-status' }
    return { text: 'Up to date', cls: 'save-status' }
  }
  const status = statusLabel()
  const isAlertStatus = saveStatus === 'error' || saveStatus === 'conflict'

  const statusStyle = isAlertStatus
    ? { color: 'var(--seal)' }
    : saveStatus === 'idle'
      ? { opacity: 0.55 }
      : undefined
  const dotStyle = isAlertStatus
    ? { background: 'var(--seal)' }
    : saveStatus === 'idle'
      ? { background: 'var(--ink-faint)' }
      : undefined

  return (
    <div className={styles.editShell}>
      {/* Mobile (<md/768px): two-row header — Back + status on row 1, title on row 2. Avatar dropped. */}
      <header className="md:hidden border-b border-[color:var(--border-soft)] bg-paper">
        <div className="flex items-center px-4 py-2 gap-3">
          <Link
            href={`/doc/${doc.id}`}
            className="text-ink-soft hover:text-ink text-sm flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
          </Link>
          <span className={`${status.cls} ml-auto`} style={statusStyle}>
            <span className="dot" style={dotStyle}></span>
            {status.text}
          </span>
        </div>
        <div className="px-4 pb-6">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => flushTitle.current?.()}
            className="w-full bg-transparent border-0 font-serif-content text-lg py-1 focus:outline-none focus:bg-white focus:rounded focus:px-2"
          />
        </div>
      </header>
      {/* md+ (≥768px): original single-row desktop header. */}
      <header className="hidden md:flex h-14 border-b border-[color:var(--border-soft)] bg-paper items-center px-4 gap-4">
        <Link
          href={`/doc/${doc.id}`}
          className="text-ink-soft hover:text-ink text-sm flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
        </Link>
        <div className="h-6 w-px bg-[color:var(--border-soft)]"></div>
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => flushTitle.current?.()}
            className="w-full max-w-xl bg-transparent border-0 font-serif-content text-lg focus:outline-none focus:bg-white focus:rounded focus:px-2 focus:py-0.5"
          />
        </div>
        <span className={status.cls} style={statusStyle}>
          <span className="dot" style={dotStyle}></span>
          {status.text}
        </span>
        <div className="w-8 h-8 rounded-full bg-seal text-white flex items-center justify-center text-sm font-medium">
          {userInitial}
        </div>
      </header>

      <div className={styles.editMain}>
        <div className={`${styles.imagePane} ${styles.pane}`}>
          <div className={styles.paneHeader}>
            <div className="flex items-center gap-2">
              <button
                className="pill-btn inline-flex items-center justify-center"
                onClick={() => setScanIndex(Math.max(0, scanIndex - 1))}
                disabled={scanIndex === 0}
                aria-label="Previous scan"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <span className="text-ink-soft">
                Scan{' '}
                <span className="text-ink font-medium">
                  {scans.length > 0 ? scanIndex + 1 : 0}
                </span>{' '}
                of {scans.length}
              </span>
              <button
                className="pill-btn inline-flex items-center justify-center"
                onClick={() =>
                  setScanIndex(Math.min(scans.length - 1, scanIndex + 1))
                }
                disabled={scanIndex >= scans.length - 1}
                aria-label="Next scan"
              >
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                ref={addScanInputRef}
                type="file"
                accept="image/jpeg,image/tiff,image/tif,image/png"
                multiple
                className="sr-only"
                disabled={scanUpload.status === 'uploading'}
                onChange={(e) => {
                  void addScans(e.target.files)
                  e.target.value = ''
                }}
              />
              <button
                className="pill-btn inline-flex items-center gap-1.5"
                onClick={() => addScanInputRef.current?.click()}
                disabled={scanUpload.status === 'uploading'}
                title={
                  scanUpload.status === 'error'
                    ? scanUpload.error || 'Upload failed'
                    : 'Add another scan to this document'
                }
                style={
                  scanUpload.status === 'error' ? { color: 'var(--seal)' } : undefined
                }
              >
                {scanUpload.status === 'uploading' ? (
                  `Uploading ${scanUpload.done}/${scanUpload.total}…`
                ) : scanUpload.status === 'error' ? (
                  'Retry add'
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add scan
                  </>
                )}
              </button>
              <div className="h-5 w-px bg-[color:var(--border-soft)] mx-0.5"></div>
              <button
                className="pill-btn inline-flex items-center justify-center"
                onClick={zoomOut}
                disabled={!currentScan || zoom <= 25}
                title="Zoom out"
                aria-label="Zoom out"
              >
                <Minus className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button
                className="pill-btn"
                onClick={zoomReset}
                disabled={!currentScan}
                title="Reset zoom"
              >
                {zoom}%
              </button>
              <button
                className="pill-btn inline-flex items-center justify-center"
                onClick={zoomIn}
                disabled={!currentScan || zoom >= 400}
                title="Zoom in"
                aria-label="Zoom in"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <a
                className="pill-btn inline-flex items-center justify-center"
                href={currentScan?.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!currentScan}
                style={!currentScan ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
                title="Open full size in a new tab"
              >
                <Maximize className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
              <a
                className="pill-btn inline-flex items-center justify-center"
                href={currentScan?.url || '#'}
                download={currentScan?.filename || ''}
                aria-disabled={!currentScan}
                style={!currentScan ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
                title="Download original"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className={`${styles.scrollArea} scroll-area bg-paper-warm overflow-auto p-4`}>
            {currentScan?.url ? (
              <img
                src={currentScan.url}
                alt={currentScan.alt || `Scan ${scanIndex + 1} of ${scans.length}`}
                className="rounded shadow-sm"
                style={{
                  display: 'block',
                  width: `${zoom}%`,
                  maxWidth: 'none',
                  height: 'auto',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              />
            ) : (
              <div className="text-ink-faint text-sm py-8 text-center">No scans attached</div>
            )}
          </div>
        </div>

        <div className={`${styles.pane}`}>
          <div className={styles.paneHeader}>
            <div className="flex items-center gap-2">
              <span className="font-cjk text-base">中文录入</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5" title="Adjust text size">
                <button
                  className={`${styles.sizeBtn} ${styles.sizeBtnDec}`}
                  onClick={() => setChineseSize(Math.max(12, chineseSize - 2))}
                  aria-label="Decrease text size"
                >
                  A
                </button>
                <button
                  className={`${styles.sizeBtn} ${styles.sizeBtnInc}`}
                  onClick={() => setChineseSize(Math.min(32, chineseSize + 2))}
                  aria-label="Increase text size"
                >
                  A
                </button>
              </div>
              <span className="text-ink-faint text-xs">
                {chineseText.length} chars
              </span>
            </div>
          </div>
          <div className={styles.paneBody}>
            <textarea
              className={`${styles.editor} font-cjk`}
              spellCheck={false}
              value={chineseText}
              onChange={(e) => setChineseText(e.target.value)}
              onBlur={() => flushChinese.current?.()}
              style={{ fontSize: `${chineseSize}px` }}
            />
          </div>
        </div>

        <div className={`${styles.pane}`}>
          <div className={styles.paneHeader}>
            <div className="flex items-center gap-2">
              <span className="text-base">English</span>
              <span className="text-ink-faint">·</span>
              <span className="text-ink-soft">Translation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5" title="Adjust text size">
                <button
                  className={`${styles.sizeBtn} ${styles.sizeBtnDec}`}
                  onClick={() => setEnglishSize(Math.max(12, englishSize - 2))}
                  aria-label="Decrease text size"
                >
                  A
                </button>
                <button
                  className={`${styles.sizeBtn} ${styles.sizeBtnInc}`}
                  onClick={() => setEnglishSize(Math.min(32, englishSize + 2))}
                  aria-label="Increase text size"
                >
                  A
                </button>
              </div>
              <span className="text-ink-faint text-xs">{wordCount} words</span>
            </div>
          </div>
          <div className={styles.paneBody}>
            <textarea
              className={`${styles.editor} font-serif-content`}
              spellCheck={true}
              value={englishText}
              onChange={(e) => setEnglishText(e.target.value)}
              onBlur={() => flushEnglish.current?.()}
              style={{ fontSize: `${englishSize}px` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
