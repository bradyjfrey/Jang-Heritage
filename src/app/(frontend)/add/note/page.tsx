import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'

// One-click "new note" entry path. Creates an empty note row, then
// redirects straight into the single-pane editor where the user starts
// typing. Pattern matches Notion / most modern note apps. The Documents
// beforeChange hook fills in dateOriginal=today + precision=day on save.
//
// Side-effect: a navigated-and-abandoned visit leaves an "Untitled note"
// row in the DB. Acceptable at our scale; can be swept periodically.
export default async function AddNotePage() {
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  if (!user) redirect('/login?redirect=/add/note')

  const created = await payload.create({
    collection: 'documents',
    data: {
      title: 'Untitled note',
      documentType: 'note',
    },
  })

  redirect(`/doc/${created.id}/edit`)
}
