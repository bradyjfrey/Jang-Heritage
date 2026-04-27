'use client'

import { useState } from 'react'

// Two-square icon clipboard button matching the mockup. Solid back square
// in seal red, outlined front square filled with the surrounding paper.
//
// Takes a plain string rather than a getter so it can be rendered from
// server components without the function-across-boundary error.
type Props = {
  text: string
  label: string
}

export function CopyButton({ text, label }: Props) {
  const [copied, setCopied] = useState(false)

  async function onClick() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // Permission denied / older browser: ignore
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex items-center justify-center"
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        border: 0,
        background: 'transparent',
        color: copied ? 'var(--seal)' : 'var(--ink)',
        opacity: copied ? 1 : 0.45,
        cursor: 'pointer',
        transition: 'opacity 0.15s ease, color 0.15s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
      onMouseLeave={(e) =>
        (e.currentTarget.style.opacity = copied ? '1' : '0.45')
      }
    >
      <svg viewBox="0 0 24 24" width="16" height="16">
        <rect x="8" y="8" width="12" height="12" rx="1.5" fill="currentColor" />
        <rect
          x="4"
          y="4"
          width="12"
          height="12"
          rx="1.5"
          fill="var(--paper)"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    </button>
  )
}
