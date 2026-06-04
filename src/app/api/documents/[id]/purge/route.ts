// Permanent delete (irreversible). Removes everything a document owns:
//   - its scan + attachment media (the s3Storage afterDelete hook deletes the
//     underlying objects from R2, so the files leave the server too)
//   - its transcription and translation rows
//   - the document itself
// Tags are shared across documents and are left untouched.
//
// Only reached from the Trash page's "Delete Forever" action, so it operates
// on already-trashed docs — hence `trash: true` on the lookups and the final
// delete (without it, those ops ignore soft-deleted rows).

import { headers as getHeaders } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@/payload.config'

export const runtime = 'nodejs'

function toId(v: unknown): number | null {
  if (typeof v === 'number') return v
  if (typeof v === 'object' && v !== null && 'id' in v) {
    const id = (v as { id: unknown }).id
    if (typeof id === 'number') return id
  }
  return null
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const docId = Number.parseInt(id, 10)
  if (Number.isNaN(docId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (user.role !== 'admin' && user.role !== 'editor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // depth 0 → upload fields come back as plain ids. trash: true so we can find
  // the doc even though it's soft-deleted.
  const doc = await payload
    .findByID({ collection: 'documents', id: docId, depth: 0, trash: true })
    .catch(() => null)
  if (!doc) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const mediaIds = [
    ...(Array.isArray(doc.scans) ? doc.scans : []),
    ...(Array.isArray(doc.attachments) ? doc.attachments : []),
  ]
    .map(toId)
    .filter((v): v is number => v != null)

  // Child rows first, so nothing dangles if a later step throws. Bulk deletes
  // are no-ops when there's no match, so this is safe for note-type docs too.
  await payload
    .delete({ collection: 'transcriptions', where: { document: { equals: docId } } })
    .catch((e) => console.error('delete transcriptions failed', e))
  await payload
    .delete({ collection: 'translations', where: { document: { equals: docId } } })
    .catch((e) => console.error('delete translations failed', e))

  // Each media delete fires the s3Storage afterDelete hook, removing the
  // object from R2. De-dupe in case a media id appears in both fields.
  for (const mediaId of Array.from(new Set(mediaIds))) {
    await payload
      .delete({ collection: 'media', id: mediaId })
      .catch((e) => console.error(`delete media ${mediaId} failed`, e))
  }

  // trash: true so delete will act on the soft-deleted document.
  await payload.delete({ collection: 'documents', id: docId, trash: true })

  return NextResponse.json({ ok: true })
}
