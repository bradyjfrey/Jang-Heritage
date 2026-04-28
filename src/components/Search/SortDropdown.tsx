'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export function SortDropdown() {
  const router = useRouter()
  const sp = useSearchParams()
  const sort = sp.get('sort') || 'relevance'

  function change(value: string) {
    const next = new URLSearchParams(sp.toString())
    if (value === 'relevance') next.delete('sort')
    else next.set('sort', value)
    next.delete('page')
    router.replace(`/search?${next.toString()}`, { scroll: false })
  }

  return (
    <select
      value={sort}
      onChange={(e) => change(e.target.value)}
      className="bg-surface border border-[color:var(--border-soft)] rounded px-3 py-1.5 text-sm"
    >
      <option value="relevance">Most relevant</option>
      <option value="newest">Newest first</option>
      <option value="oldest">Oldest first</option>
    </select>
  )
}
