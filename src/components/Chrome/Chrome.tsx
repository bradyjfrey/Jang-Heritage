import Link from 'next/link'
import type { User } from '@/payload-types'

import { SearchBar } from './SearchBar'
import { SignOutButton } from './SignOutButton'

type ChromeActive = 'home' | 'notes' | 'scans'

type Props = {
  user: User
  active?: ChromeActive
}

// Shared global header for chromed frontend pages: 陳 + Jang Heritage,
// global search, user avatar, primary nav. Sticky, so it stays at top
// during scroll.
//
// Mobile (<md): three stacked rows — logo + search; New Note + New Scan;
// nav. Avatar is hidden because the row real estate is taken.
// Desktop (md+): single header row + nav row, original layout.
export function Chrome({ user, active }: Props) {
  const initial =
    user.displayName?.[0]?.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    '?'
  const canCreate = user.role === 'admin' || user.role === 'editor'

  return (
    <header className="border-b border-[color:var(--border-soft)] bg-paper sticky top-0 z-20">
      <div className="flex items-center gap-3 md:gap-6 px-4 md:px-6 h-14 md:h-16">
        <Link
          href="/"
          className="flex items-center gap-2 md:gap-2.5 shrink-0"
          aria-label="Jang Heritage home"
        >
          <span className="font-cjk text-2xl md:text-3xl text-seal leading-none">陳</span>
          <span className="font-serif-content text-base md:text-lg tracking-tight">
            Jang Heritage
          </span>
        </Link>
        <div className="flex-1 md:max-w-xl">
          <SearchBar />
        </div>
        <div className="hidden md:flex items-center gap-3 shrink-0 ml-auto">
          {canCreate ? (
            <>
              <Link
                href="/add/note"
                className="bg-surface border border-seal/40 text-seal px-3 py-1.5 rounded-md text-sm font-medium hover:bg-seal hover:text-white hover:border-seal inline-flex items-center gap-1.5 transition-colors"
              >
                <span className="text-base leading-none">+</span> New Note
              </Link>
              <Link
                href="/add"
                className="bg-seal text-white border border-seal px-3.5 py-1.5 rounded-md text-sm font-medium hover:bg-surface hover:text-seal inline-flex items-center gap-1.5 transition-colors"
              >
                <span className="text-base leading-none">+</span> New Scan
              </Link>
            </>
          ) : null}
          <div
            className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-sm font-medium ml-2"
            title={user.displayName || user.email || ''}
          >
            {initial}
          </div>
        </div>
      </div>

      {canCreate ? (
        <div className="md:hidden grid grid-cols-2 gap-2 px-4 py-4">
          <Link
            href="/add/note"
            className="bg-surface border border-seal/40 text-seal px-3 py-2 rounded-md text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <span className="text-base leading-none">+</span> New Note
          </Link>
          <Link
            href="/add"
            className="bg-seal text-white border border-seal px-3.5 py-2 rounded-md text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <span className="text-base leading-none">+</span> New Scan
          </Link>
        </div>
      ) : null}

      <nav className="border-t border-[color:var(--border-soft)]">
        <div className="flex items-center px-4 md:px-6 py-2 text-sm">
          <NavItem href="/" label="Home" active={active === 'home'} />
          <NavSeparator />
          <NavItem
            href="/list?type=note"
            label="Notes"
            active={active === 'notes'}
          />
          <NavSeparator />
          <NavItem
            href="/list?type=letter,diary,photo,article,document"
            label="Scans"
            active={active === 'scans'}
          />
          <Link
            href="/settings"
            className="ml-auto text-ink-soft hover:text-ink"
          >
            Settings
          </Link>
          <NavSeparator />
          <SignOutButton />
        </div>
      </nav>
    </header>
  )
}

function NavSeparator() {
  return (
    <span
      className="mx-3 text-border-soft"
      aria-hidden="true"
    >
      /
    </span>
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
