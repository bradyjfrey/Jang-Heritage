import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Chrome } from '@/components/Chrome/Chrome'
import { FilterSidebar } from '@/components/List/FilterSidebar'
import { ListControls } from '@/components/List/ListControls'
import type { Document, Media } from '@/payload-types'

const ALL_TYPES = [
  'letter',
  'diary',
  'photo',
  'article',
  'document',
  'note',
] as const
type DocType = (typeof ALL_TYPES)[number]

type SearchParams = {
  type?: string
  sort?: string
  per?: string
  page?: string
}

function parseTypes(value: string | undefined): ReadonlyArray<DocType> {
  if (!value) return ALL_TYPES
  const parsed = value.split(',').filter((t): t is DocType =>
    (ALL_TYPES as ReadonlyArray<string>).includes(t),
  )
  return parsed.length ? parsed : ALL_TYPES
}

function payloadSort(value: string | undefined): string {
  switch (value) {
    case 'date-asc':
      return 'dateOriginal'
    case 'date-desc':
      return '-dateOriginal'
    case 'title':
      return 'title'
    case 'recent':
    default:
      return '-updatedAt'
  }
}

function parsePerPage(value: string | undefined): number {
  if (value === '24') return 24
  if (value === '96') return 96
  return 48
}

function parsePage(value: string | undefined): number {
  const n = Number.parseInt(value || '1', 10)
  return Number.isNaN(n) || n < 1 ? 1 : n
}

export default async function ListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams

  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  if (!user) redirect('/login?redirect=/list')

  const types = parseTypes(params.type)
  const sort = payloadSort(params.sort)
  const limit = parsePerPage(params.per)
  const page = parsePage(params.page)

  const result = await payload.find({
    collection: 'documents',
    where: { documentType: { in: [...types] } },
    sort,
    limit,
    page,
    depth: 1,
  })

  // Counts per type for the sidebar. Cheap at our scale; revisit if it
  // gets slow once we have thousands of docs.
  const countResults = await Promise.all(
    ALL_TYPES.map((t) =>
      payload
        .count({
          collection: 'documents',
          where: { documentType: { equals: t } },
        })
        .then((r) => [t, r.totalDocs] as const),
    ),
  )
  const typeCounts = Object.fromEntries(countResults) as Record<DocType, number>

  return (
    <>
      <Chrome user={user} below={{ type: 'nav', active: 'documents' }} />

      <div className="flex">
        <FilterSidebar selectedTypes={types} typeCounts={typeCounts} />

        <main className="flex-1 p-8">
          <ListControls
            total={result.totalDocs}
            sort={params.sort || 'recent'}
            per={limit}
          />

          {result.docs.length === 0 ? (
            <div className="text-ink-soft text-sm py-12 text-center">
              No documents match the current filters.
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-2">
              {result.docs.map((doc) => (
                <Card key={doc.id} doc={doc} />
              ))}
            </div>
          )}

          <Pagination
            page={page}
            totalPages={result.totalPages}
            params={params}
          />
        </main>
      </div>
    </>
  )
}

function Card({ doc }: { doc: Document }) {
  const isNote = doc.documentType === 'note'
  const scans = (Array.isArray(doc.scans) ? doc.scans : []).filter(
    (s): s is Media => typeof s === 'object' && s !== null,
  )
  const firstScan = scans[0]
  const showImage = !isNote && firstScan?.url

  return (
    <Link
      href={`/doc/${doc.id}`}
      className="relative block aspect-square rounded overflow-hidden border border-[color:var(--border-soft)] hover:ring-2 hover:ring-gold transition"
      title={doc.title}
    >
      {showImage ? (
        <img
          src={firstScan.url || ''}
          alt={firstScan.alt || doc.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="note-card-bg absolute inset-0"></div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-seal px-3 py-2">
        <div className="text-white text-sm font-serif-content leading-tight line-clamp-1">
          {doc.title}
        </div>
        <div className="text-white/85 text-[11px]">{doc.documentType}</div>
      </div>
    </Link>
  )
}

function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number
  totalPages: number
  params: SearchParams
}) {
  if (totalPages <= 1) return null

  const baseQuery = new URLSearchParams()
  if (params.type) baseQuery.set('type', params.type)
  if (params.sort) baseQuery.set('sort', params.sort)
  if (params.per) baseQuery.set('per', params.per)

  const linkFor = (p: number) => {
    const q = new URLSearchParams(baseQuery)
    if (p > 1) q.set('page', String(p))
    const qs = q.toString()
    return qs ? `/list?${qs}` : '/list'
  }

  const visiblePages = computeVisiblePages(page, totalPages)

  return (
    <div className="flex items-center justify-between mt-10 text-sm text-ink-soft">
      <div>
        Page {page} of {totalPages}
      </div>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link href={linkFor(page - 1)} className="pill-btn">
            ‹
          </Link>
        ) : (
          <span className="pill-btn opacity-40">‹</span>
        )}
        {visiblePages.map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="px-1">
              …
            </span>
          ) : p === page ? (
            <span
              key={p}
              className="pill-btn bg-seal/10 text-seal border-seal/30"
            >
              {p}
            </span>
          ) : (
            <Link key={p} href={linkFor(p)} className="pill-btn">
              {p}
            </Link>
          ),
        )}
        {page < totalPages ? (
          <Link href={linkFor(page + 1)} className="pill-btn">
            ›
          </Link>
        ) : (
          <span className="pill-btn opacity-40">›</span>
        )}
      </div>
    </div>
  )
}

// First page, last page, and a small window around the current page; null
// represents an ellipsis.
function computeVisiblePages(
  current: number,
  total: number,
): Array<number | null> {
  const window = 1
  const set = new Set<number>([1, total, current])
  for (let i = current - window; i <= current + window; i++) {
    if (i >= 1 && i <= total) set.add(i)
  }
  const sorted = [...set].sort((a, b) => a - b)
  const out: Array<number | null> = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push(null)
    out.push(sorted[i])
  }
  return out
}
