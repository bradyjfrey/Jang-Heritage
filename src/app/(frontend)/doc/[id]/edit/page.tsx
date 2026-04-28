import { headers as getHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Editor } from '@/components/Editor/Editor'
import { NoteEditor } from '@/components/Editor/NoteEditor'

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const docId = Number.parseInt(id, 10)
  if (Number.isNaN(docId)) notFound()

  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  // Auth gate: anonymous visitors land on the themed login page, which
  // bounces them back here after sign-in.
  if (!user) {
    const next = encodeURIComponent(`/doc/${docId}/edit`)
    redirect(`/login?redirect=${next}`)
  }
  if (user.role !== 'admin' && user.role !== 'editor') {
    redirect(`/doc/${docId}`)
  }

  const doc = await payload
    .findByID({ collection: 'documents', id: docId, depth: 2 })
    .catch(() => null)
  if (!doc) notFound()

  // Notes use a single-pane editor that saves Documents.body directly;
  // skip the Transcriptions/Translations fetch entirely.
  if (doc.documentType === 'note') {
    return <NoteEditor document={doc} user={user} />
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

  return (
    <Editor
      document={doc}
      transcription={transcriptions.docs[0] || null}
      translation={translations.docs[0] || null}
      user={user}
    />
  )
}
