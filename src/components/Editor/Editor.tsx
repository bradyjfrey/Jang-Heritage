'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Document, Media, Transcription, Translation, User } from '@/payload-types'

import styles from './Editor.module.css'

type Props = {
  document: Document
  transcription: Transcription | null
  translation: Translation | null
  user: User | null
}

// Side-by-side editor matching mockups/edit.html. Read-only persistence in
// this commit; autosave + conflict detection land in the next one. Typing
// updates local state so the UX feels live, but reloading drops changes.
export function Editor({ document: doc, transcription, translation, user }: Props) {
  const [chineseText, setChineseText] = useState(transcription?.text || '')
  const [englishText, setEnglishText] = useState(translation?.text || '')
  const [chineseSize, setChineseSize] = useState(16)
  const [englishSize, setEnglishSize] = useState(16)

  const scanRefs = Array.isArray(doc.scans) ? doc.scans : []
  const scans = scanRefs.filter(
    (s): s is Media => typeof s === 'object' && s !== null,
  )
  const [scanIndex, setScanIndex] = useState(0)
  const currentScan = scans[scanIndex]

  // Image zoom (percent of the pane width). 100 = fill the column. Steps in 25%.
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
            defaultValue={doc.title}
            className="w-full max-w-xl bg-transparent border-0 font-serif-content text-lg focus:outline-none focus:bg-white focus:rounded focus:px-2 focus:py-0.5"
          />
        </div>
        <span className="save-status" style={{ opacity: 0.6 }}>
          <span className="dot" style={{ background: 'var(--ink-faint)' }}></span>
          Read only (save in next commit)
        </span>
        <div className="h-6 w-px bg-[color:var(--border-soft)]"></div>
        <button className="pill-btn">History</button>
        <div className="w-8 h-8 rounded-full bg-seal text-white flex items-center justify-center text-sm font-medium">
          {userInitial}
        </div>
      </header>

      <div className={styles.editMain}>
        {/* IMAGE PANE */}
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
          <div
            className={`${styles.scrollArea} scroll-area bg-paper-warm`}
            style={{ overflow: 'auto', padding: '1rem' }}
          >
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

        {/* CHINESE PANE */}
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
              style={{ fontSize: `${chineseSize}px` }}
            />
          </div>
        </div>

        {/* ENGLISH PANE */}
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
              style={{ fontSize: `${englishSize}px` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
