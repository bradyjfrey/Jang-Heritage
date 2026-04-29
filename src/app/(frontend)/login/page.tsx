import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'

export const metadata = {
  title: 'Sign in · Jang Heritage',
}

function safeRedirect(value: string | undefined): string {
  if (!value) return '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

const ERROR_COPY: Record<string, string> = {
  not_allowed:
    "That Google account isn't on the allowlist. Contact Brady if you should have access.",
  state_mismatch:
    "Sign-in security check failed. This usually means the page sat too long. Try again.",
  invalid_request: 'Sign-in request was malformed. Try again.',
  token_exchange_failed:
    "Couldn't complete sign-in with Google. Try again, and check the dev console if it persists.",
  no_id_token: 'Google did not return an identity token. Try again.',
  invalid_id_token: 'Could not read the identity token. Try again.',
  email_not_verified:
    'Your Google account email is not verified. Verify it with Google, then try again.',
  google_id_mismatch:
    'This email is already linked to a different Google account. Contact Brady.',
  access_denied: 'You declined the Google sign-in. Try again if that was a mistake.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>
}) {
  const params = await searchParams
  const redirectTo = safeRedirect(params.redirect)

  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  if (user) redirect(redirectTo)

  const errorMessage = params.error
    ? ERROR_COPY[params.error] || `Sign-in failed (${params.error}).`
    : null

  // Forward the desired post-login destination to the OAuth initiator.
  const initiateHref = `/api/auth/google?redirect=${encodeURIComponent(redirectTo)}`

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

        <div className="space-y-4">
          {errorMessage ? (
            <div
              role="alert"
              className="text-sm text-seal rounded-md border border-seal/30 bg-seal/5 px-3 py-2"
            >
              {errorMessage}
            </div>
          ) : null}

          <a
            href={initiateHref}
            className="w-full bg-seal text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-black transition-colors inline-flex items-center justify-center gap-2"
          >
            <GoogleGlyph />
            Sign in with Google
          </a>
        </div>

        <p className="mt-6 text-xs text-ink-faint text-center">
          Authorized users only. Contact Brady if you need access.
        </p>
      </div>
    </div>
  )
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#fff"
        d="M21.35 11.1H12v3.8h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.74 4.6 14.6 3.6 12 3.6 6.92 3.6 2.8 7.7 2.8 12.85s4.12 9.25 9.2 9.25c5.31 0 8.83-3.73 8.83-8.98 0-.6-.07-1.06-.18-1.52z"
      />
    </svg>
  )
}
