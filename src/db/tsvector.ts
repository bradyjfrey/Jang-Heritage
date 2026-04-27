import { customType } from 'drizzle-orm/pg-core'

// Drizzle doesn't model Postgres `tsvector` natively, so we declare a custom
// column type. Reads/writes treat the value as a string; Postgres handles the
// actual tsvector internally. Combine with a GIN index for fast @@ queries.
export const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => 'tsvector',
})
