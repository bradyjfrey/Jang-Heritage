import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'

// Gate /admin to role=admin. Non-admins land on a Jang-styled access-denied
// page rather than Payload's stock no-access screen. Wraps Payload's
// auto-generated admin pages without touching them.
export default async function AdminGuardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  // Not signed in: let Payload's own admin login screen render.
  if (!user) return <>{children}</>

  if (user.role !== 'admin') {
    redirect('/access-denied')
  }

  return <>{children}</>
}
