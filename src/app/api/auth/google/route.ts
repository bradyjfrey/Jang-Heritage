// Initiate Google OAuth: build the consent URL with a CSRF state cookie and
// 302 the user to Google. The callback at /api/auth/google/callback finishes
// the flow.

import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import {
  REDIRECT_COOKIE,
  STATE_COOKIE,
  generateState,
  getOAuthEnv,
  hashState,
  safeRedirect,
} from '@/lib/googleOAuth'

export async function GET(req: NextRequest) {
  const { clientId, redirectUri } = getOAuthEnv()
  const state = generateState()
  const redirectTo = safeRedirect(req.nextUrl.searchParams.get('redirect'))

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', state)
  // Force account chooser so users on shared machines can pick.
  url.searchParams.set('prompt', 'select_account')

  const cookieStore = await cookies()
  const isProd = process.env.NODE_ENV === 'production'
  cookieStore.set(STATE_COOKIE, hashState(state), {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 600,
  })
  cookieStore.set(REDIRECT_COOKIE, redirectTo, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 600,
  })

  return NextResponse.redirect(url.toString(), 302)
}
