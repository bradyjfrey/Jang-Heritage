'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

type Props = {
  total: number
  sort: string
  per: number
  view: 'grid' | 'table'
}

// Sort, per-page, and view-mode controls in the list header. Like the
// filter sidebar, pushes new URL params on change.
export function ListControls({ total, sort, per, view }: Props) {
  const router = useRouter()
  const params = useSearchParams()

  const update = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString())
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
      next.delete('page')
      const qs = next.toString()
      router.push(qs ? `/list?${qs}` : '/list')
    },
    [params, router],
  )

  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h1 className="font-serif-content text-2xl mb-1">Documents</h1>
        <p className="text-sm text-ink-soft">
          {total === 1 ? '1 entry' : `${total} entries`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={sort}
          onChange={(e) => update('sort', e.target.value === 'recent' ? null : e.target.value)}
          className="bg-surface border border-[color:var(--border-soft)] rounded px-3 py-1.5 text-sm"
        >
          <option value="recent">Recently edited</option>
          <option value="date-asc">Date (oldest first)</option>
          <option value="date-desc">Date (newest first)</option>
          <option value="title">Title (A→Z)</option>
        </select>
        <select
          value={String(per)}
          onChange={(e) => update('per', e.target.value === '48' ? null : e.target.value)}
          className="bg-surface border border-[color:var(--border-soft)] rounded px-3 py-1.5 text-sm"
        >
          <option value="24">24 per page</option>
          <option value="48">48 per page</option>
          <option value="96">96 per page</option>
        </select>
        <div className="flex border border-[color:var(--border-soft)] rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => update('view', null)}
            className={
              view === 'grid'
                ? 'px-3 py-1.5 bg-seal/10 text-seal text-sm'
                : 'px-3 py-1.5 text-ink-soft hover:bg-paper-warm text-sm'
            }
            aria-pressed={view === 'grid'}
          >
            Grid
          </button>
          <button
            type="button"
            onClick={() => update('view', 'table')}
            className={
              view === 'table'
                ? 'px-3 py-1.5 bg-seal/10 text-seal text-sm'
                : 'px-3 py-1.5 text-ink-soft hover:bg-paper-warm text-sm'
            }
            aria-pressed={view === 'table'}
          >
            Table
          </button>
        </div>
      </div>
    </div>
  )
}
