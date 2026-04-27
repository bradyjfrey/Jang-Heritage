import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { LoginForm } from '@/components/Login/LoginForm'

export const metadata = {
  title: 'Sign in · Jang Heritage',
}

function safeRedirect(value: string | undefined): string {
  // Only allow same-origin paths beginning with a single forward slash.
  // Prevents open-redirect via ?redirect=https://evil.example.
  if (!value) return '/admin'
  if (!value.startsWith('/') || value.startsWith('//')) return '/admin'
  return value
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const params = await searchParams
  const redirectTo = safeRedirect(params.redirect)

  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  if (user) redirect(redirectTo)

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <span className="font-cjk text-5xl text-seal leading-none mb-3">
            陳
          </span>
          <span className="font-serif-content text-2xl tracking-tight">
            Jang Heritage
          </span>
          <p className="text-ink-soft text-sm mt-2">Sign in to continue.</p>
        </div>

        <div className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-6 shadow-sm">
          <LoginForm redirectTo={redirectTo} />
        </div>

        <p className="mt-6 text-xs text-ink-faint text-center">
          Authorized users only. Contact Brady if you need access.
        </p>
      </div>
    </div>
  )
}
