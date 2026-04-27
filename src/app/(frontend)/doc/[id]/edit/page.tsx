import { headers as getHeaders } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Editor } from '@/components/Editor/Editor'

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

  const doc = await payload
    .findByID({ collection: 'documents', id: docId, depth: 2 })
    .catch(() => null)
  if (!doc) notFound()

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
