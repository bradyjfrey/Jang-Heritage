// One-shot zip export for a single document. Bundles:
//   - For scan-bearing docs: every scan binary, fetched directly from R2.
//   - transcription.txt (if non-empty)
//   - translation.txt (if non-empty)
//   - notes.txt (the sidecar `notes` field, not the note body)
//   - body.md (only for note-type docs)
//   - manifest.txt — title, type, date, sender/recipient when applicable
//
// Auth-gated: requires a valid Payload session cookie (any user). Streams
// the zip back as the response body.

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import archiver from 'archiver'
import { headers as getHeaders } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'node:stream'
import { getPayload } from 'payload'

import config from '@/payload.config'
import type { Media } from '@/payload-types'

export const runtime = 'nodejs'

function safeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').trim() || 'document'
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

export async function GET(
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

  const doc = await payload
    .findByID({ collection: 'documents', id: docId, depth: 1 })
    .catch(() => null)
  if (!doc) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [transcriptions, translations] = await Promise.all([
    payload.find({
      collection: 'transcriptions',
      where: { document: { equals: docId } },
      limit: 1,
      depth: 0,
    }),
    payload.find({
      collection: 'translations',
      where: { document: { equals: docId } },
      limit: 1,
      depth: 0,
    }),
  ])
  const transcription = transcriptions.docs[0]
  const translation = translations.docs[0]

  const scans = (Array.isArray(doc.scans) ? doc.scans : []).filter(
    (s): s is Media => typeof s === 'object' && s !== null,
  )

  const archive = archiver('zip', { zlib: { level: 6 } })
  archive.on('warning', (err) => {
    if (err.code !== 'ENOENT') console.error('archiver warning', err)
  })
  archive.on('error', (err) => {
    console.error('archiver error', err)
  })

  // Manifest. Plain text so it opens anywhere.
  const manifest: string[] = []
  manifest.push(`Title: ${doc.title}`)
  manifest.push(`Type: ${doc.documentType}`)
  if (doc.dateOriginal) {
    manifest.push(
      `Date: ${doc.dateOriginal} (precision: ${doc.dateOriginalPrecision || 'unknown'})`,
    )
  }
  if (doc.documentType === 'letter') {
    if (doc.sender) manifest.push(`Sender: ${doc.sender}`)
    if (doc.recipient) manifest.push(`Recipient: ${doc.recipient}`)
    if (doc.originLocation) manifest.push(`Origin: ${doc.originLocation}`)
    if (doc.destinationLocation)
      manifest.push(`Destination: ${doc.destinationLocation}`)
  }
  manifest.push(`Exported: ${new Date().toISOString()}`)
  manifest.push(`Exported by: ${user.email}`)
  archive.append(manifest.join('\n') + '\n', { name: 'manifest.txt' })

  if (transcription?.text) {
    archive.append(transcription.text, { name: 'transcription.txt' })
  }
  if (translation?.text) {
    archive.append(translation.text, { name: 'translation.txt' })
  }
  if (doc.notes) {
    archive.append(doc.notes, { name: 'notes.txt' })
  }
  if (doc.documentType === 'note' && doc.body) {
    archive.append(doc.body, { name: 'body.md' })
  }

  // Stream every scan from R2 into the zip. Sequential to keep memory in
  // check; archiver will queue and flush as it goes.
  const bucket = process.env.S3_BUCKET || ''
  for (const scan of scans) {
    if (!scan.filename) continue
    try {
      const obj = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: scan.filename }),
      )
      const body = obj.Body
      // The AWS SDK types `Body` as a union (Node Readable | Web ReadableStream
      // | Blob) so it can target multiple runtimes. In Node it's always a
      // Node Readable — we runtime-check for `.pipe` and cast through unknown
      // to the concrete Readable archiver expects.
      if (body && typeof (body as { pipe?: unknown }).pipe === 'function') {
        archive.append(body as unknown as Readable, {
          name: `scans/${scan.filename}`,
        })
      }
    } catch (err) {
      console.error(`Failed to fetch scan ${scan.filename}`, err)
    }
  }

  archive.finalize()

  const webStream = Readable.toWeb(archive) as ReadableStream<Uint8Array>
  const filename = `${safeFilename(doc.title)}.zip`

  return new Response(webStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
