import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Chrome } from '@/components/Chrome/Chrome'
import { ScanDropzone } from '@/components/AddEntry/ScanDropzone'

export const metadata = {
  title: 'New scan · Jang Heritage',
}

// Themed quick-add for scan-bearing types (letter / diary / photo / article
// / document). User drops file(s); the dropzone uploads to R2 via /api/media,
// creates a Document with those scans attached, and lands in the editor.
//
// Notes use a different path (/add/note) because they don't carry scans.
export default async function AddPage() {
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  if (!user) redirect('/login?redirect=/add')

  return (
    <>
      <Chrome
        user={user}
        below={{
          type: 'breadcrumb',
          items: [
            { label: 'Home', href: '/' },
            { label: 'New scan' },
          ],
        }}
      />
      <main className="max-w-3xl mx-auto px-8 py-12">
        <div className="mb-8 text-center">
          <h1 className="font-serif-content text-3xl mb-2">New scan</h1>
          <p className="text-ink-soft">
            Drop your scan to begin. You can add more scans, type a transcription
            and translation, and adjust metadata after.
          </p>
        </div>
        <div className="flex justify-center">
          <ScanDropzone />
        </div>
      </main>
    </>
  )
}
