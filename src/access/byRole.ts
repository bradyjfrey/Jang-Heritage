import type { Access } from 'payload'

// Single source of truth for role-based access. Three tiers:
//   admin  — full read/write/delete + /admin UI
//   editor — full read/write, no delete, no /admin UI
//   viewer — read-only, no /admin UI
//
// Server-side payload.* calls run with overrideAccess: true by default, so
// these only matter for HTTP /api requests and the admin UI.

export const isAuthed: Access = ({ req }) => Boolean(req.user)

export const isAdmin: Access = ({ req }) => req.user?.role === 'admin'

export const isEditorOrAdmin: Access = ({ req }) => {
  const role = req.user?.role
  return role === 'admin' || role === 'editor'
}
