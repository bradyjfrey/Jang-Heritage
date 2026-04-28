'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type SaveStatus = 'idle' | 'saving' | 'error' | 'conflict'

type Option = { id: number; label: string }

type Row = {
  id: number
  collection: 'transcriptions' | 'translations'
  currentUserId: number | null
  updatedAt: string
}

type Props = {
  transcription: Row | null
  translation: Row | null
  transcribers: Option[]
  translators: Option[]
  canEdit?: boolean
  // Resolved label of the currently-assigned user, for read-only mode.
  transcriberName?: string | null
  translatorName?: string | null
}

// People section: Transcriber dropdown lives on the Transcription row,
// Translator dropdown on the Translation row. Each PATCH uses
// X-If-Unmodified-Since for optimistic concurrency. Sections only render
// when the related row exists; otherwise we tell the user to seed it via
// the editor (no surprise empty rows).
export function PeopleEditor({
  transcription,
  translation,
  transcribers,
  translators,
  canEdit = true,
  transcriberName,
  translatorName,
}: Props) {
  if (!canEdit) {
    // Don't render an empty People section to viewers when no one has been
    // assigned yet — there's nothing to read.
    if (!transcriberName && !translatorName) return null
    return (
      <section className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-5">
        <div className="text-[11px] uppercase tracking-wider text-ink-faint mb-3">
          People
        </div>
        <div className="space-y-3 text-sm">
          {transcriberName ? (
            <div>
              <span className="text-xs text-ink-faint block">Transcriber</span>
              <div>{transcriberName}</div>
            </div>
          ) : null}
          {translatorName ? (
            <div>
              <span className="text-xs text-ink-faint block">Translator</span>
              <div>{translatorName}</div>
            </div>
          ) : null}
        </div>
      </section>
    )
  }

  if (!transcription && !translation) {
    return (
      <section className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-5">
        <div className="text-[11px] uppercase tracking-wider text-ink-faint mb-3">
          People
        </div>
        <p className="text-sm text-ink-soft">
          Open the editor to add a transcription or translation; you can assign
          a transcriber and translator after.
        </p>
      </section>
    )
  }

  return (
    <section className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-5">
      <div className="text-[11px] uppercase tracking-wider text-ink-faint mb-3">
        People
      </div>
      <div className="space-y-3 text-sm">
        {transcription ? (
          <PersonField
            label="Transcriber"
            row={transcription}
            options={transcribers}
            field="transcriber"
          />
        ) : (
          <p className="text-xs text-ink-faint">
            No transcription yet. Add one in the editor to assign a transcriber.
          </p>
        )}
        {translation ? (
          <PersonField
            label="Translator"
            row={translation}
            options={translators}
            field="translator"
          />
        ) : (
          <p className="text-xs text-ink-faint">
            No translation yet. Add one in the editor to assign a translator.
          </p>
        )}
      </div>
    </section>
  )
}

function PersonField({
  label,
  row,
  options,
  field,
}: {
  label: string
  row: Row
  options: Option[]
  field: 'transcriber' | 'translator'
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string>(
    row.currentUserId !== null ? String(row.currentUserId) : '',
  )
  const [updatedAt, setUpdatedAt] = useState(row.updatedAt)
  const [status, setStatus] = useState<SaveStatus>('idle')

  async function onChange(value: string) {
    setSelected(value)
    setStatus('saving')
    try {
      const res = await fetch(`/api/${row.collection}/${row.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-If-Unmodified-Since': updatedAt,
        },
        body: JSON.stringify({
          [field]: value ? Number.parseInt(value, 10) : null,
        }),
      })
      if (res.status === 409) {
        setStatus('conflict')
        return
      }
      if (!res.ok) {
        // 401/403 (or anything else): surface as a quiet status, no throw —
        // throwing here in dev creates noisy red overlays for routine perms.
        setStatus('error')
        return
      }
      const json = await res.json()
      const updated = json?.doc ?? json
      if (updated?.updatedAt) setUpdatedAt(updated.updatedAt)
      setStatus('idle')
      router.refresh()
    } catch (err) {
      console.error('People save failed', err)
      setStatus('error')
    }
  }

  return (
    <label className="block">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-faint">{label}</span>
        {status === 'saving' ? (
          <span className="text-[11px] text-ink-faint">Saving…</span>
        ) : status === 'error' ? (
          <span className="text-[11px] text-seal">Save failed</span>
        ) : status === 'conflict' ? (
          <span className="text-[11px] text-seal">Conflict, refresh</span>
        ) : null}
      </div>
      <select
        value={selected}
        onChange={(e) => void onChange(e.target.value)}
        className="mt-1 w-full bg-paper-warm border border-[color:var(--border-soft)] rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gold"
      >
        <option value="">Unassigned</option>
        {options.map((o) => (
          <option key={o.id} value={String(o.id)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
