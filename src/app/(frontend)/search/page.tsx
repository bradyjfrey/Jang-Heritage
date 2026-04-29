import { sql } from 'drizzle-orm'
import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Chrome } from '@/components/Chrome/Chrome'
import { NotePreview } from '@/components/NotePreview/NotePreview'
import { RefineSidebar } from '@/components/Search/RefineSidebar'
import { SortDropdown } from '@/components/Search/SortDropdown'
import { segmentChinese } from '@/hooks/segmentChinese'
import type { Document, Media, Tag, User } from '@/payload-types'

type SearchParams = {
  q?: string
  sort?: string
  page?: string
  matchIn?: string
  type?: string
  from?: string
  to?: string
  tag?: string
  translator?: string
}
type SortMode = 'relevance' | 'newest' | 'oldest'
type MatchedIn = 'transcription' | 'translation' | 'note-body' | 'title'

// Parse a comma-separated URL param into a Set of selected values, or null
// when the param is absent (which means "all options selected" by convention).
function parseFilterList(raw: string | undefined): Set<string> | null {
  if (!raw) return null
  const items = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (items.length === 0) return null
  return new Set(items)
}

type Match = {
  documentId: number
  matchedIn: MatchedIn
  rank: number
  text: string // raw text of the matched field for snippet rendering
}

// Strip tsquery special characters so user input can't break the parser.
function escapeTerm(term: string): string {
  return term.replace(/[!&|():'"\\<>*]/g, '').trim()
}

// Build two tsquery strings AND a list of raw terms (for snippet matching).
//
// We OR (`|`) the tokens within each query because Traditional Chinese
// segments to single characters that wouldn't match if AND-joined. OR
// returns more results; relevance ranking surfaces the best ones.
//
// Each token gets `:*` appended for prefix matching, so "obit" finds
// "obituary", "fath" finds "father", etc. Without this, FTS only matches
// exact lexemes (after stemming) and partial-word queries return nothing.
function buildQueries(q: string) {
  const segmented = segmentChinese(q)
  const simpleTokens = segmented
    .split(/\s+/)
    .map(escapeTerm)
    .filter(Boolean)
    .map((t) => `${t}:*`)
  const englishTokens = q
    .split(/\s+/)
    .map((t) => escapeTerm(t.replace(/[^A-Za-z0-9]/g, '')))
    .filter(Boolean)
    .map((t) => `${t}:*`)

  // Raw terms to search for in the snippet pass. We include both the full
  // CJK runs/English words AND individual CJK chars so partial matches
  // still highlight: Postgres FTS uses OR-joined tokens (so a note matched
  // on a single char gets returned), and the snippet builder needs to be
  // at least as permissive. Sorted longest-first so multi-char matches win.
  const cjkRunsAndWords: string[] = []
  for (const t of q.split(/\s+/)) {
    for (const m of t.matchAll(/[㐀-鿿]+|[A-Za-z0-9]+/g)) {
      cjkRunsAndWords.push(m[0])
    }
  }
  const cjkChars: string[] = []
  for (const term of cjkRunsAndWords) {
    if (/^[㐀-鿿]+$/.test(term) && term.length > 1) {
      for (const ch of Array.from(term)) cjkChars.push(ch)
    }
  }
  const rawTerms = Array.from(
    new Set([...cjkRunsAndWords, ...cjkChars].filter(Boolean)),
  ).sort((a, b) => b.length - a.length)

  return {
    simple: simpleTokens.join(' | '),
    english: englishTokens.join(' | '),
    rawTerms,
  }
}

const RESULT_LIMIT = 200
const PAGE_SIZE = 20
const SNIPPET_WINDOW = 60

function matchedInLabel(m: MatchedIn): string {
  switch (m) {
    case 'transcription':
      return '中文录入'
    case 'translation':
      return 'English translation'
    case 'note-body':
      return 'Note body'
    case 'title':
      return 'Title'
  }
}

function matchedInChip(m: MatchedIn): { label: string; className: string } {
  switch (m) {
    case 'transcription':
      return {
        label: '中文 match',
        className: 'font-cjk text-xs text-seal bg-seal/10 px-2 py-0.5 rounded',
      }
    case 'translation':
      return {
        label: 'EN match',
        className: 'text-xs text-seal bg-seal/10 px-2 py-0.5 rounded',
      }
    case 'note-body':
      return {
        label: 'Note match',
        className: 'text-xs text-gold bg-gold/10 px-2 py-0.5 rounded',
      }
    case 'title':
      return {
        label: 'Title match',
        className: 'text-xs text-gold bg-gold/10 px-2 py-0.5 rounded',
      }
  }
}

function formatDocDate(
  iso: string | null | undefined,
  precision: string | null | undefined,
): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
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
      return ''
    default:
      return d.toLocaleDateString()
  }
}

