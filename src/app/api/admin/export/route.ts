// Full-archive export. Admin-only. Three formats via ?format=:
//
//   json   (default) — a single JSON snapshot of every content collection
//                      (documents, transcriptions, translations, tags, media
//                      metadata, users). Relations as IDs. Small, instant.
//
//   images           — a structured ZIP of just the binaries: one folder per
//                      entry (scan/<id - title>/media/… or note/…/media/…),
//                      pulled from R2.
//
//   full             — the true structural backup: the same per-entry tree,
//                      each folder carrying manifest.txt, the text files
//                      (transcription/translation, or note.txt), and a media/
//                      folder. Plus archive.json at the root for re-import.
//
// Scan/attachment binaries are streamed sequentially from R2 so memory stays
// flat regardless of archive size. Modeled on the per-document export route.

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import archiver from 'archiver'
import { headers as getHeaders } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'node:stream'
import { getPayload, type BasePayload } from 'payload'
import type { CollectionSlug } from 'payload'

import config from '@/payload.config'
import type { Document, Media, Tag, Transcription, Translation } from '@/payload-types'

export const runtime = 'nodejs'

function safeName(name: string): string {
  return (
    name
      .replace(/[/\\:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim() || 'untitled'
  )
}

const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
  region: 'auto',
  endpoint: process.env.S3_ENDPOINT || '',
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

const SNAPSHOT_COLLECTIONS: CollectionSlug[] = [
  'documents',
  'transcriptions',
  'translations',
  'tags',
  'media',
  'users',
]

// Flat content snapshot, relations kept as IDs (depth: 0).
async function buildSnapshot(payload: BasePayload, email: string) {
  const collections: Record<string, unknown[]> = {}
  for (const slug of SNAPSHOT_COLLECTIONS) {
    const res = await payload.find({ collection: slug, depth: 0, pagination: false })
    collections[slug] = res.docs
  }
  return {
    app: 'Jang Heritage',
    exportedAt: new Date().toISOString(),
    exportedBy: email,
    note: 'Relations are stored as IDs. Media binaries are not in this file; use the Everything (ZIP) export for images.',
    collections,
  }
}

// Maps a transcription/translation's `document` relation (an ID at depth 0,
// occasionally a populated object) to its numeric document id.
function relDocId(rel: number | { id: number } | null | undefined): number | null {
  if (rel == null) return null
  return typeof rel === 'object' ? rel.id : rel
}

export async function GET(req: NextRequest) {
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const format = req.nextUrl.searchParams.get('format') || 'json'
  const date = new Date().toISOString().slice(0, 10)

  // ---- json: flat snapshot ------------------------------------------------
  if (format === 'json') {
    const snapshot = await buildSnapshot(payload, user.email)
    return new Response(JSON.stringify(snapshot, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="jang-heritage-export-${date}.json"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  if (format !== 'images' && format !== 'full') {
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
  }

  // includeText distinguishes the structural backup (full) from images-only.
  const includeText = format === 'full'

  // depth: 1 populates uploads (scans/attachments) and tags as objects.
  const docsRes = await payload.find({ collection: 'documents', depth: 1, pagination: false })
  const documents = docsRes.docs as Document[]

  // Index transcription/translation text by document id (one query each).
  const [txRes, tlRes] = await Promise.all([
    payload.find({ collection: 'transcriptions', depth: 0, pagination: false }),
    payload.find({ collection: 'translations', depth: 0, pagination: false }),
  ])
  const txByDoc = new Map<number, Transcription>()
  for (const t of txRes.docs as Transcription[]) {
    const id = relDocId(t.document)
    if (id != null) txByDoc.set(id, t)
  }
  const tlByDoc = new Map<number, Translation>()
  for (const t of tlRes.docs as Translation[]) {
    const id = relDocId(t.document)
    if (id != null) tlByDoc.set(id, t)
  }

  const archive = archiver('zip', { zlib: { level: 6 } })
  archive.on('warning', (err) => {
    if (err.code !== 'ENOENT') console.error('archiver warning', err)
  })

  // Collect the archive into memory and return it as one complete body.
  // A streamed (Readable.toWeb) response did not trigger a download in the
  // app, whereas the JSON path's complete-body response does. Buffering is
  // fine at current archive sizes; revisit streaming if archives grow into
  // the multi-GB range.
  const chunks: Buffer[] = []
  archive.on('data', (c: Buffer) => chunks.push(c))
  const archiveDone = new Promise<void>((resolve, reject) => {
    archive.on('end', () => resolve())
    archive.on('error', reject)
  })

  const readme = [
    'Jang Heritage archive export',
    `Exported: ${new Date().toISOString()}`,
    `Exported by: ${user.email}`,
    '',
    'Layout:',
    '  scan/<id - title>/   non-note entries (letters, diaries, photos, etc.)',
    '  note/<id - title>/   note entries',
    includeText
      ? '    manifest.txt, transcription.txt + translation.txt (or note.txt), media/'
      : '    media/   (images only)',
    includeText ? '  archive.json   full machine-readable snapshot (relations as IDs)' : '',
    '',
    'Media binaries are the original files as stored.',
  ]
    .filter((l) => l !== '')
    .join('\n')
  archive.append(readme + '\n', { name: 'README.txt' })

  if (includeText) {
    const snapshot = await buildSnapshot(payload, user.email)
    archive.append(JSON.stringify(snapshot, null, 2), { name: 'archive.json' })
  }

  const bucket = process.env.S3_BUCKET || ''

  for (const doc of documents) {
    const isNote = doc.documentType === 'note'
    const folder = `${isNote ? 'note' : 'scan'}/${doc.id} - ${safeName(doc.title)}`

    const mediaSource = isNote ? doc.attachments : doc.scans
    const mediaItems = (Array.isArray(mediaSource) ? mediaSource : []).filter(
      (m): m is Media => typeof m === 'object' && m !== null,
    )

    if (includeText) {
      const manifest: string[] = []
      manifest.push(`Title: ${doc.title}`)
      manifest.push(`Type: ${doc.documentType}`)
      manifest.push(`ID: ${doc.id}`)
      if (doc.dateOriginal) {
        manifest.push(
          `Date: ${doc.dateOriginal} (precision: ${doc.dateOriginalPrecision || 'unknown'})`,
        )
      }
      if (doc.documentType === 'letter') {
        if (doc.sender) manifest.push(`Sender: ${doc.sender}`)
        if (doc.recipient) manifest.push(`Recipient: ${doc.recipient}`)
        if (doc.originLocation) manifest.push(`Origin: ${doc.originLocation}`)
        if (doc.destinationLocation) manifest.push(`Destination: ${doc.destinationLocation}`)
      }
      const tagNames = (Array.isArray(doc.tags) ? doc.tags : [])
        .map((t) => (typeof t === 'object' && t ? (t as Tag).name : null))
        .filter((n): n is string => Boolean(n))
      if (tagNames.length) manifest.push(`Tags: ${tagNames.join(', ')}`)
      archive.append(manifest.join('\n') + '\n', { name: `${folder}/manifest.txt` })

      if (isNote) {
        if (doc.body) archive.append(doc.body, { name: `${folder}/note.txt` })
      } else {
        const tx = txByDoc.get(doc.id)
        const tl = tlByDoc.get(doc.id)
        if (tx?.text) archive.append(tx.text, { name: `${folder}/transcription.txt` })
        if (tl?.text) archive.append(tl.text, { name: `${folder}/translation.txt` })
      }
      // Sidecar notes (non-note docs only carry this field).
      if (doc.notes) archive.append(doc.notes, { name: `${folder}/notes.txt` })
    }

    for (const m of mediaItems) {
      if (!m.filename) continue
      try {
        const obj = await s3.send(
          new GetObjectCommand({ Bucket: bucket, Key: m.filename }),
        )
        const body = obj.Body
        if (body && typeof (body as { pipe?: unknown }).pipe === 'function') {
          archive.append(body as unknown as Readable, {
            name: `${folder}/media/${m.filename}`,
          })
        }
      } catch (err) {
        console.error(`Failed to fetch media ${m.filename}`, err)
      }
    }
  }

  await archive.finalize()
  await archiveDone
  const buffer = Buffer.concat(chunks)

  const filename = includeText
    ? `jang-heritage-archive-${date}.zip`
    : `jang-heritage-images-${date}.zip`

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store',
    },
  })
}
