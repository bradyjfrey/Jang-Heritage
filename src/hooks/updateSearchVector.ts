import type { CollectionAfterChangeHook, PayloadRequest } from 'payload'
import { sql } from 'drizzle-orm'

// Resolves the drizzle handle bound to the current request's transaction (if
// any), falling back to the adapter's default drizzle outside transactions.
//
// Without this, an UPDATE issued from afterChange opens a fresh connection and
// deadlocks on the row lock that Payload's outer transaction is still holding.
function getRequestDrizzle(req: PayloadRequest) {
  const adapter = req.payload.db as any
  const tx = req.transactionID
    ? adapter.sessions?.[String(req.transactionID)]?.db
    : undefined
  return tx ?? adapter.drizzle
}

// Each hook runs after Payload has saved the row, then issues an UPDATE that
// populates the tsvector column from already-stored text fields. Two-op pattern
// (insert/update + then update vector) is fine at this scale.

export const updateTranscriptionSearchVector: CollectionAfterChangeHook = async ({
  doc,
  req,
}) => {
  const drizzle = getRequestDrizzle(req)
  const segmented = (doc.textSegmented as string) || ''
  await drizzle.execute(
    sql`UPDATE transcriptions SET search_vector = setweight(to_tsvector('simple', ${segmented}), 'A') WHERE id = ${doc.id}`,
  )
  return doc
}

export const updateTranslationSearchVector: CollectionAfterChangeHook = async ({
  doc,
  req,
}) => {
  const drizzle = getRequestDrizzle(req)
  const text = (doc.text as string) || ''
  await drizzle.execute(
    sql`UPDATE translations SET search_vector = setweight(to_tsvector('english', ${text}), 'A') WHERE id = ${doc.id}`,
  )
  return doc
}

export const updateDocumentBodySearchVector: CollectionAfterChangeHook = async ({
  doc,
  req,
}) => {
  const drizzle = getRequestDrizzle(req)
  if (doc.documentType !== 'note') {
    // Non-note documents don't carry body content; clear any stale vector.
    await drizzle.execute(
      sql`UPDATE documents SET body_search_vector = NULL WHERE id = ${doc.id}`,
    )
    return doc
  }
  const segmented = (doc.bodySegmented as string) || ''
  await drizzle.execute(
    sql`UPDATE documents SET body_search_vector = setweight(to_tsvector('simple', ${segmented}), 'A') WHERE id = ${doc.id}`,
  )
  return doc
}
