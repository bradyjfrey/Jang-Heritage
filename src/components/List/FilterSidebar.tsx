'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

const ALL_TYPES = [
  'letter',
  'diary',
  'photo',
  'article',
  'document',
  'note',
] as const
type DocType = (typeof ALL_TYPES)[number]

type Props = {
  selectedTypes: ReadonlyArray<DocType>
  typeCounts: Record<DocType, number>
}

// Filter sidebar for /list. URL is the source of truth: each toggle pushes a
// new querystring and the list page re-renders. Defaults to all types
// selected (matches feedback_filter_defaults memory: users reduce, never add).
export function FilterSidebar({ selectedTypes, typeCounts }: Props) {
  const router = useRouter()
  const params = useSearchParams()

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

  return (
    <aside className="w-72 border-r border-[color:var(--border-soft)] bg-paper p-6 sticky top-32 self-start min-h-[calc(100vh-8rem)] overflow-auto">
      <div className="flex items-center justify-between mb-5">
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
      </div>
    </aside>
  )
}
