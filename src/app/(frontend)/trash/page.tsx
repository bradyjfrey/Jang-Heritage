import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Chrome } from '@/components/Chrome/Chrome'
import { NotePreview } from '@/components/NotePreview/NotePreview'
import type { Document, Media } from '@/payload-types'

export const dynamic = 'force-dynamic'

function deletedAgo(iso: string | null | undefined): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return ''
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'just now'
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

export default async function TrashPage() {
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  if (!user) redirect('/login?redirect=/trash')
  // Trash management is editor/admin only.
  if (user.role !== 'admin' && user.role !== 'editor') redirect('/')

  // trash: true + deletedAt filter → only soft-deleted documents.
  const result = await payload.find({
    collection: 'documents',
    where: { deletedAt: { exists: true } },
    trash: true,
    sort: '-deletedAt',
    limit: 200,
    depth: 1,
  })

  return (
    <>
      <Chrome user={user} active="trash" />

      <main className="max-w-7xl mx-auto px-4 py-8 md:px-8 md:py-10">
        <div className="mb-6">
          <h1 className="font-serif-content text-2xl md:text-3xl mb-1">Trash</h1>
          <p className="text-sm text-ink-soft">
            {result.totalDocs === 0
              ? 'The Trash is empty.'
              : `${result.totalDocs} ${result.totalDocs === 1 ? 'entry' : 'entries'} in the Trash. Open one to restore it or delete it permanently. Nothing is removed automatically.`}
          </p>
        </div>

        {result.docs.length === 0 ? (
          <div className="text-ink-soft text-sm py-16 text-center border border-dashed border-[color:var(--border-soft)] rounded-lg">
            Nothing here. Entries you delete will wait in the Trash until you
            permanently remove them.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
            {result.docs.map((doc) => (
              <TrashCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </main>
    </>
  )
}

function TrashCard({ doc }: { doc: Document }) {
  const isNote = doc.documentType === 'note'
  const scans = (Array.isArray(doc.scans) ? doc.scans : []).filter(
    (s): s is Media => typeof s === 'object' && s !== null,
  )
  const firstScan = scans[0]
  const showImage = !isNote && firstScan?.url
  const ago = deletedAgo(doc.deletedAt)

  return (
    <Link
      href={`/doc/${doc.id}`}
      className="relative block aspect-square rounded overflow-hidden border border-[color:var(--border-soft)] hover:ring-2 hover:ring-gold transition"
      title={`${doc.title} — in Trash`}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={firstScan.url || ''}
          alt={firstScan.alt || doc.title}
          className="absolute inset-0 w-full h-full object-cover opacity-70"
        />
      ) : (
        <div className="absolute inset-0 opacity-70">
          <NotePreview title={doc.title} body={doc.body} variant="full" />
        </div>
      )}
      <div className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded">
        Trash
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-black/80 px-3 py-2">
        <div className="text-white text-sm font-serif-content leading-tight line-clamp-1">
          {doc.title}
        </div>
        <div className="text-white/75 text-[11px]">
          {doc.documentType}
          {ago ? ` · deleted ${ago}` : ''}
        </div>
      </div>
    </Link>
  )
}
