'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type SaveStatus = 'idle' | 'saving' | 'error' | 'conflict'

const PRECISION_OPTIONS = [
  { value: 'day', label: 'day' },
  { value: 'month', label: 'month' },
  { value: 'year', label: 'year' },
  { value: 'decade', label: 'decade' },
  { value: 'unknown', label: 'unknown' },
] as const

// Types we expose for inline editing. Excludes 'note' — toggling between
// scan-bearing and note types would orphan body/scans data, so that switch
// is reserved for the admin UI.
const EDITABLE_TYPE_OPTIONS = [
  'letter',
  'diary',
  'photo',
  'article',
  'document',
] as const

type Props = {
  documentId: number
  initialUpdatedAt: string
  documentType: string
  dateOriginal: string | null | undefined
  dateOriginalPrecision: string | null | undefined
  scanCount: number
  // When false, render read-only labels instead of inputs.
  canEdit?: boolean
}

// Inline metadata editor for the doc detail sidebar. Each field auto-saves
// after a short debounce. Concurrency is enforced via X-If-Unmodified-Since,
// matching TagEditor; a stale tab gets a 409 and we surface the conflict.
export function DetailsEditor({
  documentId,
  initialUpdatedAt,
  documentType,
  dateOriginal,
  dateOriginalPrecision,
  scanCount,
  canEdit = true,
}: Props) {
  const router = useRouter()
  const [type, setType] = useState(documentType)
  const [dateInput, setDateInput] = useState(toDateInputValue(dateOriginal))
  const [precision, setPrecision] = useState(dateOriginalPrecision || 'unknown')
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep local state in sync if the server rerenders with newer values
  // (e.g., another section saved and bumped updatedAt).
  useEffect(() => {
    setUpdatedAt(initialUpdatedAt)
  }, [initialUpdatedAt])

  const isNote = type === 'note'

  if (!canEdit) {
    const dateLabel = formatDateForDisplay(dateOriginal, precision)
    return (
      <section className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-5">
        <div className="text-[11px] uppercase tracking-wider text-ink-faint mb-3">
          Details
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-xs text-ink-faint block">Type</span>
            <div>{type}</div>
          </div>
          {dateLabel ? (
            <div>
              <span className="text-xs text-ink-faint block">Date</span>
              <div>{dateLabel}</div>
            </div>
          ) : null}
          {!isNote && scanCount > 0 ? (
            <div className="flex justify-between gap-4 pt-1 text-ink-soft">
              <span>Scans</span>
              <span>
                {scanCount} page{scanCount === 1 ? '' : 's'}
              </span>
            </div>
          ) : null}
        </div>
      </section>
    )
  }

  async function persist(patch: Record<string, unknown>) {
    setStatus('saving')
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-If-Unmodified-Since': updatedAt,
        },
        body: JSON.stringify(patch),
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
      setStatus('idle')
      router.refresh()
    } catch (err) {
      console.error('Details save failed', err)
      setStatus('error')
    }
  }

  function scheduleSave(patch: Record<string, unknown>, delay = 400) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void persist(patch)
    }, delay)
  }

  function commitImmediate(patch: Record<string, unknown>) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    void persist(patch)
  }

  function onDateChange(value: string) {
    setDateInput(value)
    scheduleSave({ dateOriginal: value || null })
  }

  function onPrecisionChange(value: string) {
    setPrecision(value)
    commitImmediate({ dateOriginalPrecision: value })
  }

  function onTypeChange(value: string) {
    setType(value)
    commitImmediate({ documentType: value })
  }

  return (
    <section className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-wider text-ink-faint">
          Details
        </div>
        {status === 'saving' ? (
          <span className="text-[11px] text-ink-faint">Saving…</span>
        ) : status === 'error' ? (
          <span className="text-[11px] text-seal">Save failed</span>
        ) : status === 'conflict' ? (
          <span className="text-[11px] text-seal">Conflict, refresh</span>
        ) : null}
      </div>

      <div className="space-y-3 text-sm">
        <label className="block">
          <span className="text-xs text-ink-faint">Type</span>
          {isNote ? (
            <div className="mt-1 px-2 py-1.5">note</div>
          ) : (
            <select
              value={type}
              onChange={(e) => onTypeChange(e.target.value)}
              className="mt-1 w-full bg-paper-warm border border-[color:var(--border-soft)] rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gold"
            >
              {EDITABLE_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </label>

        <div>
          <span className="text-xs text-ink-faint">Date</span>
          <div className="mt-1 grid grid-cols-[1fr_auto] gap-2">
            <input
              type="date"
              value={dateInput}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-paper-warm border border-[color:var(--border-soft)] rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gold"
            />
            <select
              value={precision}
              onChange={(e) => onPrecisionChange(e.target.value)}
              className="bg-paper-warm border border-[color:var(--border-soft)] rounded px-2 py-1.5 text-sm text-ink-soft focus:outline-none focus:border-gold"
            >
              {PRECISION_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!isNote && scanCount > 0 ? (
          <div className="flex justify-between gap-4 pt-1 text-ink-soft">
            <span>Scans</span>
            <span>
              {scanCount} page{scanCount === 1 ? '' : 's'}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  )
}

// Format the doc's date for the read-only viewer view. Mirrors the helper
// on the doc detail page so non-editors see the same string anywhere.
function formatDateForDisplay(
  iso: string | null | undefined,
  precision: string | null | undefined,
): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  switch (precision) {
    case 'day':
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    case 'month':
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    case 'year':
      return String(d.getFullYear())
    case 'decade':
      return `${Math.floor(d.getFullYear() / 10) * 10}s`
    case 'unknown':
      return ''
    default:
      return d.toLocaleDateString()
  }
}

// HTML <input type="date"> wants YYYY-MM-DD with no timezone. Convert from
// the ISO timestamp Payload returns.
function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
