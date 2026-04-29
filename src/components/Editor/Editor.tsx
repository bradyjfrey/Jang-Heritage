'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
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
  const [transcriptionUpdatedAt, setTranscriptionUpdatedAt] = useState<string | null>(
    transcription?.updatedAt ?? null,
  )
  const [translationUpdatedAt, setTranslationUpdatedAt] = useState<string | null>(
    translation?.updatedAt ?? null,
  )

  // Save state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [savedAgoLabel, setSavedAgoLabel] = useState('')

  // Per-field flush handles for "save now" on blur or unmount.
  const flushTitle = useRef<(() => void) | null>(null)
  const flushChinese = useRef<(() => void) | null>(null)
  const flushEnglish = useRef<(() => void) | null>(null)

  const [chineseSize, setChineseSize] = useState(16)
  const [englishSize, setEnglishSize] = useState(16)

  const scanRefs = Array.isArray(doc.scans) ? doc.scans : []
  const scans = scanRefs.filter(
    (s): s is Media => typeof s === 'object' && s !== null,
  )
  const [scanIndex, setScanIndex] = useState(0)
  const currentScan = scans[scanIndex]

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
      setSaveStatus('saved')
    } catch (err) {
      if (err instanceof Error && err.message === 'CONFLICT') {
        setSaveStatus('conflict')
      } else {
        console.error('Save failed', err)
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

  async function patch(url: string, body: object, ifUnmodifiedSince: string | null) {
    const res = await fetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: jsonHeaders(ifUnmodifiedSince),
      body: JSON.stringify(body),
    })
    if (res.status === 409) throw new Error('CONFLICT')
    if (!res.ok) throw new Error(`PATCH ${url} failed: ${res.status}`)
    return res.json()
  }

  async function post(url: string, body: object) {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`)
    return res.json()
  }

  async function saveTitle(value: string) {
    if (value === doc.title && docUpdatedAt === doc.updatedAt) return
    await withSaveStatus(async () => {
      const json = await patch(`/api/documents/${doc.id}`, { title: value }, docUpdatedAt)
      const updated = json?.doc ?? json
      if (updated?.updatedAt) setDocUpdatedAt(updated.updatedAt)
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

  useAutosave({ value: title, onSave: saveTitle, flushRef: flushTitle })
  useAutosave({ value: chineseText, onSave: saveTranscription, flushRef: flushChinese })
  useAutosave({ value: englishText, onSave: saveTranslation, flushRef: flushEnglish })

  // Re-render the "Saved 5s ago" label every 5s.
  useEffect(() => {
    if (saveStatus !== 'saved' || savedAt == null) {
      setSavedAgoLabel('')
      return
    }
    const tick = () => {
      const seconds = Math.max(0, Math.floor((Date.now() - savedAt) / 1000))
      if (seconds < 5) setSavedAgoLabel('Saved just now')
      else if (seconds < 60) setSavedAgoLabel(`Saved ${seconds}s ago`)
      else if (seconds < 3600)
        setSavedAgoLabel(`Saved ${Math.floor(seconds / 60)}m ago`)
      else setSavedAgoLabel('Saved')
    }
    tick()
    const id = setInterval(tick, 5000)
    return () => clearInterval(id)
  }, [saveStatus, savedAt])

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
    if (saveStatus === 'error') return { text: 'Save failed', cls: 'save-status' }
    if (saveStatus === 'saved') return { text: savedAgoLabel || 'Saved', cls: 'save-status' }
    return { text: 'Up to date', cls: 'save-status' }
  }
  const status = statusLabel()
  const isAlertStatus = saveStatus === 'error' || saveStatus === 'conflict'

  return (
    <div className={styles.editShell}>
      <header className="border-b border-[color:var(--border-soft)] bg-paper flex items-center px-4 gap-4">
        <Link
          href={`/doc/${doc.id}`}
          className="text-ink-soft hover:text-ink text-sm flex items-center gap-1"
        >
          <span>←</span> Back
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
        <span
          className={status.cls}
          style={
            isAlertStatus
              ? { color: 'var(--seal)' }
              : saveStatus === 'idle'
                ? { opacity: 0.55 }
                : undefined
          }
        >
          <span
            className="dot"
            style={
              isAlertStatus
                ? { background: 'var(--seal)' }
                : saveStatus === 'idle'
                  ? { background: 'var(--ink-faint)' }
                  : undefined
            }
          ></span>
          {status.text}
        </span>
        <div className="h-6 w-px bg-[color:var(--border-soft)]"></div>
        <button className="pill-btn">History</button>
        <div className="w-8 h-8 rounded-full bg-seal text-white flex items-center justify-center text-sm font-medium">
          {userInitial}
        </div>
      </header>

      <div className={styles.editMain}>
        <div className={`${styles.imagePane} ${styles.pane}`}>
          <div className={styles.paneHeader}>
            <div className="flex items-center gap-2">
              <button
                className="pill-btn"
                onClick={() => setScanIndex(Math.max(0, scanIndex - 1))}
                disabled={scanIndex === 0}
              >
                ←
              </button>
              <span className="text-ink-soft">
                Scan{' '}
                <span className="text-ink font-medium">
                  {scans.length > 0 ? scanIndex + 1 : 0}
                </span>{' '}
                of {scans.length}
              </span>
              <button
                className="pill-btn"
                onClick={() =>
                  setScanIndex(Math.min(scans.length - 1, scanIndex + 1))
                }
                disabled={scanIndex >= scans.length - 1}
              >
                →
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                className="pill-btn"
                onClick={zoomOut}
                disabled={!currentScan || zoom <= 25}
                title="Zoom out"
              >
                −
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
                className="pill-btn"
                onClick={zoomIn}
                disabled={!currentScan || zoom >= 400}
                title="Zoom in"
              >
                +
              </button>
              <a
                className="pill-btn"
                href={currentScan?.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!currentScan}
                style={!currentScan ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
                title="Open full size in a new tab"
              >
                ⛶
              </a>
              <a
                className="pill-btn"
                href={currentScan?.url || '#'}
                download={currentScan?.filename || ''}
                aria-disabled={!currentScan}
                style={!currentScan ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
                title="Download original"
              >
                ⤓
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
