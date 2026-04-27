import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { NoteEditor } from '@/components/Editor/NoteEditor'

// New-note entry path. Renders the single-pane editor with no Document
// attached; the editor's first autosave POSTs to create the row, then
// silently rewrites the URL to /doc/<id>/edit. No row is created if the
// user clicks here and leaves without typing.
export default async function AddNotePage() {
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  if (!user) redirect('/login?redirect=/add/note')

  return <NoteEditor document={null} user={user} />
}
