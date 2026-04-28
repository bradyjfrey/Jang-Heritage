// PATCH /api/me/profile — let the signed-in user update fields on their
// own row that are safe for self-edit (currently just `displayName`). The
// row-level Users update access stays admin-only; we use overrideAccess on
// the local API after validating identity here.

import { headers as getHeaders } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@/payload.config'

export async function PATCH(req: NextRequest) {
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { displayName } = (body || {}) as { displayName?: unknown }
  if (typeof displayName !== 'string') {
    return NextResponse.json(
      { error: 'displayName must be a string' },
      { status: 400 },
    )
  }
  const trimmed = displayName.trim()
  if (!trimmed || trimmed.length > 120) {
    return NextResponse.json(
      { error: 'displayName must be 1–120 characters' },
      { status: 400 },
    )
  }

  const updated = await payload.update({
    collection: 'users',
    id: user.id,
    data: { displayName: trimmed },
    overrideAccess: true,
  })
  return NextResponse.json({
    id: updated.id,
    displayName: updated.displayName,
    updatedAt: updated.updatedAt,
  })
}
