import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Chrome } from '@/components/Chrome/Chrome'
import { CopyButton } from '@/components/CopyButton/CopyButton'
import { NoteBody } from '@/components/NoteBody/NoteBody'
import { DetailsEditor } from '@/components/DocumentView/DetailsEditor'
import { HistoryTimeline } from '@/components/DocumentView/HistoryTimeline'
import { PeopleEditor } from '@/components/DocumentView/PeopleEditor'
import { PinButton } from '@/components/DocumentView/PinButton'
import { ScanViewer } from '@/components/DocumentView/ScanViewer'
import { TagEditor } from '@/components/DocumentView/TagEditor'
import type { Media, Tag, User } from '@/payload-types'

const HISTORY_LIMIT = 5

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

  const [transcriptions, translations, transcribersList, translatorsList] =
    await Promise.all([
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
      payload.find({
        collection: 'users',
        where: { isTranscriber: { equals: true } },
        limit: 50,
        sort: 'displayName',
        depth: 0,
      }),
      payload.find({
        collection: 'users',
        where: { isTranslator: { equals: true } },
        limit: 50,
        sort: 'displayName',
        depth: 0,
      }),
    ])
  const transcription = transcriptions.docs[0]
  const translation = translations.docs[0]

  // Pull versions for the doc and (when present) its transcription /
  // translation. Merge into a single timeline; cap at HISTORY_LIMIT for the
  // sidebar and surface the rest count as "+ N earlier edits".
  const [docVersions, transcriptionVersions, translationVersions] =
    await Promise.all([
      payload.findVersions({
        collection: 'documents',
        where: { parent: { equals: docId } },
        sort: '-updatedAt',
        limit: HISTORY_LIMIT * 3,
        depth: 1,
      }),
      transcription
        ? payload.findVersions({
            collection: 'transcriptions',
            where: { parent: { equals: transcription.id } },
            sort: '-updatedAt',
            limit: HISTORY_LIMIT * 3,
            depth: 1,
          })
        : Promise.resolve({ docs: [], totalDocs: 0 } as { docs: unknown[]; totalDocs: number }),
      translation
        ? payload.findVersions({
            collection: 'translations',
            where: { parent: { equals: translation.id } },
            sort: '-updatedAt',
            limit: HISTORY_LIMIT * 3,
            depth: 1,
          })
        : Promise.resolve({ docs: [], totalDocs: 0 } as { docs: unknown[]; totalDocs: number }),
    ])

  type AnyVersion = {
    id: string | number
    parent: unknown
    createdAt?: string
    updatedAt?: string
    version?: { lastEditedBy?: unknown }
  }
  function buildEntries(
    rows: { docs: unknown[] },
    collection: 'documents' | 'transcriptions' | 'translations',
    label: 'Document' | 'Transcription' | 'Translation',
  ) {
    const docs = rows.docs as AnyVersion[]
    // Payload returns newest first when sorted by -updatedAt. Number them
    // from the total down so the most recent version has the highest v#.
    return docs.map((row, i) => {
      const total = docs.length
      const versionNumber = total - i
      const editor = row.version?.lastEditedBy
      const editorLabel = userLabel(editor)
      return {
        key: `${collection}-${row.id}`,
        collectionLabel: label,
        versionNumber,
        createdAt: row.updatedAt || row.createdAt || '',
        editor: editorLabel || null,
      } as const
    })
  }

  const allEntries = [
    ...buildEntries(docVersions, 'documents', 'Document'),
    ...(transcription
      ? buildEntries(transcriptionVersions, 'transcriptions', 'Transcription')
      : []),
    ...(translation
      ? buildEntries(translationVersions, 'translations', 'Translation')
      : []),
  ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))

  const transcriberOptions = transcribersList.docs.map((u: User) => ({
    id: u.id,
    label: u.displayName || u.email || `User ${u.id}`,
  }))
  const translatorOptions = translatorsList.docs.map((u: User) => ({
    id: u.id,
    label: u.displayName || u.email || `User ${u.id}`,
  }))

  const transcriptionRow = transcription
    ? {
        id: transcription.id,
        collection: 'transcriptions' as const,
        currentUserId:
          typeof transcription.transcriber === 'number'
            ? transcription.transcriber
            : transcription.transcriber?.id ?? null,
        updatedAt: transcription.updatedAt,
      }
    : null
  const translationRow = translation
    ? {
        id: translation.id,
        collection: 'translations' as const,
        currentUserId:
          typeof translation.translator === 'number'
            ? translation.translator
            : translation.translator?.id ?? null,
        updatedAt: translation.updatedAt,
      }
    : null

  const scans = (Array.isArray(doc.scans) ? doc.scans : []).filter(
    (s): s is Media => typeof s === 'object' && s !== null,
  )
  const tags = (Array.isArray(doc.tags) ? doc.tags : []).filter(
    (t): t is Tag => typeof t === 'object' && t !== null,
  )

  const dateLabel = formatDate(doc.dateOriginal, doc.dateOriginalPrecision)
  const isNote = doc.documentType === 'note'
  const canEdit = user.role === 'admin' || user.role === 'editor'

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
      <Chrome user={user} active={isNote ? 'notes' : 'scans'} />

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
          {canEdit ? (
            <Link
              href={`/doc/${doc.id}/edit`}
              className="block w-full text-center bg-seal text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-black transition-colors"
            >
              {isNote ? 'Edit Note' : 'Edit Scan'}
            </Link>
          ) : null}

          <DetailsEditor
            documentId={doc.id}
            initialUpdatedAt={doc.updatedAt}
            documentType={doc.documentType}
            dateOriginal={doc.dateOriginal}
            dateOriginalPrecision={doc.dateOriginalPrecision}
            scanCount={scans.length}
            canEdit={canEdit}
          />

          <TagEditor
            documentId={doc.id}
            initialTags={tags}
            initialUpdatedAt={doc.updatedAt}
            canEdit={canEdit}
          />

          {isNote && noteEditorName ? (
            <section className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-5">
              <div className="text-[11px] uppercase tracking-wider text-ink-faint mb-3">
                Author
              </div>
              <div className="text-sm text-ink-soft">{noteEditorName}</div>
            </section>
          ) : null}

          {!isNote ? (
            <PeopleEditor
              transcription={transcriptionRow}
              translation={translationRow}
              transcribers={transcriberOptions}
              translators={translatorOptions}
              canEdit={canEdit}
              transcriberName={transcriberName || null}
              translatorName={translatorName || null}
            />
          ) : null}

          <HistoryTimeline entries={allEntries} collapsedLimit={HISTORY_LIMIT} />

          <a
            href={`/api/documents/${doc.id}/export`}
            className="block w-full bg-paper-warm hover:bg-seal border border-[color:var(--border-soft)] hover:border-seal rounded-lg p-3 text-sm font-bold text-ink-soft hover:text-white text-center transition-colors"
          >
            ⤓ Export Bundle (zip)
          </a>
        </aside>
      </main>
    </>
  )
}
