'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { Document, User } from '@/payload-types'

import styles from './Editor.module.css'

type Props = {
  // null means we're in "new note" mode at /add/note: no row yet, first
  // save POSTs to create one. Established notes pass an existing Document.
  document: Document | null
  user: User | null
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

const DEBOUNCE_MS = 3000

// Single-pane editor for documentType='note'. Handles two flows:
//   - existing note: PATCH on save, with optimistic concurrency.
//   - brand-new note (document === null): defers creation until the user
//     actually types, then POSTs to /api/documents and silently rewrites
//     the URL to /doc/<newId>/edit so refresh keeps the user on the note.
export function NoteEditor({ document: doc, user }: Props) {
  const router = useRouter()

  const [title, setTitle] = useState(doc?.title || '')
  const [body, setBody] = useState(doc?.body || '')
  const [docId, setDocId] = useState<number | null>(doc?.id ?? null)
  const [docUpdatedAt, setDocUpdatedAt] = useState<string | null>(
    doc?.updatedAt ?? null,
  )

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [savedAgoLabel, setSavedAgoLabel] = useState('')

  const [bodySize, setBodySize] = useState(16)

  const userInitial =
    user?.displayName?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    '?'

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0

  // Last persisted values, used to debounce away no-op saves and to detect
  // the "user has typed something but doesn't have a row yet" case.
  const lastSavedRef = useRef({
    title: doc?.title || '',
    body: doc?.body || '',
  })
  // Latest title/body — kept in a ref so the debounced save reads fresh
  // values without re-binding the timer.
  const valuesRef = useRef({ title, body })
  valuesRef.current = { title, body }

  // Mirror docId / docUpdatedAt into refs for the same reason.
  const docIdRef = useRef<number | null>(docId)
  docIdRef.current = docId
  const docUpdatedAtRef = useRef<string | null>(docUpdatedAt)
  docUpdatedAtRef.current = docUpdatedAt

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushRef = useRef<(() => void) | null>(null)
  const inFlightRef = useRef(false)

  async function performSave() {
    if (inFlightRef.current) return
    const { title: t, body: b } = valuesRef.current
    if (
      t === lastSavedRef.current.title &&
      b === lastSavedRef.current.body
    ) {
      return
    }
    // Skip the first save if the user hasn't actually typed anything.
    if (docIdRef.current == null && !t.trim() && !b.trim()) {
      return
    }

    inFlightRef.current = true
    setSaveStatus('saving')
    try {
      if (docIdRef.current == null) {
        // Create
        const res = await fetch('/api/documents', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: t || 'Untitled note',
            body: b,
            documentType: 'note',
          }),
        })
        if (!res.ok) {
          setSaveStatus('error')
          return
        }
        const json = await res.json()
        const created = json?.doc ?? json
        if (created?.id != null) {
          setDocId(created.id)
          docIdRef.current = created.id
        }
        if (created?.updatedAt) {
          setDocUpdatedAt(created.updatedAt)
          docUpdatedAtRef.current = created.updatedAt
        }
        if (created?.id != null) {
          router.replace(`/doc/${created.id}/edit`, { scroll: false })
        }
      } else {
        // Update
        const res = await fetch(`/api/documents/${docIdRef.current}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-If-Unmodified-Since': docUpdatedAtRef.current || '',
          },
          body: JSON.stringify({ title: t, body: b }),
        })
        if (res.status === 409) {
          setSaveStatus('conflict')
          return
        }
        if (!res.ok) {
          setSaveStatus('error')
          return
        }
        const json = await res.json()
        const updated = json?.doc ?? json
        if (updated?.updatedAt) {
          setDocUpdatedAt(updated.updatedAt)
          docUpdatedAtRef.current = updated.updatedAt
        }
      }
      lastSavedRef.current = { title: t, body: b }
      setSavedAt(Date.now())
      setSaveStatus('saved')
    } catch (err) {
      console.error('Save failed', err)
      setSaveStatus('error')
    } finally {
      inFlightRef.current = false
    }
  }

  // Schedule a debounced save whenever title or body changes.
  useEffect(() => {
    if (
      title === lastSavedRef.current.title &&
      body === lastSavedRef.current.body
    ) {
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(performSave, DEBOUNCE_MS)
    flushRef.current = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      void performSave()
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body])

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

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (saveStatus === 'saving' || inFlightRef.current) {
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
    return { text: docId == null ? 'New note' : 'Up to date', cls: 'save-status' }
  }
  const status = statusLabel()
  const isAlertStatus = saveStatus === 'error' || saveStatus === 'conflict'
  const backHref = docId != null ? `/doc/${docId}` : '/'

  return (
    <div className={styles.editShell}>
      <header className="border-b border-[color:var(--border-soft)] bg-paper flex items-center px-4 gap-4">
        <Link
          href={backHref}
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
            onBlur={() => flushRef.current?.()}
            placeholder="Untitled note. Add a title or come back to it later."
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

      <div className={`${styles.editMain} ${styles.noteVariant}`}>
        <div className={styles.pane}>
          <div className={styles.paneHeader}>
            <div className="flex items-center gap-2">
              <span className="text-base">Note</span>
              <span className="text-ink-faint">·</span>
              <span className="text-ink-soft">
                Mixed language,{' '}
                <Link
                  href="/markdown"
                  target="_blank"
                  className="text-seal hover:text-black underline underline-offset-2"
                >
                  markdown supported
                </Link>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5" title="Adjust text size">
                <button
                  className={`${styles.sizeBtn} ${styles.sizeBtnDec}`}
                  onClick={() => setBodySize(Math.max(12, bodySize - 2))}
                  aria-label="Decrease text size"
                >
                  A
                </button>
                <button
                  className={`${styles.sizeBtn} ${styles.sizeBtnInc}`}
                  onClick={() => setBodySize(Math.min(32, bodySize + 2))}
                  aria-label="Increase text size"
                >
                  A
                </button>
              </div>
              <span className="text-ink-faint text-xs">{wordCount} words</span>
            </div>
          </div>
          <div className={`${styles.paneBody} scroll-area`}>
            <div className={styles.noteMeasure}>
              <textarea
                className={styles.noteEditor}
                spellCheck={true}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onBlur={() => flushRef.current?.()}
                style={{ fontSize: `${bodySize}px` }}
                placeholder="Start typing… Notes are for research leads, contacts, transcribed inscriptions, anything that doesn't have a scan attached."
                autoFocus={docId == null}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
