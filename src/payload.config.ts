import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Documents } from './collections/Documents'
import { Transcriptions } from './collections/Transcriptions'
import { Translations } from './collections/Translations'
import { Tags } from './collections/Tags'
import { addSearchVectors } from './db/searchVectors'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Documents, Transcriptions, Translations, Tags, Media],
  editor: lexicalEditor(),
  // Per-IP throttle on /api/* requests. Defaults are Payload's, set
  // explicitly so the value is visible. Returns 429 when exceeded.
  rateLimit: {
    max: 500,
    window: 15 * 60 * 1000,
  },
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    afterSchemaInit: [addSearchVectors],
  }),
  // Gmail SMTP (app password). Used by the Users afterChange hook to send
  // invite emails when Brady creates a new login user in admin.
  email: nodemailerAdapter({
    defaultFromAddress: process.env.MAIL_FROM_EMAIL || '',
    defaultFromName: process.env.MAIL_FROM_NAME || 'Jang Heritage',
    transportOptions: {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    },
  }),
  sharp,
  plugins: [
    // Route Media uploads to Cloudflare R2 via the S3-compatible API.
    // Local dev and prod both use this; bucket and credentials swap via env vars.
    s3Storage({
      collections: {
        media: true,
      },
      bucket: process.env.S3_BUCKET || '',
      config: {
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        },
        region: 'auto',
        endpoint: process.env.S3_ENDPOINT || '',
        forcePathStyle: true,
        // R2 doesn't support the integrity headers the AWS SDK started
        // sending by default in v3.730+. Tell the SDK to only send checksums
        // when the operation requires it.
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      },
    }),
  ],
})
