// Google OAuth callback. Exchanges the auth code for an ID token, looks up
// the user by email in our Users collection, mints a Payload session JWT,
// and redirects.
//
// Allowlist policy: a user can only sign in if a row with their Google email
// already exists AND `allowlisted` is true. Brady manually creates rows for
// anyone he wants to grant access; absent or non-allowlisted rows bounce.

import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload, jwtSign } from 'payload'
import { generatePayloadCookie } from 'payload/shared'

import config from '@/payload.config'
import {
  REDIRECT_COOKIE,
  STATE_COOKIE,
  extractEmail,
  getOAuthEnv,
  hashState,
} from '@/lib/googleOAuth'

const LOGIN_ERROR = (code: string) =>
  NextResponse.redirect(
    new URL(
      `/login?error=${encodeURIComponent(code)}`,
      process.env.OAUTH_REDIRECT_BASE,
    ),
    302,
  )

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const stateFromGoogle = req.nextUrl.searchParams.get('state')
  const error = req.nextUrl.searchParams.get('error')
  if (error) return LOGIN_ERROR(error)
  if (!code || !stateFromGoogle) return LOGIN_ERROR('invalid_request')

  // CSRF check: cookie must equal hash of the state Google returned.
  const cookieStore = await cookies()
  const stateCookie = cookieStore.get(STATE_COOKIE)?.value
  const redirectTo = cookieStore.get(REDIRECT_COOKIE)?.value || '/'
  cookieStore.delete(STATE_COOKIE)
  cookieStore.delete(REDIRECT_COOKIE)
  if (!stateCookie || stateCookie !== hashState(stateFromGoogle)) {
    return LOGIN_ERROR('state_mismatch')
  }

  // Exchange code for tokens.
  const { clientId, clientSecret, redirectUri } = getOAuthEnv()
  let idToken: string
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenRes.ok) {
      const body = await tokenRes.text()
      console.error('Google token exchange failed', tokenRes.status, body)
      return LOGIN_ERROR('token_exchange_failed')
    }
    const tokenJson = (await tokenRes.json()) as { id_token?: string }
    if (!tokenJson.id_token) return LOGIN_ERROR('no_id_token')
    idToken = tokenJson.id_token
  } catch (err) {
    console.error('Google token exchange threw', err)
    return LOGIN_ERROR('token_exchange_failed')
  }

  // Pull email + sub from the ID token.
  let claims: ReturnType<typeof extractEmail>
  try {
    claims = extractEmail(idToken)
  } catch (err) {
    console.error('ID token parse failed', err)
    return LOGIN_ERROR('invalid_id_token')
  }
  if (!claims.emailVerified) return LOGIN_ERROR('email_not_verified')

  // Look up the Payload user by email.
  const payload = await getPayload({ config: await config })
  const found = await payload.find({
    collection: 'users',
    where: {
      and: [
        { email: { equals: claims.email } },
        { kind: { equals: 'login' } },
      ],
    },
    limit: 1,
  })
  const user = found.docs[0]
  if (!user) return LOGIN_ERROR('not_allowed')
  if (!user.allowlisted) return LOGIN_ERROR('not_allowed')

  // First-time sign-in: store googleId for audit. Subsequent sign-ins: confirm
  // the same Google account is being used (an account collision is unlikely
  // but worth refusing).
  if (!user.googleId) {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { googleId: claims.sub },
    })
  } else if (user.googleId !== claims.sub) {
    return LOGIN_ERROR('google_id_mismatch')
  }

  // Mint a Payload-compatible JWT and set the session cookie.
  const usersCollection = payload.collections.users.config
  const tokenExpiration = usersCollection.auth.tokenExpiration
  const { token } = await jwtSign({
    fieldsToSign: {
      id: user.id,
      collection: 'users',
      email: user.email,
    },
    secret: payload.secret,
    tokenExpiration,
  })
  const sessionCookie = generatePayloadCookie({
    collectionAuthConfig: usersCollection.auth,
    cookiePrefix: payload.config.cookiePrefix,
    token,
  })

  const res = NextResponse.redirect(
    new URL(redirectTo, process.env.OAUTH_REDIRECT_BASE),
    302,
  )
  res.headers.append('Set-Cookie', sessionCookie as string)
  return res
}
