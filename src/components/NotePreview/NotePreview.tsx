import styles from './NotePreview.module.css'

type Props = {
  title?: string | null
  body?: string | null
  variant?: 'full' | 'thumb'
}

// White card preview shown for note-type documents that have no scan
// attached. Replaces the parchment-and-watermark placeholder so the card
// reads as an actual note instead of a broken image.
export function NotePreview({ title, body, variant = 'full' }: Props) {
  const cleanTitle = (title || '').trim() || 'Untitled note'
  const snippet = stripMarkdown(body || '').trim()

  if (variant === 'thumb') {
    return (
      <div className="absolute inset-0 bg-white px-1.5 py-1 overflow-hidden">
        <div
          className={`${styles.thumbTitle} font-serif-content text-ink leading-tight break-words`}
        >
          {cleanTitle}
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 bg-white p-4 overflow-hidden flex flex-col">
      <div className="font-serif-content text-base text-ink mb-2 break-words">
        {cleanTitle}
      </div>
      {snippet ? (
        <div className="text-xs text-ink-soft leading-relaxed whitespace-pre-wrap break-words">
          {snippet}
        </div>
      ) : null}
    </div>
  )
}

function stripMarkdown(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
}
