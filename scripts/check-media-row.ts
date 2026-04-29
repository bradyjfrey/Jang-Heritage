// Dump a media DB row so we can see whether `url`/`filename`/sizes were
// persisted with stale absolute URLs.
//
// Usage:
//   pnpm tsx scripts/check-media-row.ts <filename-or-id>

import { config as loadDotenv } from 'dotenv'
loadDotenv()

import { getPayload } from 'payload'
import config from '../src/payload.config'

const arg = process.argv[2]
if (!arg) {
  console.error('Usage: pnpm tsx scripts/check-media-row.ts <filename-or-id>')
  process.exit(1)
}

async function main() {
  const payload = await getPayload({ config: await config })

  const asNum = Number.parseInt(arg, 10)
  let row
  if (!Number.isNaN(asNum)) {
    row = await payload.findByID({ collection: 'media', id: asNum }).catch(() => null)
  }
  if (!row) {
    const found = await payload.find({
      collection: 'media',
      where: { filename: { equals: arg } },
      limit: 1,
    })
    row = found.docs[0]
  }
  if (!row) {
    console.error(`No media row found for "${arg}"`)
    process.exit(2)
  }
  console.log(JSON.stringify(row, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(3)
})
