'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'

const ALL_TYPES = [
  'letter',
  'diary',
  'photo',
  'article',
  'document',
  'note',
] as const
type DocType = (typeof ALL_TYPES)[number]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS_ASC: number[] = []
const YEARS_DESC: number[] = []
for (let y = 1900; y <= CURRENT_YEAR; y++) YEARS_ASC.push(y)
for (let y = CURRENT_YEAR; y >= 1900; y--) YEARS_DESC.push(y)

type Option = { value: string; label: string }

type Props = {
  selectedTypes: ReadonlyArray<DocType>
  typeCounts: Record<DocType, number>
  translators: Option[]
}

// Filter sidebar for /list. URL is the source of truth: each toggle pushes a
// new querystring and the list page re-renders. Defaults to all types
// selected (matches feedback_filter_defaults memory: users reduce, never add).
export function FilterSidebar({
  selectedTypes,
  typeCounts,
  translators,
}: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const fromYear = params.get('from') || ''
  const toYear = params.get('to') || ''
  const translator = params.get('translator') || ''

  const updateUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') next.delete(key)
        else next.set(key, value)
      }
      next.delete('page')
      const qs = next.toString()
      router.push(qs ? `/list?${qs}` : '/list')
    },
    [params, router],
  )

  const toggleType = useCallback(
    (type: DocType) => {
      const current = new Set(selectedTypes)
      if (current.has(type)) current.delete(type)
      else current.add(type)
      const isAll = ALL_TYPES.every((t) => current.has(t))
      updateUrl({ type: isAll ? null : [...current].join(',') })
    },
    [selectedTypes, updateUrl],
  )

  const clearFilters = useCallback(() => {
    router.push('/list')
  }, [router])

  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <aside className="border-b md:border-b-0 md:border-r border-[color:var(--border-soft)] bg-paper md:w-72 md:p-6 md:sticky md:top-32 md:self-start md:min-h-[calc(100dvh-8rem)] md:overflow-auto">
      <button
        type="button"
        onClick={() => setMobileOpen((o) => !o)}
        className="md:hidden w-full flex items-center justify-between px-4 py-3.5 text-left"
        aria-expanded={mobileOpen}
        aria-controls="filter-content"
      >
        <span className="font-serif-content text-lg">Filters</span>
        <span className="text-ink-faint text-sm">{mobileOpen ? '▲' : '▼'}</span>
      </button>
      <div
        id="filter-content"
        className={`${mobileOpen ? 'block' : 'hidden'} md:block px-4 pb-4 md:p-0`}
      >
        <div className="hidden md:flex items-center justify-between mb-5">
          <h2 className="font-serif-content text-lg">Filters</h2>
          <button onClick={clearFilters} className="text-xs text-seal hover:underline">
            Clear
          </button>
        </div>

      <div className="space-y-6 text-sm">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-faint mb-2">
            Type
          </div>
          <div className="space-y-1.5">
            {ALL_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(type)}
                  onChange={() => toggleType(type)}
                />
                <span className="capitalize">{type}</span>
                <span className="text-ink-faint ml-auto text-xs">
                  {typeCounts[type] ?? 0}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-faint mb-2">
            Year
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={fromYear}
              onChange={(e) => updateUrl({ from: e.target.value || null })}
              className="bg-surface border border-[color:var(--border-soft)] rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gold"
            >
              <option value="">From</option>
              {YEARS_ASC.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={toYear}
              onChange={(e) => updateUrl({ to: e.target.value || null })}
              className="bg-surface border border-[color:var(--border-soft)] rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gold"
            >
              <option value="">To</option>
              {YEARS_DESC.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            By the document&apos;s original date.
          </p>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-faint mb-2">
            Translator
          </div>
          <select
            value={translator}
            onChange={(e) => updateUrl({ translator: e.target.value || null })}
            className="w-full bg-surface border border-[color:var(--border-soft)] rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gold"
          >
            <option value="">Anyone</option>
            <option value="untranslated">Untranslated</option>
            {translators.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={clearFilters}
          className="md:hidden text-xs text-seal hover:underline"
        >
          Clear filters
        </button>
      </div>
      </div>
    </aside>
  )
}
