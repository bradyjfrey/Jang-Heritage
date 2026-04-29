// Break-glass: ensure a login-capable, allowlisted admin user exists.
// Use when Google SSO is unavailable (misconfigured callback, expired
// credentials, fresh DB, etc.) and you need to recover access by hand.
//
// Idempotent: creates the user if missing, or flips kind/role/allowlisted
// if the row exists but isn't usable.
//
// Usage:
//   pnpm tsx "scripts/bootstrap-user.ts" <email> [displayName]
//
// Example:
//   pnpm tsx "scripts/bootstrap-user.ts" brady@bradyjfrey.com "Brady Frey"

// devenv no longer auto-loads .env, so the script self-loads.
import { config as loadDotenv } from 'dotenv'
loadDotenv()

import { getPayload } from 'payload'
import config from '../src/payload.config'

const [, , email, displayName] = process.argv

if (!email) {
  console.error(
    'Usage: pnpm tsx "scripts/bootstrap-user.ts" <email> [displayName]',
  )
  process.exit(1)
}

async function main() {
  const payload = await getPayload({ config: await config })

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
  })

  const finalDisplayName = displayName || email.split('@')[0]

  if (existing.docs[0]) {
    const user = existing.docs[0]
    const updated = await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        displayName: user.displayName || finalDisplayName,
        kind: 'login',
        role: 'admin',
        allowlisted: true,
      },
    })
    console.log(
      `Ensured admin access for existing user ${updated.email} (id=${updated.id}).`,
    )
  } else {
    const created = await payload.create({
      collection: 'users',
      data: {
        email,
        displayName: finalDisplayName,
        kind: 'login',
        role: 'admin',
        allowlisted: true,
      },
    })
    console.log(
      `Created new admin user ${created.email} (id=${created.id}, displayName="${created.displayName}").`,
    )
    console.log(
      'An invite email may have been sent via the Users afterChange hook.',
    )
  }

  console.log(
    `Sign in with Google at ${process.env.OAUTH_REDIRECT_BASE || 'http://localhost:3000'} using ${email}.`,
  )
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