// Parse a year string like "1924" into a number, or null if blank/invalid.
function parseYear(raw: string | undefined): number | null {
  if (!raw) return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1 || n > 9999) return null
  return n
}

// Push docs missing a date to the end regardless of sort direction.
function compareByDate(a: Document, b: Document, dir: 'asc' | 'desc'): number {
  const aTime = a.dateOriginal ? new Date(a.dateOriginal).getTime() : NaN
  const bTime = b.dateOriginal ? new Date(b.dateOriginal).getTime() : NaN
  const aMissing = Number.isNaN(aTime)
  const bMissing = Number.isNaN(bTime)
  if (aMissing && bMissing) return 0
  if (aMissing) return 1
  if (bMissing) return -1
  return dir === 'desc' ? bTime - aTime : aTime - bTime
}

// Find the longest rawTerm that appears in text (case-insensitive) and
// return a window around it with the matched span isolated for highlighting.
// rawTerms is pre-sorted longest-first, so the first hit wins. We preserve
// the original casing of the matched span from `text` rather than echoing
// the user's typed term.
function buildSnippet(
  text: string,
  rawTerms: string[],
): { before: string; match: string; after: string } | null {
  if (!text) return null
  const lower = text.toLowerCase()
  let bestIndex = -1
  let bestLen = 0
  for (const term of rawTerms) {
    if (!term) continue
    const idx = lower.indexOf(term.toLowerCase())
    if (idx >= 0) {
      bestIndex = idx
      bestLen = term.length
      break
    }
  }
  if (bestIndex < 0) return null
  const start = Math.max(0, bestIndex - SNIPPET_WINDOW)
  const end = Math.min(text.length, bestIndex + bestLen + SNIPPET_WINDOW)
  return {
    before: (start > 0 ? '… ' : '') + text.slice(start, bestIndex),
    match: text.slice(bestIndex, bestIndex + bestLen),
    after:
      text.slice(bestIndex + bestLen, end) +
      (end < text.length ? ' …' : ''),
  }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const rawQuery = (params.q || '').trim()
  const sortParam = params.sort
  const sortMode: SortMode =
    sortParam === 'newest' || sortParam === 'oldest' ? sortParam : 'relevance'
  const pageParam = Number.parseInt(params.page || '1', 10)
  const currentPage =
    Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : 1

  const matchInFilter = parseFilterList(params.matchIn)
  const typeFilter = parseFilterList(params.type)
  const tagFilter = parseFilterList(params.tag)
  const fromYear = parseYear(params.from)
  const toYear = parseYear(params.to)
  const translatorFilter = (params.translator || '').trim()

  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  if (!user) {
    const next = encodeURIComponent(
      `/search${rawQuery ? `?q=${encodeURIComponent(rawQuery)}` : ''}`,
    )
    redirect(`/login?redirect=${next}`)
  }

  const queries = rawQuery
    ? buildQueries(rawQuery)
    : { simple: '', english: '', rawTerms: [] as string[] }

  const drizzle = (
    payload.db as {
      drizzle: {
        execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }>
      }
    }
  ).drizzle

  const allMatches: Match[] = []

  if (queries.simple) {
    const tQuery = queries.simple
    const transcriptions = await drizzle.execute(sql`
      SELECT document_id::int AS document_id,
             text,
             ts_rank_cd(search_vector, to_tsquery('simple', ${tQuery}))::float AS rank
      FROM transcriptions
      WHERE search_vector @@ to_tsquery('simple', ${tQuery})
      LIMIT ${RESULT_LIMIT}
    `)
    for (const row of transcriptions.rows) {
      const documentId = Number(row.document_id)
      const rank = Number(row.rank)
      const text = String(row.text || '')
      if (!Number.isNaN(documentId)) {
        allMatches.push({ documentId, matchedIn: 'transcription', rank, text })
      }
    }

    const notes = await drizzle.execute(sql`
      SELECT id::int AS id,
             body,
             ts_rank_cd(body_search_vector, to_tsquery('simple', ${tQuery}))::float AS rank
      FROM documents
      WHERE body_search_vector @@ to_tsquery('simple', ${tQuery})
        AND document_type = 'note'
      LIMIT ${RESULT_LIMIT}
    `)
    for (const row of notes.rows) {
      const documentId = Number(row.id)
      const rank = Number(row.rank)
      const text = String(row.body || '')
      if (!Number.isNaN(documentId)) {
        allMatches.push({ documentId, matchedIn: 'note-body', rank, text })
      }
    }
  }

  if (queries.english) {
    const tQuery = queries.english
    const translations = await drizzle.execute(sql`
      SELECT document_id::int AS document_id,
             text,
             ts_rank_cd(search_vector, to_tsquery('english', ${tQuery}))::float AS rank
      FROM translations
      WHERE search_vector @@ to_tsquery('english', ${tQuery})
      LIMIT ${RESULT_LIMIT}
    `)
    for (const row of translations.rows) {
      const documentId = Number(row.document_id)
      const rank = Number(row.rank)
      const text = String(row.text || '')
      if (!Number.isNaN(documentId)) {
        allMatches.push({ documentId, matchedIn: 'translation', rank, text })
      }
    }
  }

  // Title search via case-insensitive substring (ILIKE under the hood).
  // Titles aren't indexed in a tsvector and they're short, so a substring
  // match is fine and gets us partial-word hits like "obit" → "Obituary".
  // Lower fixed rank so body matches still outrank title matches when both
  // exist for the same doc.
  if (queries.rawTerms.length > 0) {
    const titleResults = await payload.find({
      collection: 'documents',
      where: {
        or: queries.rawTerms.map((t) => ({ title: { contains: t } })),
      },
      limit: RESULT_LIMIT,
      depth: 0,
    })
    for (const d of titleResults.docs) {
      allMatches.push({
        documentId: d.id,
        matchedIn: 'title',
        rank: 0.05,
        text: d.title,
      })
    }
  }

  // English ILIKE fallback for translations. Postgres FTS with the english
  // config strips stopwords ("you", "from", "the", ...), so plain searches
  // for those words return no results from FTS alone. ILIKE doesn't care
  // about stopwords or stemming and catches them. Slightly higher rank than
  // a title hit, slightly lower than a real FTS hit.
  const englishTerms = queries.rawTerms.filter((t) => /^[A-Za-z0-9]+$/.test(t))
  if (englishTerms.length > 0) {
    const conditions = englishTerms
      .map((t) => sql`text ILIKE ${'%' + t + '%'}`)
      .reduce((acc, c, i) => (i === 0 ? c : sql`${acc} OR ${c}`))
    const translationsLike = await drizzle.execute(sql`
      SELECT document_id::int AS document_id, text
      FROM translations
      WHERE ${conditions}
      LIMIT ${RESULT_LIMIT}
    `)
    for (const row of translationsLike.rows) {
      const documentId = Number(row.document_id)
      const text = String(row.text || '')
      if (!Number.isNaN(documentId)) {
        allMatches.push({
          documentId,
          matchedIn: 'translation',
          rank: 0.08,
          text,
        })
      }
    }
  }

  // Dedupe: keep best-ranked match per document.
  const dedup = new Map<number, Match>()
  for (const m of allMatches) {
    const existing = dedup.get(m.documentId)
    if (!existing || m.rank > existing.rank) dedup.set(m.documentId, m)
  }
  let ordered = [...dedup.values()].sort((a, b) => b.rank - a.rank)

  // Match-in filter is the cheapest: drop entries before we even fetch docs.
  if (matchInFilter) {
    ordered = ordered.filter((m) => matchInFilter.has(m.matchedIn))
  }

  let docs: Document[] = []
  if (ordered.length > 0) {
    const found = await payload.find({
      collection: 'documents',
      where: { id: { in: ordered.map((m) => m.documentId) } },
      limit: ordered.length,
      depth: 1,
    })
    const byId = new Map(found.docs.map((d) => [d.id, d]))
    docs = ordered
      .map((m) => byId.get(m.documentId))
      .filter((d): d is Document => d != null)
  }

  // Compute the set of document types present in the unfiltered FTS result
  // set. We pass this to the sidebar so it only renders Type checkboxes for
  // types actually represented in this query — no point offering "Photo" as
  // a filter when zero photos matched.
  const availableTypes = new Set(docs.map((d) => d.documentType).filter(Boolean))

  // Type / date / tag / translator filters apply to the post-FTS result set.
  // All defaults to all-selected (param absent), so a missing filter passes
  // every doc through.
  if (typeFilter) {
    docs = docs.filter((d) => typeFilter.has(d.documentType))
  }
  if (fromYear !== null || toYear !== null) {
    docs = docs.filter((d) => {
      if (!d.dateOriginal) return false
      const year = new Date(d.dateOriginal).getFullYear()
      if (!Number.isFinite(year)) return false
      if (fromYear !== null && year < fromYear) return false
      if (toYear !== null && year > toYear) return false
      return true
    })
  }
  if (tagFilter) {
    docs = docs.filter((d) => {
      const tags = (Array.isArray(d.tags) ? d.tags : []).filter(
        (t): t is Tag => typeof t === 'object' && t !== null,
      )
      return tags.some((t) => t.slug && tagFilter.has(t.slug))
    })
  }
  if (translatorFilter && docs.length > 0) {
    const translationsForDocs = await payload.find({
      collection: 'translations',
      where: { document: { in: docs.map((d) => d.id) } },
      limit: docs.length,
      depth: 0,
    })
    const translatorByDoc = new Map<number, number | null>()
    for (const t of translationsForDocs.docs) {
      const docId =
        typeof t.document === 'number' ? t.document : t.document?.id ?? null
      if (typeof docId === 'number') {
        const trId =
          typeof t.translator === 'number'
            ? t.translator
            : t.translator?.id ?? null
        translatorByDoc.set(docId, trId)
      }
    }
    if (translatorFilter === 'untranslated') {
      // Notes don't carry translations and shouldn't pollute "Untranslated".
      docs = docs.filter(
        (d) => !translatorByDoc.has(d.id) && d.documentType !== 'note',
      )
    } else {
      const wantedId = Number.parseInt(translatorFilter, 10)
      if (Number.isFinite(wantedId)) {
        docs = docs.filter((d) => translatorByDoc.get(d.id) === wantedId)
      }
    }
  }

  if (sortMode === 'newest') {
    docs = [...docs].sort((a, b) => compareByDate(a, b, 'desc'))
  } else if (sortMode === 'oldest') {
    docs = [...docs].sort((a, b) => compareByDate(a, b, 'asc'))
  }

  const totalResults = docs.length
  const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const sliceStart = (safePage - 1) * PAGE_SIZE
  const sliceEnd = sliceStart + PAGE_SIZE
  const visibleDocs = docs.slice(sliceStart, sliceEnd)
  const matchByDoc = new Map(ordered.map((m) => [m.documentId, m]))

  // Sidebar options: every existing tag + every user marked as a translator.
  // Loaded once per render; small enough at our scale that pagination is
  // overkill.
  const [allTagsResult, translatorsResult] = await Promise.all([
    payload.find({
      collection: 'tags',
      limit: 200,
      sort: 'name',
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
  const tagOptions = allTagsResult.docs
    .filter((t): t is Tag & { slug: string } => typeof t.slug === 'string')
    .map((t) => ({ value: t.slug, label: t.name }))
  const translatorOptions = translatorsResult.docs.map((u: User) => ({
    value: String(u.id),
    label: u.displayName || u.email || `User ${u.id}`,
  }))

  // Preserve q + sort + every filter across page links; only the page number changes.
  const buildPageHref = (p: number) => {
    const sp = new URLSearchParams()
    if (rawQuery) sp.set('q', rawQuery)
    if (sortMode !== 'relevance') sp.set('sort', sortMode)
    if (params.matchIn) sp.set('matchIn', params.matchIn)
    if (params.type) sp.set('type', params.type)
    if (params.from) sp.set('from', params.from)
    if (params.to) sp.set('to', params.to)
    if (params.tag) sp.set('tag', params.tag)
    if (params.translator) sp.set('translator', params.translator)
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return qs ? `/search?${qs}` : '/search'
  }

  return (
    <>
      <Chrome user={user} />

      {!rawQuery ? (
        <main className="max-w-5xl mx-auto px-8 py-10">
          <div className="text-ink-soft text-center py-16">
            <p className="font-serif-content text-2xl mb-2">Search</p>
            <p>
              Type a query in the bar above to search across Chinese, English,
              and note bodies.
            </p>
          </div>
        </main>
      ) : (
        <div className="flex">
          <RefineSidebar
            tags={tagOptions}
            translators={translatorOptions}
            availableTypes={[...availableTypes]}
          />
          <main className="flex-1 px-8 py-10 max-w-5xl">
            <div className="flex items-end justify-between mb-6 gap-4">
              <div>
                <h1 className="font-serif-content text-2xl mb-1">
                  {totalResults === 1
                    ? '1 result for '
                    : `${totalResults} results for `}
                  <span className="font-cjk text-seal">{rawQuery}</span>
                </h1>
                <p className="text-sm text-ink-soft">
                  Searched both Chinese (segmented) and English; ranked by
                  relevance.
                </p>
              </div>
              {totalResults > 0 ? <SortDropdown /> : null}
            </div>

            {totalResults === 0 ? (
              <div className="text-ink-soft text-sm py-12 text-center">
                No matches. Try different terms.
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {visibleDocs.map((doc) => {
                    const m = matchByDoc.get(doc.id)
                    if (!m) return null
                    return (
                      <ResultRow
                        key={doc.id}
                        doc={doc}
                        match={m}
                        rawTerms={queries.rawTerms}
                      />
                    )
                  })}
                </div>
                {totalPages > 1 ? (
                  <Pagination
                    currentPage={safePage}
                    totalPages={totalPages}
                    totalResults={totalResults}
                    sliceStart={sliceStart}
                    sliceEnd={Math.min(sliceEnd, totalResults)}
                    buildHref={buildPageHref}
                  />
                ) : null}
              </>
            )}
          </main>
        </div>
      )}
    </>
  )
}

function ResultRow({
  doc,
  match,
  rawTerms,
}: {
  doc: Document
  match: Match
  rawTerms: string[]
}) {
  const isNote = doc.documentType === 'note'
  const scans = (Array.isArray(doc.scans) ? doc.scans : []).filter(
    (s): s is Media => typeof s === 'object' && s !== null,
  )
  const firstScan = scans[0]
  const showImage = !isNote && firstScan?.url
  const isTitleMatch = match.matchedIn === 'title'
  const snippet = isTitleMatch ? null : buildSnippet(match.text, rawTerms)
  const titleSnippet = isTitleMatch ? buildSnippet(doc.title, rawTerms) : null
  const isCJKField =
    match.matchedIn === 'transcription' || match.matchedIn === 'note-body'
  const chip = matchedInChip(match.matchedIn)
  const dateLabel = formatDocDate(doc.dateOriginal, doc.dateOriginalPrecision)

  return (
    <Link
      href={`/doc/${doc.id}`}
      className="flex gap-4 bg-surface border border-[color:var(--border-soft)] rounded-lg p-4 hover:border-gold transition"
    >
      <div className="w-16 h-20 rounded overflow-hidden border border-[color:var(--border-soft)] relative shrink-0">
        {showImage ? (
          <img
            src={firstScan.url || ''}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <NotePreview title={doc.title} body={doc.body} variant="thumb" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={chip.className}>{chip.label}</span>
          <span className="chip">{doc.documentType}</span>
          {dateLabel ? (
            <span className="text-xs text-ink-soft">· {dateLabel}</span>
          ) : null}
        </div>
        <h3 className="font-serif-content text-lg mb-1 truncate">
          {titleSnippet ? (
            <>
              {titleSnippet.before}
              <mark className="snippet">{titleSnippet.match}</mark>
              {titleSnippet.after}
            </>
          ) : (
            doc.title
          )}
        </h3>
        {snippet ? (
          <p
            className={
              isCJKField
                ? 'text-sm text-ink-soft leading-relaxed font-cjk line-clamp-2'
                : 'text-sm text-ink-soft leading-relaxed font-serif-content line-clamp-2'
            }
          >
            {snippet.before}
            <mark className="snippet">{snippet.match}</mark>
            {snippet.after}
          </p>
        ) : !isTitleMatch ? (
          <p className="text-xs text-ink-faint">
            Matched in {matchedInLabel(match.matchedIn)}
          </p>
        ) : null}
      </div>
    </Link>
  )
}

function Pagination({
  currentPage,
  totalPages,
  totalResults,
  sliceStart,
  sliceEnd,
  buildHref,
}: {
  currentPage: number
  totalPages: number
  totalResults: number
  sliceStart: number
  sliceEnd: number
  buildHref: (page: number) => string
}) {
  // Build a compact page list: first, last, current ±1, and ellipses.
  const pages: (number | 'ellipsis')[] = []
  for (let p = 1; p <= totalPages; p++) {
    if (
      p === 1 ||
      p === totalPages ||
      (p >= currentPage - 1 && p <= currentPage + 1)
    ) {
      pages.push(p)
    } else if (pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis')
    }
  }

  return (
    <div className="flex items-center justify-between mt-10 text-sm text-ink-soft">
      <div>
        Showing {sliceStart + 1}-{sliceEnd} of {totalResults}
      </div>
      <div className="flex items-center gap-1">
        {currentPage > 1 ? (
          <Link href={buildHref(currentPage - 1)} className="pill-btn">
            ‹
          </Link>
        ) : (
          <span className="pill-btn opacity-40 cursor-not-allowed">‹</span>
        )}
        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e${i}`} className="px-1">
              …
            </span>
          ) : p === currentPage ? (
            <span
              key={p}
              className="pill-btn bg-seal/10 text-seal border-seal/30"
            >
              {p}
            </span>
          ) : (
            <Link key={p} href={buildHref(p)} className="pill-btn">
              {p}
            </Link>
          ),
        )}
        {currentPage < totalPages ? (
          <Link href={buildHref(currentPage + 1)} className="pill-btn">
            ›
          </Link>
        ) : (
          <span className="pill-btn opacity-40 cursor-not-allowed">›</span>
        )}
      </div>
    </div>
  )
}
