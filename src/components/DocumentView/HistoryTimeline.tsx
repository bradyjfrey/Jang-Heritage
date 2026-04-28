'use client'

import { useState } from 'react'

type Entry = {
  key: string
  collectionLabel: 'Document' | 'Transcription' | 'Translation'
  versionNumber: number
  createdAt: string
  editor: string | null
}

type Props = {
  entries: Entry[]
  collapsedLimit: number
}

// Read-only timeline of recent edits across the document and its
// transcription / translation rows. Collapsed by default; "View all"
// toggles to show every captured version in-place.
export function HistoryTimeline({ entries, collapsedLimit }: Props) {
  const [expanded, setExpanded] = useState(false)
  if (entries.length === 0) return null

  const visible = expanded ? entries : entries.slice(0, collapsedLimit)
  const hiddenCount = Math.max(0, entries.length - collapsedLimit)
  const canToggle = hiddenCount > 0

  return (
    <section className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-5">
      <div className="text-[11px] uppercase tracking-wider text-ink-faint mb-2">
        History
      </div>
      <div className="text-xs text-ink-soft">
        {visible.map((e) => (
          <div
            key={e.key}
            className="py-1.5 border-b border-[color:var(--border-soft)] last:border-b-0"
          >
            <span className="text-ink">v{e.versionNumber}</span>{' '}
            <span className="text-ink-faint">·</span> {relativeTime(e.createdAt)}{' '}
            <span className="text-ink-faint">·</span>{' '}
            {e.editor ? `${e.editor} · ` : ''}
            {e.collectionLabel}
          </div>
        ))}
        {canToggle ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="pt-2 text-seal hover:underline w-full inline-flex items-center gap-1 text-left"
          >
            {expanded ? (
              <>
                <span>Show less</span>
                <span className="text-base leading-none">▴</span>
              </>
            ) : (
              <>
                <span>
                  + {hiddenCount} earlier{' '}
                  {hiddenCount === 1 ? 'edit' : 'edits'}
                </span>
                <span className="text-base leading-none">▾</span>
              </>
            )}
          </button>
        ) : null}
      </div>
    </section>
  )
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return ''
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
