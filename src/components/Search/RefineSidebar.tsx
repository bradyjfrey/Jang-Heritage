'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

// Refine sidebar for /search. URL-param-driven so filter state survives reload
// and is shareable. Defaults are "all selected" — when every option in a group
// is on, the param is absent from the URL. Unchecking emits a comma-list.

const MATCH_IN_OPTIONS = [
  { value: 'transcription', label: '中文 transcription' },
  { value: 'translation', label: 'English translation' },
  { value: 'note-body', label: 'Note body' },
  { value: 'title', label: 'Title' },
] as const

const TYPE_OPTIONS = [
  'letter',
  'diary',
  'photo',
  'article',
  'document',
  'note',
] as const

// Year picker range. Floor of 1900 covers early-1900s immigration-era
// letters; ceiling tracks the current year. From-dropdown lists ascending
// (1900 first) so the floor is at the top, To-dropdown descending (current
// year first) so the most recent year is at the top.
const CURRENT_YEAR = new Date().getFullYear()
const YEARS_ASC: number[] = []
const YEARS_DESC: number[] = []
for (let y = 1900; y <= CURRENT_YEAR; y++) YEARS_ASC.push(y)
for (let y = CURRENT_YEAR; y >= 1900; y--) YEARS_DESC.push(y)

type Option = { value: string; label: string }

type Props = {
  tags: Option[]
  translators: Option[]
  // Document types actually present in the unfiltered FTS result set. Other
  // types are hidden from the sidebar so users don't see filters that would
  // always return zero.
  availableTypes: string[]
}

export function RefineSidebar({ tags, translators, availableTypes }: Props) {
  const router = useRouter()
  const sp = useSearchParams()

  // Read the current selection per group: null = all (no filter); a Set means
  // only those values are checked.
  const matchIn = parseList(sp.get('matchIn'))
  const types = parseList(sp.get('type'))
  const tagSel = parseList(sp.get('tag'))
  const fromYear = sp.get('from') || ''
  const toYear = sp.get('to') || ''
  const translator = sp.get('translator') || ''

  const hasAnyFilter = useMemo(() => {
    return Boolean(
      sp.get('matchIn') ||
        sp.get('type') ||
        sp.get('tag') ||
        sp.get('from') ||
        sp.get('to') ||
        sp.get('translator'),
    )
  }, [sp])

  const update = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(sp.toString())
      mutate(next)
      // Reset to first page on any filter change.
      next.delete('page')
      const qs = next.toString()
      router.replace(qs ? `/search?${qs}` : '/search', { scroll: false })
    },
    [sp, router],
  )

  // Toggle a single value in a multi-select group.
  const toggleMulti = (
    key: string,
    value: string,
    allValues: readonly string[],
  ) => {
    update((next) => {
      const current = parseList(next.get(key)) ?? new Set(allValues)
      if (current.has(value)) current.delete(value)
      else current.add(value)
      // If it ends up matching the universe, drop the param entirely.
      if (current.size === allValues.length) next.delete(key)
      else if (current.size === 0) {
        // No options checked is unrepresentable in our scheme; treat as all.
        next.delete(key)
      } else {
        next.set(key, [...current].join(','))
      }
    })
  }

  const setYear = (key: 'from' | 'to', value: string) => {
    update((next) => {
      if (value.trim() === '') next.delete(key)
      else next.set(key, value.trim())
    })
  }

  const setTranslator = (value: string) => {
    update((next) => {
      if (!value) next.delete('translator')
      else next.set('translator', value)
    })
  }

  const clearAll = () => {
    update((next) => {
      next.delete('matchIn')
      next.delete('type')
      next.delete('tag')
      next.delete('from')
      next.delete('to')
      next.delete('translator')
    })
  }

  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <aside className="border-b md:border-b-0 md:border-r border-[color:var(--border-soft)] bg-paper md:w-72 md:shrink-0 md:p-6 md:sticky md:top-32 md:self-start md:max-h-[calc(100dvh-8rem)] md:overflow-auto">
      <button
        type="button"
        onClick={() => setMobileOpen((o) => !o)}
        className="md:hidden w-full flex items-center justify-between px-4 py-3.5 text-left"
        aria-expanded={mobileOpen}
        aria-controls="refine-content"
      >
        <span className="font-serif-content text-lg">
          Refine{hasAnyFilter ? ' · active' : ''}
        </span>
        <span className="text-ink-faint text-sm">{mobileOpen ? '▲' : '▼'}</span>
      </button>
      <div
        id="refine-content"
        className={`${mobileOpen ? 'block' : 'hidden'} md:block px-4 pb-4 md:p-0`}
      >
        <div className="hidden md:flex items-center justify-between mb-5">
          <h2 className="font-serif-content text-lg">Refine</h2>
          {hasAnyFilter ? (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-seal hover:underline"
            >
              Clear
            </button>
          ) : null}
        </div>

      <div className="space-y-6 text-sm">
        <Group label="Match in">
          {MATCH_IN_OPTIONS.map((opt) => {
            const checked = matchIn ? matchIn.has(opt.value) : true
            return (
              <CheckRow
                key={opt.value}
                label={opt.label}
                checked={checked}
                onChange={() =>
                  toggleMulti(
                    'matchIn',
                    opt.value,
                    MATCH_IN_OPTIONS.map((o) => o.value),
                  )
                }
              />
            )
          })}
        </Group>

        {availableTypes.length > 0 ? (
          <Group label="Type">
            {TYPE_OPTIONS.filter((value) => availableTypes.includes(value)).map(
              (value) => {
                const checked = types ? types.has(value) : true
                return (
                  <CheckRow
                    key={value}
                    label={value}
                    checked={checked}
                    onChange={() =>
                      toggleMulti(
                        'type',
                        value,
                        TYPE_OPTIONS.filter((v) =>
                          availableTypes.includes(v),
                        ),
                      )
                    }
                  />
                )
              },
            )}
          </Group>
        ) : null}

        <Group label="Year">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={fromYear}
              onChange={(e) => setYear('from', e.target.value)}
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
              onChange={(e) => setYear('to', e.target.value)}
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
            By the document&apos;s original date (e.g. when a letter was
            written), not when you added it.
          </p>
        </Group>

        {tags.length > 0 ? (
          <Group label="Tags">
            {tags.map((tag) => {
              const checked = tagSel ? tagSel.has(tag.value) : true
              return (
                <CheckRow
                  key={tag.value}
                  label={tag.label}
                  checked={checked}
                  onChange={() =>
                    toggleMulti(
                      'tag',
                      tag.value,
                      tags.map((t) => t.value),
                    )
                  }
                />
              )
            })}
          </Group>
        ) : null}

        <Group label="Translator">
          <select
            value={translator}
            onChange={(e) => setTranslator(e.target.value)}
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
        </Group>

        {hasAnyFilter ? (
          <button
            type="button"
            onClick={clearAll}
            className="md:hidden text-xs text-seal hover:underline"
          >
            Clear filters
          </button>
        ) : null}
      </div>
      </div>
    </aside>
  )
}

function Group({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-ink-faint mb-2">
        {label}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="accent-seal"
      />
      <span>{label}</span>
    </label>
  )
}

function parseList(raw: string | null | undefined): Set<string> | null {
  if (!raw) return null
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0) return null
  return new Set(parts)
}
