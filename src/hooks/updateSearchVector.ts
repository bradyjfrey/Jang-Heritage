import type { CollectionAfterChangeHook } from 'payload'
import { sql } from 'drizzle-orm'

// Each hook runs after Payload has saved the row, then issues an UPDATE that
// populates the tsvector column from already-stored text fields. Two-op pattern
// (insert/update + then update vector) is fine at this scale.
//
// Direct drizzle.execute call (rather than the adapter's execute() wrapper)
// because the wrapper requires a db/drizzle handle to be threaded through;
// going direct keeps the hook self-contained.

export const updateTranscriptionSearchVector: CollectionAfterChangeHook = async ({
  doc,
  req,
}) => {
  const drizzle = (req.payload.db as any).drizzle
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
  const drizzle = (req.payload.db as any).drizzle
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
  const drizzle = (req.payload.db as any).drizzle
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
