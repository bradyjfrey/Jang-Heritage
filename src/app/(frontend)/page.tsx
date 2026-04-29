import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Chrome } from '@/components/Chrome/Chrome'
import { NotePreview } from '@/components/NotePreview/NotePreview'
import type { Document, Media } from '@/payload-types'

function relativeTime(iso: string | undefined): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return ''
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return 'Just now'
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

export default async function HomePage() {
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  if (!user) redirect('/login?redirect=/')

  // All counts + lists in parallel.
  const [
    totalDocs,
    translatableDocsCount,
    transcribedCount,
    translatedCount,
    recentEdits,
    translatedDocIdsResult,
    pinnedResult,
  ] = await Promise.all([
    payload.count({ collection: 'documents' }),
    payload.count({
      collection: 'documents',
      where: { documentType: { not_equals: 'note' } },
    }),
    payload.count({
      collection: 'transcriptions',
      where: { text: { not_equals: '' } },
    }),
    payload.count({
      collection: 'translations',
      where: { text: { not_equals: '' } },
    }),
    payload.find({
      collection: 'documents',
      sort: '-updatedAt',
      limit: 4,
      depth: 1,
    }),
    payload.find({
      collection: 'translations',
      where: { text: { not_equals: '' } },
      limit: 1000,
      depth: 0,
    }),
    payload.find({
      collection: 'documents',
      where: { pinned: { equals: true } },
      sort: '-updatedAt',
      limit: 4,
      depth: 1,
    }),
  ])

  // Documents that don't yet have a non-empty Translation. Done in JS to
  // sidestep a NOT-IN sub-query; trivial at our scale.
  const translatedDocIds = new Set(
    translatedDocIdsResult.docs
      .map((t) => (typeof t.document === 'number' ? t.document : t.document?.id))
      .filter((v): v is number => typeof v === 'number'),
  )
  const needsTranslationResult = await payload.find({
    collection: 'documents',
    where:
      translatedDocIds.size > 0
        ? {
            and: [
              { id: { not_in: [...translatedDocIds] } },
              { documentType: { not_equals: 'note' } },
            ],
          }
        : { documentType: { not_equals: 'note' } },
    sort: '-updatedAt',
    limit: 4,
    depth: 0,
  })

  const lastEdit = recentEdits.docs[0]
  const lastEditLabel = lastEdit
    ? relativeTime(lastEdit.updatedAt)
    : 'No edits yet'
  const lastEditByLabel = lastEdit
    ? `by ${user.displayName || 'you'}` // we don't track per-row author yet
    : ''

  const firstName =
    user.displayName?.split(/\s+/)[0] || user.email?.split('@')[0] || 'there'

  return (
    <>
      <Chrome user={user} active="home" />

      <main className="px-10 py-10 max-w-6xl mx-auto">
        <div className="mb-10">
          <h1 className="font-serif-content text-3xl mb-1">
            Welcome back, {firstName}
          </h1>
          <p className="text-ink-soft">
            Continue translating your archive.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-12">
          <StatCard label="Total entries" value={String(totalDocs.totalDocs)} />
          <StatCard
            label="Transcribed"
            value={`${transcribedCount.totalDocs}`}
            secondary={`/ ${translatableDocsCount.totalDocs}`}
          />
          <StatCard
            label="Translated"
            value={`${translatedCount.totalDocs}`}
            secondary={`/ ${translatableDocsCount.totalDocs}`}
          />
          <StatCard
            label="Last edit"
            value={lastEditLabel}
            small
            footer={lastEditByLabel}
          />
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif-content text-xl">Recently Edited</h2>
          <Link href="/list" className="text-sm text-seal hover:underline">
            View all →
          </Link>
        </div>
        {recentEdits.docs.length > 0 ? (
          <div className="grid grid-cols-3 gap-5 mb-12">
            {recentEdits.docs.slice(0, 3).map((doc) => (
              <RecentCard key={doc.id} doc={doc} />
            ))}
          </div>
        ) : (
          <div className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-8 text-center text-ink-soft mb-12">
            No documents yet. Start with a{' '}
            <Link href="/add/note" className="text-seal underline">
              new note
            </Link>{' '}
            or{' '}
            <Link href="/add" className="text-seal underline">
              a scan
            </Link>
            .
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          <NeedsTranslationCard
            docs={needsTranslationResult.docs}
            untranslatedCount={
              translatableDocsCount.totalDocs - translatedDocIds.size
            }
          />
          <PinnedCard docs={pinnedResult.docs} />
        </div>
      </main>
    </>
  )
}

function StatCard({
  label,
  value,
  secondary,
  small,
  footer,
}: {
  label: string
  value: string
  secondary?: string
  small?: boolean
  footer?: string
}) {
  return (
    <div
      className="border border-[color:var(--border-soft)] rounded-lg p-5"
      style={{ background: 'var(--border-soft)' }}
    >
      <div className="text-[11px] uppercase tracking-wider text-ink-faint mb-2">
        {label}
      </div>
      <div className={small ? 'font-serif-content text-lg' : 'font-serif-content text-3xl'}>
        {value}
        {secondary ? (
          <span className="text-base text-ink-soft ml-1">{secondary}</span>
        ) : null}
      </div>
      {footer ? <div className="text-xs text-ink-soft mt-1">{footer}</div> : null}
    </div>
  )
}

function RecentCard({ doc }: { doc: Document }) {
  const isNote = doc.documentType === 'note'
  const scans = (Array.isArray(doc.scans) ? doc.scans : []).filter(
    (s): s is Media => typeof s === 'object' && s !== null,
  )
  const firstScan = scans[0]
  const showImage = !isNote && firstScan?.url

  return (
    <Link
      href={`/doc/${doc.id}`}
      className="block rounded-lg overflow-hidden border border-[color:var(--border-soft)] hover:ring-2 hover:ring-gold transition"
      title={doc.title}
    >
      <div className="h-44 relative">
        {showImage ? (
          <img
            src={firstScan.url || ''}
            alt={firstScan.alt || doc.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <NotePreview title={doc.title} body={doc.body} variant="full" />
        )}
      </div>
      <div className="bg-seal p-4">
        <div className="font-serif-content text-base mb-1 line-clamp-1 text-white">
          {doc.title}
        </div>
        <div className="text-xs text-white/85">
          {relativeTime(doc.updatedAt)} ·{' '}
          <span className="font-medium text-white">{doc.documentType}</span>
        </div>
      </div>
    </Link>
  )
}

function NeedsTranslationCard({
  docs,
  untranslatedCount,
}: {
  docs: Document[]
  untranslatedCount: number
}) {
  return (
    <section className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif-content text-base">Needs Translation</h3>
        <span className="text-xs text-ink-soft">
          {untranslatedCount === 1
            ? '1 untranslated'
            : `${untranslatedCount} untranslated`}
        </span>
      </div>
      {docs.length > 0 ? (
        <ul className="text-sm divide-y divide-[color:var(--border-soft)]">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between py-2.5"
            >
              <Link href={`/doc/${doc.id}`} className="hover:text-seal truncate">
                {doc.title}
              </Link>
              <span className="chip shrink-0 ml-2">{doc.documentType}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-ink-soft py-4 text-center">
          Everything's translated.
        </div>
      )}
    </section>
  )
}

function PinnedCard({ docs }: { docs: Document[] }) {
  return (
    <section className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif-content text-base flex items-center gap-2">
          <svg className="w-4 h-4 text-seal" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
          </svg>
          Pinned
        </h3>
        <span className="text-xs text-ink-soft">
          {docs.length === 1 ? '1 pinned' : `${docs.length} pinned`}
        </span>
      </div>
      {docs.length > 0 ? (
        <ul className="text-sm divide-y divide-[color:var(--border-soft)]">
          {docs.map((doc) => (
            <li key={doc.id} className="py-2.5">
              <Link
                href={`/doc/${doc.id}`}
                className="block hover:bg-paper-warm -mx-2 px-2 py-1 rounded"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-medium truncate">{doc.title}</span>
                  <span className="text-xs text-ink-faint shrink-0 ml-2">
                    {doc.documentType}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-ink-soft py-4 text-center">
          Nothing pinned yet.
        </div>
      )}
    </section>
  )
}
