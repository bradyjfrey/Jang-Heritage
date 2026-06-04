// Restore a trashed document: clear `deletedAt` so it returns to the archive,
// fully intact (transcription, translation, metadata, and R2 images were never
// touched). `trash: true` is required so the update can target a doc that is
// currently soft-deleted — by default update ignores trashed rows.

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
      data: { deletedAt: null },
      trash: true,
    })
  } catch (err) {
    console.error(`Restore failed for document ${docId}`, err)
    return NextResponse.json({ error: 'Restore failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
