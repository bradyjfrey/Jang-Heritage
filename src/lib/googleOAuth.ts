// Helpers shared between the Google OAuth initiate + callback routes.

import { createHash, randomBytes } from 'crypto'

export const STATE_COOKIE = 'google_oauth_state'
export const REDIRECT_COOKIE = 'google_oauth_redirect'

export function getOAuthEnv() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const redirectBase = process.env.OAUTH_REDIRECT_BASE
  if (!clientId || !clientSecret || !redirectBase) {
    throw new Error(
      'Missing GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, or OAUTH_REDIRECT_BASE',
    )
  }
  return {
    clientId,
    clientSecret,
    redirectUri: `${redirectBase.replace(/\/$/, '')}/api/auth/google/callback`,
  }
}

// CSRF state: random opaque token. Stored as a cookie + sent in Google's
// `state` query param; callback compares the two.
export function generateState(): string {
  return randomBytes(32).toString('base64url')
}

// Hash to keep the cookie's value derived from the param, never the raw secret.
export function hashState(state: string): string {
  return createHash('sha256').update(state).digest('base64url')
}

// Same-origin only, must start with "/" (and not "//"), to prevent open redirects.
export function safeRedirect(value: string | null | undefined): string {
  if (!value) return '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

// Parse the ID token (a JWT) and extract email. We trust Google here because
// we're getting the token over a TLS-secured server-to-server exchange that
// authenticated us with our client_secret. No need to verify the signature.
export function extractEmail(idToken: string): {
  email: string
  emailVerified: boolean
  sub: string
  name?: string
} {
  const [, payloadB64] = idToken.split('.')
  if (!payloadB64) throw new Error('Malformed ID token')
  const json = Buffer.from(payloadB64, 'base64url').toString('utf8')
  const claims = JSON.parse(json) as {
    email?: string
    email_verified?: boolean
    sub?: string
    name?: string
  }
  if (!claims.email || !claims.sub) {
    throw new Error('ID token missing email or sub')
  }
  return {
    email: claims.email,
    emailVerified: claims.email_verified === true,
    sub: claims.sub,
    name: claims.name,
  }
}
