import type { CollectionConfig } from 'payload'
import { JWTAuthentication } from 'payload'
import { isAdmin, isAuthed } from '../access/byRole'

// Users does double duty: auth-capable users (kind='login') AND credit-only
// contributors (kind='credit-only', no real email/auth, just attribution).
// Payload's built-in auth still requires an email; for credit-only entries
// use a placeholder pattern like "credit+name@jang.local".
//
// Authentication is Google SSO only: the local password strategy is disabled
// so signed-in sessions are minted exclusively via /api/auth/google/callback.
// A user is permitted in iff a row exists with their Google email AND the
// `allowlisted` flag is true.
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'email', 'role', 'kind'],
  },
  access: {
    // Only admins can open /admin. Editors and viewers do all their work
    // through the frontend; this hides the admin UI from them entirely.
    admin: ({ req: { user } }) => user?.role === 'admin',
    // Any signed-in user can read user records (needed for People dropdowns
    // and similar UI). Only admins can mutate.
    read: isAuthed,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  auth: {
    disableLocalStrategy: true,
    // No revocable sessions — Google SSO mints a stateless JWT cookie that
    // expires on its own. With useSessions:true, Payload's JWT strategy
    // requires a sid claim and a users_sessions row; we have neither.
    useSessions: false,
    // disableLocalStrategy also strips Payload's built-in JWT cookie reader,
    // so we re-register it ourselves. The cookie is minted by our Google
    // OAuth callback at /api/auth/google/callback.
    strategies: [
      {
        name: 'google-jwt',
        authenticate: JWTAuthentication,
      },
    ],
  },
  fields: [
    // With local strategy disabled, Payload no longer auto-adds an `email`
    // field. We need it explicitly: it's the allowlist key that the Google
    // callback uses to look up the row.
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      admin: {
        description:
          'Must match the Google account this user will sign in with.',
      },
    },
    {
      name: 'displayName',
      type: 'text',
      required: true,
      admin: {
        description: 'Shown in editor dropdowns and on document pages.',
      },
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'login',
      options: [
        { value: 'login', label: 'Login (auth-capable)' },
        { value: 'credit-only', label: 'Credit only (no login)' },
      ],
    },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'viewer',
      options: [
        { value: 'admin', label: 'Admin' },
        { value: 'editor', label: 'Editor' },
        { value: 'viewer', label: 'Viewer' },
      ],
      admin: {
        condition: (data) => data?.kind === 'login',
      },
    },
    {
      name: 'allowlisted',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        condition: (data) => data?.kind === 'login',
        description:
          'When false, sign-in is rejected even if Google auth succeeds.',
      },
    },
    {
      name: 'googleId',
      type: 'text',
      admin: {
        condition: (data) => data?.kind === 'login',
        description: 'Stamped on first Google sign-in. Locks the row to one Google account.',
        readOnly: true,
      },
    },
    {
      name: 'isTranslator',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Show in the translator dropdown on documents.',
      },
    },
    {
      name: 'isTranscriber',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Show in the transcriber dropdown on documents.',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description:
          'Useful for credit-only entries (e.g. "translated by H.K. Wong in 2003").',
      },
    },
  ],
}
