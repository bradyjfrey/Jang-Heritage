import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Renders a note's markdown body as HTML. Server-rendered (no 'use client'),
// so this can sit inside a server component page. Default sanitization in
// react-markdown blocks raw HTML and dangerous URLs.
type Props = {
  source: string
  className?: string
}

export function NoteBody({ source, className }: Props) {
  return (
    <div className={className ? `md-body ${className}` : 'md-body'}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  )
}
