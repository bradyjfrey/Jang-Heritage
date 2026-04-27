import type { CollectionConfig } from 'payload'

// Users does double duty: auth-capable users (kind='login') AND credit-only
// contributors (kind='credit-only', no real email/auth, just attribution).
// Payload's built-in auth still requires an email; for credit-only entries
// use a placeholder pattern like "credit+name@jang.local" until the Auth.js
// bridge replaces this scheme.
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'email', 'role', 'kind'],
  },
  auth: true,
  fields: [
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
        description: 'Set by Auth.js after first Google sign-in.',
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
