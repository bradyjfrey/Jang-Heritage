import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Chrome } from '@/components/Chrome/Chrome'
import { ProfileForm } from '@/components/Settings/ProfileForm'

export const metadata = {
  title: 'Settings · Jang Heritage',
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
}

export default async function SettingsPage() {
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  if (!user) redirect('/login?redirect=/settings')

  return (
    <>
      <Chrome user={user} />
      <div className="max-w-3xl mx-auto px-4 py-8 md:px-8 md:py-10">
        <h1 className="font-serif-content text-2xl mb-1">Settings</h1>
        <p className="text-ink-soft text-sm mb-8">
          Edit how you appear across the app. Email and role are managed by
          the administrator.
        </p>

        <section className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-6 mb-6">
          <div className="text-[11px] uppercase tracking-wider text-ink-faint mb-4">
            Profile
          </div>
          <ProfileForm initialDisplayName={user.displayName || ''} />
        </section>

        <section className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-6">
          <div className="text-[11px] uppercase tracking-wider text-ink-faint mb-4">
            Account
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs text-ink-faint block">Email</span>
              <div>{user.email}</div>
            </div>
            <div>
              <span className="text-xs text-ink-faint block">Role</span>
              <div>{ROLE_LABEL[user.role || ''] || user.role}</div>
            </div>
          </div>
        </section>

        {user.role === 'admin' ? (
          <section className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-6 mt-6">
            <div className="text-[11px] uppercase tracking-wider text-ink-faint mb-4">
              Data
            </div>
            <p className="text-sm text-ink-soft mb-5">
              Download a snapshot of the archive. Images live in storage, so
              include them only when you need them.
            </p>
            <div className="space-y-4">
              <div>
                <a
                  href="/api/admin/export?format=json"
                  download
                  className="inline-block bg-seal text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-black transition-colors"
                >
                  Text &amp; data (JSON)
                </a>
                <p className="text-xs text-ink-faint mt-1.5">
                  Every record&rsquo;s text and metadata without images.
                </p>
              </div>
              <div>
                <a
                  href="/api/admin/export?format=images"
                  download
                  className="inline-block bg-seal text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-black transition-colors"
                >
                  Images (ZIP)
                </a>
                <p className="text-xs text-ink-faint mt-1.5">
                  All scans and attachments, foldered by entry. The file size
                  may be large.
                </p>
              </div>
              <div>
                <a
                  href="/api/admin/export?format=full"
                  download
                  className="inline-block bg-seal text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-black transition-colors"
                >
                  Everything (ZIP)
                </a>
                <p className="text-xs text-ink-faint mt-1.5">
                  A structured tree of <code>scan/</code> and <code>note/</code>{' '}
                  folders, one per entry, each with its text files and a{' '}
                  <code>media/</code> folder, for a complete backup.
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </>
  )
}
