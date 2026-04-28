import type { CollectionConfig } from 'payload'
import { isAdmin, isAuthed, isEditorOrAdmin } from '../access/byRole'

const slugify = (input: string) =>
  String(input)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')

export const Tags: CollectionConfig = {
  slug: 'tags',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'parent'],
  },
  access: {
    read: isAuthed,
    create: isEditorOrAdmin,
    update: isEditorOrAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      hooks: {
        beforeValidate: [
          ({ data, value }) => {
            if (value) return value
            const name = data?.name
            return name ? slugify(name) : value
          },
        ],
      },
    },
    {
      name: 'color',
      type: 'text',
      admin: {
        description: 'Optional hex color for chip display, e.g. #A8843E.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: false,
      admin: {
        description: 'Optional parent tag for hierarchy (e.g. People > Father).',
      },
    },
  ],
}
