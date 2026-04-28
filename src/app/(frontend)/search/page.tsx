import { sql } from 'drizzle-orm'
import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Chrome } from '@/components/Chrome/Chrome'
import { segmentChinese } from '@/hooks/segmentChinese'
import type { Document, Media } from '@/payload-types'

type SearchParams = { q?: string }

type MatchedIn = 'transcription' | 'translation' | 'note-body'

type Match = {
  documentId: number
  matchedIn: MatchedIn
  rank: number
}

// Strip tsquery special characters so user input can't break the parser.
function escapeTerm(term: string): string {
  return term.replace(/[!&|():'"\\<>*]/g, '').trim()
}

// Build two tsquery strings from a user input:
//   simple  - segmented (CJK-aware) with simple config; matches transcriptions and note bodies
//   english - whitespace-split English; matches translations
function buildQueries(q: string) {
  const segmented = segmentChinese(q)
  const simpleTerms = segmented
    .split(/\s+/)
    .map(escapeTerm)
    .filter(Boolean)
  const englishTerms = q
    .split(/\s+/)
    .map((t) => escapeTerm(t.replace(/[^A-Za-z0-9]/g, '')))
    .filter(Boolean)
  return {
    simple: simpleTerms.join(' & '),
    english: englishTerms.join(' & '),
  }
}

const RESULT_LIMIT = 50

function matchedInLabel(m: MatchedIn): string {
  switch (m) {
    case 'transcription':
      return '中文录入'
    case 'translation':
      return 'English translation'
    case 'note-body':
      return 'Note body'
  }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const rawQuery = (params.q || '').trim()

  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  if (!user) {
    const next = encodeURIComponent(`/search${rawQuery ? `?q=${encodeURIComponent(rawQuery)}` : ''}`)
    redirect(`/login?redirect=${next}`)
  }

  const queries = rawQuery ? buildQueries(rawQuery) : { simple: '', english: '' }
  const drizzle = (payload.db as { drizzle: { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> } })
    .drizzle

  const allMatches: Match[] = []

  if (queries.simple) {
    const tQuery = queries.simple
    const transcriptions = await drizzle.execute(sql`
      SELECT document_id::int AS document_id,
             ts_rank_cd(search_vector, to_tsquery('simple', ${tQuery}))::float AS rank
      FROM transcriptions
      WHERE search_vector @@ to_tsquery('simple', ${tQuery})
      LIMIT ${RESULT_LIMIT}
    `)
    for (const row of transcriptions.rows) {
      const documentId = Number(row.document_id)
      const rank = Number(row.rank)
      if (!Number.isNaN(documentId)) {
        allMatches.push({ documentId, matchedIn: 'transcription', rank })
      }
    }

    const notes = await drizzle.execute(sql`
      SELECT id::int AS id,
             ts_rank_cd(body_search_vector, to_tsquery('simple', ${tQuery}))::float AS rank
      FROM documents
      WHERE body_search_vector @@ to_tsquery('simple', ${tQuery})
        AND document_type = 'note'
      LIMIT ${RESULT_LIMIT}
    `)
    for (const row of notes.rows) {
      const documentId = Number(row.id)
      const rank = Number(row.rank)
      if (!Number.isNaN(documentId)) {
        allMatches.push({ documentId, matchedIn: 'note-body', rank })
      }
    }
  }

  if (queries.english) {
    const tQuery = queries.english
    const translations = await drizzle.execute(sql`
      SELECT document_id::int AS document_id,
             ts_rank_cd(search_vector, to_tsquery('english', ${tQuery}))::float AS rank
      FROM translations
      WHERE search_vector @@ to_tsquery('english', ${tQuery})
      LIMIT ${RESULT_LIMIT}
    `)
    for (const row of translations.rows) {
      const documentId = Number(row.document_id)
      const rank = Number(row.rank)
      if (!Number.isNaN(documentId)) {
        allMatches.push({ documentId, matchedIn: 'translation', rank })
      }
    }
  }

  // Dedupe by document, keep best rank, prefer Chinese / note over translation
  // when ranks tie (arbitrary stable choice).
  const dedup = new Map<number, Match>()
  for (const m of allMatches) {
    const existing = dedup.get(m.documentId)
    if (!existing || m.rank > existing.rank) dedup.set(m.documentId, m)
  }
  const ordered = [...dedup.values()].sort((a, b) => b.rank - a.rank)

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

  return (
    <>
      <Chrome user={user} below={{ type: 'nav' }} />

      <main className="max-w-5xl mx-auto px-8 py-10">
        {!rawQuery ? (
          <div className="text-ink-soft text-center py-16">
            <p className="font-serif-content text-2xl mb-2">Search</p>
            <p>Type a query in the bar above to search across Chinese, English, and note bodies.</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="font-serif-content text-2xl mb-1">
                {ordered.length === 1
                  ? '1 result for '
                  : `${ordered.length} results for `}
                <span className="font-cjk text-seal">{rawQuery}</span>
              </h1>
              <p className="text-sm text-ink-soft">
                Matched across Chinese transcriptions, English translations, and
                note bodies. Ranked by relevance.
              </p>
            </div>

            {ordered.length === 0 ? (
              <div className="text-ink-soft text-sm py-12 text-center">
                No matches. Try fewer or different terms.
              </div>
            ) : (
              <div className="space-y-3">
                {docs.map((doc, i) => {
                  const match = ordered[i]
                  return (
                    <ResultRow key={doc.id} doc={doc} match={match} />
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}

function ResultRow({ doc, match }: { doc: Document; match: Match }) {
  const isNote = doc.documentType === 'note'
  const scans = (Array.isArray(doc.scans) ? doc.scans : []).filter(
    (s): s is Media => typeof s === 'object' && s !== null,
  )
  const firstScan = scans[0]
  const showImage = !isNote && firstScan?.url

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
          <div className="note-card-bg thumb"></div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-serif-content text-lg truncate">{doc.title}</h3>
          <span className="chip shrink-0">{doc.documentType}</span>
        </div>
        <div className="text-xs text-ink-soft">
          Matched in <span className="font-medium text-ink">{matchedInLabel(match.matchedIn)}</span>
          <span className="ml-2 text-ink-faint">
            (relevance {match.rank.toFixed(3)})
          </span>
        </div>
      </div>
    </Link>
  )
}
