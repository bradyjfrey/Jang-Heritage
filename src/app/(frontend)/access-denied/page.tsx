import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'

export const metadata = {
  title: 'Access denied · Jang Heritage',
}

export default async function AccessDeniedPage() {
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  if (!user) redirect('/login?redirect=/')

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <span className="font-cjk text-5xl text-seal leading-none mb-3 inline-block">
          陳
        </span>
        <h1 className="font-serif-content text-2xl tracking-tight mb-3">
          Access denied
        </h1>
        <p className="text-ink-soft text-sm mb-6">
          You do not have access to this area. Please return home:
        </p>
        <Link
          href="/"
          className="inline-block bg-seal text-white px-5 py-2.5 rounded-md text-sm font-medium hover:bg-black transition-colors"
        >
          Home
        </Link>
      </div>
    </div>
  )
}
