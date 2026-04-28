// Lightweight health check. Returns 200 if Postgres responds to a trivial
// query, 503 otherwise. Intended for an external uptime monitor (e.g.
// UptimeRobot, Better Stack) to ping every minute or two.
//
// Public on purpose: monitors won't carry session cookies. Doesn't expose
// any user data.

import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@/payload.config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = Date.now()
  try {
    const payload = await getPayload({ config: await config })
    const drizzle = (
      payload.db as {
        drizzle: {
          execute: (q: unknown) => Promise<unknown>
        }
      }
    ).drizzle
    await drizzle.execute(sql`SELECT 1`)
    return NextResponse.json(
      { status: 'ok', dbLatencyMs: Date.now() - startedAt },
      { status: 200 },
    )
  } catch (err) {
    return NextResponse.json(
      {
        status: 'down',
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    )
  }
}
