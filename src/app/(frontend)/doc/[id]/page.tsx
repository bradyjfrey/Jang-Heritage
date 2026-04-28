import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Chrome } from '@/components/Chrome/Chrome'
import { CopyButton } from '@/components/CopyButton/CopyButton'
import { NoteBody } from '@/components/NoteBody/NoteBody'
import { PinButton } from '@/components/DocumentView/PinButton'
import { ScanViewer } from '@/components/DocumentView/ScanViewer'
import { TagEditor } from '@/components/DocumentView/TagEditor'
import type { Media, Tag, User } from '@/payload-types'

function formatDate(
  iso: string | null | undefined,
  precision: string | null | undefined,
): string {
  if (!iso) return ''
  const d = new Date(iso)
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
      return 'Unknown date'
    default:
      return d.toLocaleDateString()
  }
}

function relativeTime(iso: string | undefined | null): string {
  if (!iso) return ''
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
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function userLabel(value: number | User | null | undefined): string {
  if (!value || typeof value !== 'object') return ''
  return value.displayName || value.email || ''
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const docId = Number.parseInt(id, 10)
  if (Number.isNaN(docId)) notFound()

  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  if (!user) {
    const next = encodeURIComponent(`/doc/${docId}`)
    redirect(`/login?redirect=${next}`)
  }

  const doc = await payload
    .findByID({ collection: 'documents', id: docId, depth: 2 })
    .catch(() => null)
  if (!doc) notFound()

  const [transcriptions, translations] = await Promise.all([
    payload.find({
      collection: 'transcriptions',
      where: { document: { equals: docId } },
      limit: 1,
      depth: 1,
    }),
    payload.find({
      collection: 'translations',
      where: { document: { equals: docId } },
      limit: 1,
      depth: 1,
    }),
  ])
  const transcription = transcriptions.docs[0]
  const translation = translations.docs[0]

  const scans = (Array.isArray(doc.scans) ? doc.scans : []).filter(
    (s): s is Media => typeof s === 'object' && s !== null,
  )
  const tags = (Array.isArray(doc.tags) ? doc.tags : []).filter(
    (t): t is Tag => typeof t === 'object' && t !== null,
  )

  const dateLabel = formatDate(doc.dateOriginal, doc.dateOriginalPrecision)
  const isNote = doc.documentType === 'note'

  // Prefer lastEditedBy (auto-stamped on every save). Fall back to the
  // semantic transcriber/translator field for rows saved before the
  // lastEditedBy hook landed.
  const transcriberName =
    userLabel(transcription?.lastEditedBy) ||
    userLabel(transcription?.transcriber)
  const translatorName =
    userLabel(translation?.lastEditedBy) ||
    userLabel(translation?.translator)
  const noteEditorName = userLabel(doc.lastEditedBy)
  const transcriptionEdited = relativeTime(transcription?.updatedAt)
  const translationEdited = relativeTime(translation?.updatedAt)
  const noteEdited = relativeTime(doc.updatedAt)

  return (
    <>
      <Chrome
        user={user}
        below={{
          type: 'breadcrumb',
          items: [
            { label: 'Home', href: '/' },
            { label: 'Documents', href: '/list' },
            { label: doc.title },
          ],
        }}
      />

      <main className="max-w-7xl mx-auto px-8 py-10 grid grid-cols-[1fr_18rem] gap-10">
        <div>
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="font-serif-content text-3xl">{doc.title}</h1>
              <PinButton
                documentId={doc.id}
                initialPinned={Boolean(doc.pinned)}
              />
            </div>
            {dateLabel ? (
              <div className="text-sm text-ink-soft">{dateLabel}</div>
            ) : null}
          </div>

          {isNote ? (
            doc.body ? (
              <section className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-serif-content text-xl">Note:</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-ink-soft">
                      {noteEditorName ? `by ${noteEditorName} · ` : ''}
                      {noteEdited ? `last edit ${noteEdited}` : ''}
                    </span>
                    <CopyButton text={doc.body} label="Copy note body" />
                  </div>
                </div>
                <div className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-8">
                  <NoteBody source={doc.body} />
                </div>
              </section>
            ) : (
              <div className="text-ink-faint text-sm py-8">
                This note is empty.
              </div>
            )
          ) : null}

          {!isNote && scans.length > 0 ? (
            <ScanViewer scans={scans} title={doc.title} />
          ) : null}

          {!isNote && transcription?.text ? (
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-serif-content text-xl font-cjk">中文录入</h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-soft">
                    {transcriberName ? `by ${transcriberName} · ` : ''}
                    {transcriptionEdited
                      ? `last edit ${transcriptionEdited}`
                      : ''}
                  </span>
                  <CopyButton
                    text={transcription.text || ''}
                    label="Copy Chinese transcription"
                  />
                </div>
              </div>
              <div className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-6 font-cjk text-base leading-loose whitespace-pre-line">
                {transcription.text}
              </div>
            </section>
          ) : null}

          {!isNote && translation?.text ? (
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-serif-content text-xl">English Translation</h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-soft">
                    {translatorName ? `by ${translatorName} · ` : ''}
                    {translationEdited
                      ? `last edit ${translationEdited}`
                      : ''}
                  </span>
                  <CopyButton
                    text={translation.text || ''}
                    label="Copy English translation"
                  />
                </div>
              </div>
              <div className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-6 font-serif-content text-base leading-relaxed whitespace-pre-line">
                {translation.text}
              </div>
            </section>
          ) : null}

          {!isNote && doc.notes ? (
            <section className="mt-8">
              <h2 className="font-serif-content text-xl mb-3">Notes</h2>
              <div className="bg-paper-warm border border-[color:var(--border-soft)] rounded-lg p-5 text-sm text-ink whitespace-pre-line">
                {doc.notes}
              </div>
              <p className="mt-1 text-xs text-ink-faint">
                Sidecar notes about this document. Inline editing in a follow-up.
              </p>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <Link
            href={`/doc/${doc.id}/edit`}
            className="block w-full text-center bg-seal text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-black transition-colors"
          >
            {isNote ? 'Edit note' : 'Edit transcription & translation'}
          </Link>

          <section className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-5">
            <div className="text-[11px] uppercase tracking-wider text-ink-faint mb-3">
              Details
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-ink-faint block">Type</span>
                <div>{doc.documentType}</div>
              </div>
              {dateLabel ? (
                <div>
                  <span className="text-xs text-ink-faint block">Date</span>
                  <div>{dateLabel}</div>
                </div>
              ) : null}
              {!isNote && scans.length > 0 ? (
                <div className="flex justify-between gap-4 pt-1 text-ink-soft">
                  <span>Scans</span>
                  <span>
                    {scans.length} page{scans.length === 1 ? '' : 's'}
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          <TagEditor
            documentId={doc.id}
            initialTags={tags}
            initialUpdatedAt={doc.updatedAt}
          />
        </aside>
      </main>
    </>
  )
}
