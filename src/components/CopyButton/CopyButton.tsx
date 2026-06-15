'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

// Clipboard button using the default lucide copy icon, swapping to a check
// on success for clear feedback.
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
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full border-0 bg-transparent cursor-pointer transition duration-150 ${
        copied
          ? 'text-seal opacity-100'
          : 'text-ink opacity-45 hover:opacity-100'
      }`}
    >
      {copied ? (
        <Check className="w-4 h-4" aria-hidden="true" />
      ) : (
        <Copy className="w-4 h-4" aria-hidden="true" />
      )}
    </button>
  )
}
