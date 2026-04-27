import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Chrome } from '@/components/Chrome/Chrome'
import { CopyButton } from '@/components/CopyButton/CopyButton'
import type { Media, Tag } from '@/payload-types'

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
            <h1 className="font-serif-content text-3xl mb-2">{doc.title}</h1>
            {dateLabel ? (
              <div className="text-sm text-ink-soft">{dateLabel}</div>
            ) : null}
          </div>

          {scans.length > 0 ? (
            <section className="mb-10">
              <div className="rounded-lg border border-[color:var(--border-soft)] mb-3 bg-paper-warm flex justify-center p-4">
                <img
                  src={scans[0].url || ''}
                  alt={scans[0].alt || `${doc.title}, scan 1`}
                  className="max-w-full max-h-[40rem] object-contain rounded shadow-sm"
                />
              </div>
              {scans.length > 1 ? (
                <div className="flex gap-2 items-center">
                  {scans.map((scan, i) => (
                    <a
                      key={scan.id}
                      href={scan.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-20 h-24 rounded border border-[color:var(--border-soft)] overflow-hidden hover:border-seal"
                      title={scan.alt || `Scan ${i + 1}`}
                    >
                      <img
                        src={scan.url || ''}
                        alt={scan.alt || `Scan ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {transcription?.text ? (
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-serif-content text-xl font-cjk">中文录入</h2>
                <CopyButton
                  text={transcription.text || ''}
                  label="Copy Chinese transcription"
                />
              </div>
              <div className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-6 font-cjk text-base leading-loose whitespace-pre-line">
                {transcription.text}
              </div>
            </section>
          ) : null}

          {translation?.text ? (
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-serif-content text-xl">English Translation</h2>
                <CopyButton
                  text={translation.text || ''}
                  label="Copy English translation"
                />
              </div>
              <div className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-6 font-serif-content text-base leading-relaxed whitespace-pre-line">
                {translation.text}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <Link
            href={`/doc/${doc.id}/edit`}
            className="block w-full text-center bg-seal text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-black transition-colors"
          >
            Edit transcription &amp; translation
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
              {scans.length > 0 ? (
                <div className="flex justify-between gap-4 pt-1 text-ink-soft">
                  <span>Scans</span>
                  <span>
                    {scans.length} page{scans.length === 1 ? '' : 's'}
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          {tags.length > 0 ? (
            <section className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-5">
              <div className="text-[11px] uppercase tracking-wider text-ink-faint mb-3">
                Tags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span key={tag.id} className="chip">
                    {tag.name}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </main>
    </>
  )
}
