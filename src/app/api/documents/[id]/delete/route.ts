// Soft-delete: move a document to the Trash by setting `deletedAt`. The entry
// and all its R2 image files are retained and fully restorable — it just drops
// out of every listing (find/findByID/count exclude trashed docs by default).
//
// Permanent removal (which also deletes the R2 files) lives in the sibling
// /purge route and is only reachable from the Trash page. Nothing auto-purges.

import { headers as getHeaders } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@/payload.config'

export const runtime = 'nodejs'

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

  try {
    await payload.update({
      collection: 'documents',
      id: docId,
      data: { deletedAt: new Date().toISOString() },
    })
  } catch (err) {
    console.error(`Soft-delete failed for document ${docId}`, err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
