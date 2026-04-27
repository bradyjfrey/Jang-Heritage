import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Chrome } from '@/components/Chrome/Chrome'
import { FilterSidebar } from '@/components/List/FilterSidebar'
import { ListControls } from '@/components/List/ListControls'
import type { Document, Media, Tag } from '@/payload-types'

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
  view?: string
}

type ViewMode = 'grid' | 'table'

function parseView(value: string | undefined): ViewMode {
  return value === 'table' ? 'table' : 'grid'
}

function relativeTime(iso: string | undefined): string {
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
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDocDate(
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
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
      })
    case 'year':
      return String(d.getFullYear())
    case 'decade':
      return `${Math.floor(d.getFullYear() / 10) * 10}s`
    default:
      return d.toLocaleDateString()
  }
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
  const view = parseView(params.view)

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
            view={view}
          />

          {result.docs.length === 0 ? (
            <div className="text-ink-soft text-sm py-12 text-center">
              No documents match the current filters.
            </div>
          ) : view === 'table' ? (
            <TableView docs={result.docs} />
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

function TableView({ docs }: { docs: Document[] }) {
  return (
    <div className="bg-surface border border-[color:var(--border-soft)] rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-paper-warm border-b border-[color:var(--border-soft)] text-ink-soft">
          <tr className="text-left">
            <th className="px-3 py-2.5 w-14"></th>
            <th className="px-3 py-2.5 font-medium">Title</th>
            <th className="px-3 py-2.5 font-medium w-24">Type</th>
            <th className="px-3 py-2.5 font-medium w-32">Date</th>
            <th className="px-3 py-2.5 font-medium w-64">Tags</th>
            <th className="px-3 py-2.5 font-medium w-28">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--border-soft)]">
          {docs.map((doc) => (
            <TableRow key={doc.id} doc={doc} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TableRow({ doc }: { doc: Document }) {
  const isNote = doc.documentType === 'note'
  const scans = (Array.isArray(doc.scans) ? doc.scans : []).filter(
    (s): s is Media => typeof s === 'object' && s !== null,
  )
  const firstScan = scans[0]
  const tags = (Array.isArray(doc.tags) ? doc.tags : []).filter(
    (t): t is Tag => typeof t === 'object' && t !== null,
  )
  const docDate = formatDocDate(doc.dateOriginal, doc.dateOriginalPrecision)
  const updated = relativeTime(doc.updatedAt)

  return (
    <tr className="hover:bg-paper-warm">
      <td className="px-3 py-2">
        <Link
          href={`/doc/${doc.id}`}
          className="block w-10 h-12 rounded overflow-hidden border border-[color:var(--border-soft)] relative"
          aria-label={`Open ${doc.title}`}
        >
          {!isNote && firstScan?.url ? (
            <img
              src={firstScan.url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="note-card-bg thumb"></div>
          )}
        </Link>
      </td>
      <td className="px-3 py-2 font-serif-content text-base">
        <Link href={`/doc/${doc.id}`} className="hover:text-seal">
          {doc.title}
        </Link>
      </td>
      <td className="px-3 py-2 text-ink-soft">{doc.documentType}</td>
      <td className="px-3 py-2 text-ink-soft">{docDate}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1 items-center">
          {tags.slice(0, 3).map((tag) => (
            <span key={tag.id} className="chip">
              {tag.name}
            </span>
          ))}
          {tags.length > 3 ? (
            <span className="text-xs text-ink-faint">+{tags.length - 3} more</span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-2 text-ink-soft">{updated}</td>
    </tr>
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
        <div className="note-card-bg"></div>
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
  if (params.view) baseQuery.set('view', params.view)

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
