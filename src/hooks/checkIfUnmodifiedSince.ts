import type { CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'

// Optimistic concurrency: if the client sent `X-If-Unmodified-Since: <iso>`
// and the row's current updatedAt is later, someone else saved meanwhile.
// Reject with 409 Conflict. The client can warn and offer to reload.
//
// Custom header (not standard If-Unmodified-Since) because the standard
// expects HTTP-date format, not ISO 8601. Skipped on `create` (no row to
// conflict with) and when the header is missing (lets non-editor callers
// like Payload admin or our own POST flow proceed without opting in).
export const checkIfUnmodifiedSince: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
  operation,
}) => {
  if (operation !== 'update' || !originalDoc) return data

  const headerValue = req.headers?.get?.('x-if-unmodified-since')
  if (!headerValue) return data

  const expected = new Date(headerValue).getTime()
  if (Number.isNaN(expected)) return data

  const actualSource = (originalDoc as { updatedAt?: string | Date }).updatedAt
  const actual = actualSource ? new Date(actualSource).getTime() : 0

  if (actual > expected) {
    throw new APIError(
      'Conflict: this record was modified by someone else since you opened it. Refresh to see the latest version.',
      409,
    )
  }

  return data
}
