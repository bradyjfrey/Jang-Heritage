import type { CollectionConfig } from 'payload'
import { checkIfUnmodifiedSince } from '../hooks/checkIfUnmodifiedSince'
import { segmentChinese } from '../hooks/segmentChinese'
import { stripMarkdown } from '../hooks/stripMarkdown'
import { updateDocumentBodySearchVector } from '../hooks/updateSearchVector'

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
  hooks: {
    afterChange: [updateDocumentBodySearchVector],
    beforeChange: [
      checkIfUnmodifiedSince,
      async ({ data, operation }) => {
        // For note-type documents on create, default the date to today and
        // precision to 'day'. Notes record when they were written, not the
        // underlying source date, so today is the right default. User can
        // still override before saving.
        if (operation === 'create' && data.documentType === 'note') {
          if (!data.dateOriginal) {
            data.dateOriginal = new Date().toISOString()
          }
          if (!data.dateOriginalPrecision || data.dateOriginalPrecision === 'unknown') {
            data.dateOriginalPrecision = 'day'
          }
        }
        // For note-type documents, re-derive bodySegmented on every save:
        // strip markdown syntax so it doesn't pollute the index, then run
        // nodejieba so embedded Chinese is searchable. Other types skip.
        if (data.documentType === 'note') {
          const plain = await stripMarkdown(data.body)
          data.bodySegmented = segmentChinese(plain)
        } else {
          data.bodySegmented = null
        }
        return data
      },
    ],
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
      name: 'attachments',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: {
        condition: isNote,
        description:
          'Supporting files for this note: screenshots, PDFs, photos, anything relevant.',
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
