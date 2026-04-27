import type { PostgresSchemaHook } from '@payloadcms/drizzle/postgres'
import { index } from 'drizzle-orm/pg-core'

import { tsvector } from './tsvector'

// Adds a Postgres tsvector column + GIN index to each content table that
// participates in full-text search. Values are populated by afterChange hooks
// (see src/hooks/updateSearchVector.ts), not by the schema layer.
//
// Declaring these via Payload's afterSchemaInit hook keeps Drizzle's dev push
// aware of the columns, so it doesn't try to drop them on every schema diff.
export const addSearchVectors: PostgresSchemaHook = ({ schema, extendTable }) => {
  extendTable({
    table: schema.tables.transcriptions,
    columns: {
      searchVector: tsvector('search_vector'),
    },
    extraConfig: (t: any) => ({
      searchVectorIdx: index('transcriptions_search_vector_idx').using(
        'gin',
        t.searchVector,
      ),
    }),
  })

  extendTable({
    table: schema.tables.translations,
    columns: {
      searchVector: tsvector('search_vector'),
    },
    extraConfig: (t: any) => ({
      searchVectorIdx: index('translations_search_vector_idx').using(
        'gin',
        t.searchVector,
      ),
    }),
  })

  extendTable({
    table: schema.tables.documents,
    columns: {
      bodySearchVector: tsvector('body_search_vector'),
    },
    extraConfig: (t: any) => ({
      bodySearchVectorIdx: index('documents_body_search_vector_idx').using(
        'gin',
        t.bodySearchVector,
      ),
    }),
  })

  return schema
}
