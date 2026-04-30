import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Chrome } from '@/components/Chrome/Chrome'
import type { Tag } from '@/payload-types'

export default async function TagsPage() {
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  if (!user) redirect('/login?redirect=/tags')

  const tagsResult = await payload.find({
    collection: 'tags',
    limit: 500,
    sort: 'name',
    depth: 0,
  })
  const tags = tagsResult.docs

  // Single pass over all docs (depth 0 keeps tags as ID arrays). For a
  // personal archive the doc count is small enough that one query + an
  // in-memory tally beats N count() queries.
  const docsResult = await payload.find({
    collection: 'documents',
    limit: 10000,
    depth: 0,
    pagination: false,
  })
  const counts = new Map<number, number>()
  for (const doc of docsResult.docs) {
    if (!Array.isArray(doc.tags)) continue
    for (const t of doc.tags) {
      const id = typeof t === 'object' && t ? t.id : (t as number)
      if (typeof id === 'number') {
        counts.set(id, (counts.get(id) || 0) + 1)
      }
    }
  }

  return (
    <>
      <Chrome user={user} />

      <main className="max-w-5xl mx-auto px-4 py-8 md:px-8 md:py-10">
        <div className="mb-6">
          <h1 className="font-serif-content text-2xl mb-1">Tags</h1>
          <p className="text-sm text-ink-soft">
            {tags.length === 0
              ? 'No tags yet. Add one to a document to get started.'
              : `${tags.length} tag${tags.length === 1 ? '' : 's'} across the archive. Click to see documents.`}
          </p>
        </div>

        {tags.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tags.map((tag) => (
              <TagCard
                key={tag.id}
                tag={tag}
                count={counts.get(tag.id) || 0}
              />
            ))}
          </div>
        ) : null}
      </main>
    </>
  )
}

function TagCard({ tag, count }: { tag: Tag; count: number }) {
  const slug = tag.slug || String(tag.id)
  const color = tag.color || ''
  const chipStyle: React.CSSProperties = color
    ? {
        background: `${color}1f`, // ~12% alpha as 2-digit hex
        color,
        borderColor: `${color}40`, // ~25% alpha
      }
    : {}

  return (
    <Link
      href={`/list?tag=${encodeURIComponent(slug)}`}
      className="block bg-surface border border-[color:var(--border-soft)] rounded-lg p-4 hover:border-gold transition"
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <span
          className="chip"
          style={chipStyle}
        >
          {tag.name}
        </span>
        <span className="text-xs text-ink-faint shrink-0">
          {count} doc{count === 1 ? '' : 's'}
        </span>
      </div>
      {tag.description ? (
        <p className="text-sm text-ink-soft line-clamp-2">{tag.description}</p>
      ) : null}
    </Link>
  )
}
