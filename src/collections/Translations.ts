import type { CollectionConfig } from 'payload'
import { isAdmin, isAuthed, isEditorOrAdmin } from '../access/byRole'
import { checkIfUnmodifiedSince } from '../hooks/checkIfUnmodifiedSince'
import { setLastEditedBy } from '../hooks/setLastEditedBy'
import { updateTranslationSearchVector } from '../hooks/updateSearchVector'

export const Translations: CollectionConfig = {
  slug: 'translations',
  admin: {
    useAsTitle: 'document',
    defaultColumns: ['document', 'translator', 'updatedAt'],
    listSearchableFields: ['text'],
  },
  access: {
    read: isAuthed,
    create: isEditorOrAdmin,
    update: isEditorOrAdmin,
    delete: isAdmin,
  },
  versions: {
    maxPerDoc: 20,
  },
  hooks: {
    beforeChange: [checkIfUnmodifiedSince, setLastEditedBy],
    afterChange: [updateTranslationSearchVector],
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
    {
      name: 'lastEditedBy',
      type: 'relationship',
      relationTo: 'users',
      hasMany: false,
      admin: {
        readOnly: true,
        description: 'Auto-set on every save.',
      },
    },
  ],
}
