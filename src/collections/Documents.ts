import type { CollectionConfig } from 'payload'

const documentTypes = [
  'letter',
  'diary',
  'photo',
  'article',
  'document',
  'note',
] as const

const isLetter = (data: any) => data?.documentType === 'letter'
const isNote = (data: any) => data?.documentType === 'note'
const isNotNote = (data: any) => data?.documentType !== 'note'

export const Documents: CollectionConfig = {
  slug: 'documents',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'documentType', 'dateOriginal', 'updatedAt'],
  },
  versions: {
    maxPerDoc: 50,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'documentType',
      type: 'select',
      required: true,
      defaultValue: 'letter',
      options: documentTypes.map((value) => ({ value, label: value })),
    },
    {
      type: 'row',
      fields: [
        {
          name: 'dateOriginal',
          type: 'date',
          admin: { width: '60%' },
        },
        {
          name: 'dateOriginalPrecision',
          type: 'select',
          defaultValue: 'unknown',
          options: [
            { value: 'day', label: 'Day' },
            { value: 'month', label: 'Month' },
            { value: 'year', label: 'Year' },
            { value: 'decade', label: 'Decade' },
            { value: 'unknown', label: 'Unknown' },
          ],
          admin: { width: '40%' },
        },
      ],
    },
    {
      name: 'sender',
      type: 'text',
      admin: { condition: isLetter },
    },
    {
      name: 'recipient',
      type: 'text',
      admin: { condition: isLetter },
    },
    {
      name: 'originLocation',
      type: 'text',
      admin: { condition: isLetter },
    },
    {
      name: 'destinationLocation',
      type: 'text',
      admin: { condition: isLetter },
    },
    {
      name: 'body',
      type: 'textarea',
      admin: {
        condition: isNote,
        description:
          'Mixed-language markdown source. Renders on the document page.',
      },
    },
    {
      name: 'bodySegmented',
      type: 'textarea',
      admin: {
        condition: isNote,
        hidden: true,
        readOnly: true,
        description: 'Auto-generated from body via nodejieba for search.',
      },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
    },
    {
      name: 'scans',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: {
        condition: isNotNote,
        description: 'Image scans, ordered by upload (drag to reorder).',
      },
    },
    {
      name: 'pinned',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Surfaces on the home page Pinned list.',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        condition: isNotNote,
        description: 'Sidecar notes (not the translation, not the body).',
      },
    },
    {
      name: 'catalogitId',
      type: 'text',
      admin: {
        position: 'sidebar',
        description: 'Backlink for records ported from Catalogit.',
      },
    },
  ],
}
