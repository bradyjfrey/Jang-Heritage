import Link from 'next/link'
import type { User } from '@/payload-types'

import { SearchBar } from './SearchBar'

export type ChromeBelow =
  | { type: 'nav'; active?: 'home' | 'documents' | 'tags' | 'history' }
  | { type: 'breadcrumb'; items: { label: string; href?: string }[] }

type Props = {
  user: User
  // What to render under the main header bar:
  //  - nav: horizontal app nav (used on home / list / search)
  //  - breadcrumb: trail (used on document detail and similar single-record pages)
  // Omit for pages that want just the bar with no second row.
  below?: ChromeBelow
}

// Shared global header for chromed frontend pages: 陳 + Jang Heritage,
// global search, user avatar. Optional second row is either the horizontal
// nav or a breadcrumb trail. Sticky, so it stays at top during scroll.
export function Chrome({ user, below }: Props) {
  const initial =
    user.displayName?.[0]?.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    '?'

  return (
    <header className="border-b border-[color:var(--border-soft)] bg-paper sticky top-0 z-20">
      <div className="flex items-center gap-6 px-6 h-16">
        <Link
          href="/"
          className="flex items-center gap-2.5 shrink-0"
          aria-label="Jang Heritage home"
        >
          <span className="font-cjk text-3xl text-seal leading-none">陳</span>
          <span className="font-serif-content text-lg tracking-tight">
            Jang Heritage
          </span>
        </Link>
        <div className="flex-1 max-w-xl">
          <SearchBar />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-8 h-8 rounded-full bg-seal text-white flex items-center justify-center text-sm font-medium"
            title={user.displayName || user.email || ''}
          >
            {initial}
          </div>
        </div>
      </div>

      {below?.type === 'nav' ? (
        <nav className="border-t border-[color:var(--border-soft)]">
          <div className="flex items-center gap-4 px-6 py-2 text-sm">
            <NavItem href="/" label="Home" active={below.active === 'home'} />
            <NavItem
              href="/list"
              label="Documents"
              active={below.active === 'documents'}
            />
            <NavItem href="/tags" label="Tags" active={below.active === 'tags'} />
            <NavItem
              href="/history"
              label="History"
              active={below.active === 'history'}
            />
            <Link
              href="/settings"
              className="ml-auto text-ink-soft hover:text-ink inline-flex items-center"
              title="Settings"
              aria-label="Settings"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94 0 .31.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
            </Link>
          </div>
        </nav>
      ) : null}

      {below?.type === 'breadcrumb' ? (
        <div className="px-6 py-2 text-xs text-ink-soft border-t border-[color:var(--border-soft)] flex items-center gap-2">
          {below.items.map((item, i) => {
            const isLast = i === below.items.length - 1
            return (
              <span key={`${i}-${item.label}`} className="flex items-center gap-2">
                {item.href && !isLast ? (
                  <Link href={item.href} className="hover:text-ink">
                    {item.label}
                  </Link>
                ) : (
                  <span className={isLast ? 'text-ink' : ''}>{item.label}</span>
                )}
                {!isLast ? <span>/</span> : null}
              </span>
            )
          })}
        </div>
      ) : null}
    </header>
  )
}

function NavItem({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'text-seal font-medium'
          : 'text-ink-soft hover:text-ink'
      }
    >
      {label}
    </Link>
  )
}
