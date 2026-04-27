import type { CollectionBeforeChangeHook } from 'payload'

// Stamps the current user onto data.lastEditedBy on every save. Combined
// with a relationship field on the collection, this gives us a per-row
// "who saved this most recently" without conflating with semantic
// transcriber/translator credit.
export const setLastEditedBy: CollectionBeforeChangeHook = ({ data, req }) => {
  if (req?.user?.id != null) {
    data.lastEditedBy = req.user.id
  }
  return data
}
