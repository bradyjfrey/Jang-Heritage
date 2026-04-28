// Dump the byte representation of S3_BUCKET (and friends) so we can see
// exactly what Node sees, including any trailing spaces, NBSPs, or other
// invisible characters that don't show up in the editor.
//
// Usage: pnpm tsx scripts/check-env-bytes.ts

import { config as loadDotenv } from 'dotenv'
loadDotenv()

const keys = [
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_ENDPOINT',
] as const

for (const key of keys) {
  const v = process.env[key]
  if (v == null) {
    console.log(`${key}: <undefined>`)
    continue
  }
  const bytes = Array.from(Buffer.from(v, 'utf8'))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')
  console.log(`${key}: len=${v.length} bytes=[${bytes}] value=[${v}]`)
}
