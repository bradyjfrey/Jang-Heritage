'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Tag } from '@/payload-types'

type Props = {
  documentId: number
  initialTags: Tag[]
  initialUpdatedAt: string
  canEdit?: boolean
}

type SaveStatus = 'idle' | 'saving' | 'error' | 'conflict'

// Inline tag picker for the document detail page. Type to filter existing
// tags; if the query doesn't match anything, "Create '<query>'" appears as
// the last option and POSTs a new Tag before attaching it.
//
// Saves are PATCH /api/documents/<id> with the updated tag-id array, gated
// by X-If-Unmodified-Since so a stale tab loses the race instead of clobbering.
export function TagEditor({
  documentId,
  initialTags,
  initialUpdatedAt,
  canEdit = true,
}: Props) {
  const router = useRouter()
  const [tags, setTags] = useState<Tag[]>(initialTags)
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Tag[]>([])
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounced suggestion fetch. We only fetch when query has content; the
  // dropdown render is already gated by `trimmedQuery` (line ~269), so
  // empty-query renders nothing without us having to reset state here.
  useEffect(() => {
    const q = query.trim()
    if (!q) return
    let cancelled = false
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/tags?where[name][contains]=${encodeURIComponent(q)}&limit=10&depth=0`,
          { credentials: 'include' },
        )
        if (!res.ok) return
        const json = await res.json()
        if (cancelled) return
        const existingIds = new Set(tags.map((t) => t.id))
        const filtered = (json.docs || []).filter(
          (t: Tag) => !existingIds.has(t.id),
        )
        setSuggestions(filtered)
      } catch {
        if (!cancelled) setSuggestions([])
      }
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query, tags])

  // Click-outside closes the dropdown.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function persist(nextTags: Tag[]) {
    setStatus('saving')
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-If-Unmodified-Since': updatedAt,
        },
        body: JSON.stringify({ tags: nextTags.map((t) => t.id) }),
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
      console.error('Tag save failed', err)
      setStatus('error')
    }
  }

  async function addExisting(tag: Tag) {
    if (tags.some((t) => t.id === tag.id)) return
    const next = [...tags, tag]
    setTags(next)
    setQuery('')
    setSuggestions([])
    inputRef.current?.focus()
    await persist(next)
  }

  async function createAndAdd(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    setStatus('saving')
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) throw new Error(`POST tags failed: ${res.status}`)
      const json = await res.json()
      const created: Tag = json?.doc ?? json
      const next = [...tags, created]
      setTags(next)
      setQuery('')
      setSuggestions([])
      inputRef.current?.focus()
      await persist(next)
    } catch (err) {
      console.error('Create tag failed', err)
      setStatus('error')
    }
  }

  async function remove(tagId: number) {
    const next = tags.filter((t) => t.id !== tagId)
    setTags(next)
    await persist(next)
  }

  const trimmedQuery = query.trim()
  const exactExists =
    trimmedQuery &&
    (suggestions.some(
      (s) => s.name.toLowerCase() === trimmedQuery.toLowerCase(),
    ) ||
      tags.some(
        (t) => t.name.toLowerCase() === trimmedQuery.toLowerCase(),
      ))

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions[0]) {
        void addExisting(suggestions[0])
      } else if (trimmedQuery && !exactExists) {
        void createAndAdd(trimmedQuery)
      }
    } else if (e.key === 'Escape') {
      setQuery('')
      setOpen(false)
    }
  }

  if (!canEdit) {
    if (tags.length === 0) return null
    return (
      <section className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-5">
        <div className="text-[11px] uppercase tracking-wider text-ink-faint mb-3">
          Tags
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="chip"
              style={
                tag.color
                  ? {
                      background: `${tag.color}1f`,
                      color: tag.color,
                      borderColor: `${tag.color}40`,
                    }
                  : undefined
              }
            >
              {tag.name}
            </span>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-wider text-ink-faint">
          Tags
        </div>
        {status === 'saving' ? (
          <span className="text-[11px] text-ink-faint">Saving…</span>
        ) : status === 'error' ? (
          <span className="text-[11px] text-seal">Save failed</span>
        ) : status === 'conflict' ? (
          <span className="text-[11px] text-seal">Conflict, refresh</span>
        ) : null}
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="chip inline-flex items-center gap-1"
              style={
                tag.color
                  ? {
                      background: `${tag.color}1f`,
                      color: tag.color,
                      borderColor: `${tag.color}40`,
                    }
                  : undefined
              }
            >
              {tag.name}
              <button
                type="button"
                onClick={() => void remove(tag.id)}
                className="text-current opacity-60 hover:opacity-100"
                aria-label={`Remove ${tag.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div ref={containerRef} className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder="Add a tag…"
          className="w-full bg-paper-warm border border-[color:var(--border-soft)] rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gold"
        />
        {open && trimmedQuery ? (
          <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-[color:var(--border-soft)] rounded-md shadow-sm z-10 overflow-hidden">
            {suggestions.length > 0 ? (
              <ul className="max-h-60 overflow-auto">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => void addExisting(s)}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-paper-warm"
                    >
                      {s.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {!exactExists ? (
              <button
                type="button"
                onClick={() => void createAndAdd(trimmedQuery)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-paper-warm border-t border-[color:var(--border-soft)]"
              >
                Create <span className="font-medium">&ldquo;{trimmedQuery}&rdquo;</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
