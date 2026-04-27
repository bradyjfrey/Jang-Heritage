import type { CollectionConfig } from 'payload'

export const Translations: CollectionConfig = {
  slug: 'translations',
  admin: {
    useAsTitle: 'document',
    defaultColumns: ['document', 'translator', 'updatedAt'],
  },
  versions: {
    maxPerDoc: 50,
  },
  fields: [
    {
      name: 'document',
      type: 'relationship',
      relationTo: 'documents',
      required: true,
      hasMany: false,
      admin: {
        description: 'Each Document has at most one Translation.',
      },
    },
    {
      name: 'text',
      type: 'textarea',
      label: 'English translation',
    },
    {
      name: 'translator',
      type: 'relationship',
      relationTo: 'users',
      hasMany: false,
    },
  ],
}
