import type { CollectionConfig } from 'payload'
import { isAdmin, isEditorOrAdmin } from '../access/byRole'

export const Media: CollectionConfig = {
  slug: 'media',
  // Read stays open: scan URLs are referenced from public-render server
  // components and need to resolve without a session check. The actual file
  // bytes still go through Payload's media handler which gates per request.
  access: {
    read: () => true,
    create: isEditorOrAdmin,
    update: isEditorOrAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: true,
}
