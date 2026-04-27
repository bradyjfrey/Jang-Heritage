'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { Document, User } from '@/payload-types'

import styles from './Editor.module.css'
import { useAutosave } from './useAutosave'

type Props = {
  document: Document
  user: User | null
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

// Single-pane editor for documentType='note'. Saves both the title and the
// body to the same Documents row via PATCH; autosave rules and conflict
// detection mirror the side-by-side editor.
export function NoteEditor({ document: doc, user }: Props) {
  const [title, setTitle] = useState(doc.title)
  const [body, setBody] = useState(doc.body || '')
  const [docUpdatedAt, setDocUpdatedAt] = useState<string>(doc.updatedAt)

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [savedAgoLabel, setSavedAgoLabel] = useState('')

  const flushTitle = useRef<(() => void) | null>(null)
  const flushBody = useRef<(() => void) | null>(null)

  const [bodySize, setBodySize] = useState(16)

  const userInitial =
    user?.displayName?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    '?'

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0

  async function patchDoc(payload: Partial<Document>) {
    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-If-Unmodified-Since': docUpdatedAt,
        },
        body: JSON.stringify(payload),
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
      if (updated?.updatedAt) setDocUpdatedAt(updated.updatedAt)
      setSavedAt(Date.now())
      setSaveStatus('saved')
    } catch (err) {
      console.error('Save failed', err)
      setSaveStatus('error')
    }
  }

  async function saveTitle(value: string) {
    if (value === doc.title && docUpdatedAt === doc.updatedAt) return
    await patchDoc({ title: value })
  }

  async function saveBody(value: string) {
    await patchDoc({ body: value })
  }

  useAutosave({ value: title, onSave: saveTitle, flushRef: flushTitle })
  useAutosave({ value: body, onSave: saveBody, flushRef: flushBody })

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
                onBlur={() => flushBody.current?.()}
                style={{ fontSize: `${bodySize}px` }}
                placeholder="Start typing… Notes are for research leads, contacts, transcribed inscriptions, anything that doesn't have a scan attached."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
