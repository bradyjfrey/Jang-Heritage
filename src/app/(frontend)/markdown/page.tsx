import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Chrome } from '@/components/Chrome/Chrome'
import { NoteBody } from '@/components/NoteBody/NoteBody'

export const metadata = {
  title: 'Markdown reference · Jang Heritage',
}

type Feature = {
  heading: string
  blurb: string
  source: string
}

// Each feature shows the raw markdown on the left and react-markdown's
// rendered output on the right, so the cheatsheet is always in sync with
// the actual rendering pipeline.
const features: Feature[] = [
  {
    heading: 'Headings',
    blurb:
      'One # through six ######. The note title above the body is the page heading, so most note bodies start at ##.',
    source: `# Largest heading
## Section heading
### Subsection`,
  },
  {
    heading: 'Emphasis',
    blurb: 'Bold, italic, and strikethrough. Use sparingly.',
    source: `**Bold** for emphasis.
*Italic* for titles or terms.
***Both*** for stronger weight.
~~Strikethrough~~ for crossed-out text.`,
  },
  {
    heading: 'Lists',
    blurb: 'Hyphen for unordered, number for ordered. Indent two spaces to nest.',
    source: `- First contact
- Second contact
  - Sub-detail
  - Another sub-detail
- Third contact

1. First step
2. Second step
3. Third step`,
  },
  {
    heading: 'Task lists',
    blurb: 'Checkboxes you can check off in the source.',
    source: `- [x] Found call number
- [x] Emailed Jianye He
- [ ] Visit library in person
- [ ] Photograph relevant pages`,
  },
  {
    heading: 'Links',
    blurb:
      'Inline [text](url), or paste a raw URL and it becomes a link automatically.',
    source: `[UC Berkeley catalog](https://search.library.berkeley.edu/)

Or paste raw: https://www.loc.gov/`,
  },
  {
    heading: 'Blockquotes',
    blurb: 'For quoting a source, a translation, or a passage.',
    source: `> "終子二00一年三月廿二日"
> Passed away on March 22, 2001.

The character 終 here is classical/literary.`,
  },
  {
    heading: 'Code',
    blurb:
      'Backticks for inline code; triple-backtick fenced blocks for longer snippets, transcribed inscriptions, or tabular data.',
    source: `Inline: the call number \`AAS MICROFILMS CA 02\`.

\`\`\`
6 N 35
廣東中山石岐鲭尾鄉
\`\`\``,
  },
  {
    heading: 'Tables',
    blurb: 'Pipe-delimited columns, dashes for the header row.',
    source: `| Line | Chinese | English |
| --- | --- | --- |
| 1 | 陳阿鴻 | Ah Hung Chan |
| 2 | 8月7日 | August 7 |
| 3 | 6 N 35 | Plot 6 N 35 |`,
  },
  {
    heading: 'Horizontal rule',
    blurb: 'Three dashes on their own line.',
    source: `First section.

---

Second section.`,
  },
  {
    heading: 'Mixing Chinese and English inline',
    blurb:
      'Just type. CJK and Latin characters render side by side. Markdown formatting works around them normally.',
    source: `**Goal:** Find article featuring 陳阿鴻 (Chan, Ah Hung) in *Jinshan Shibao* 金山時報, March 1940.`,
  },
]

export default async function MarkdownReferencePage() {
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  if (!user) {
    redirect('/login?redirect=/markdown')
  }

  return (
    <>
      <Chrome
        user={user}
        below={{
          type: 'breadcrumb',
          items: [
            { label: 'Home', href: '/' },
            { label: 'Markdown reference' },
          ],
        }}
      />

      <main className="max-w-5xl mx-auto px-8 py-10">
        <div className="mb-8">
          <h1 className="font-serif-content text-3xl mb-2">
            Markdown reference
          </h1>
          <p className="text-ink-soft">
            Note bodies render with GitHub-Flavored Markdown. Type the syntax
            on the left, see the rendered output on the right.
          </p>
        </div>

        <div className="bg-surface border border-[color:var(--border-soft)] rounded-lg p-6">
          {features.map((feature, i) => (
            <FeatureRow key={feature.heading} feature={feature} last={i === features.length - 1} />
          ))}
        </div>

        <p className="mt-6 text-xs text-ink-faint">
          Rendered with <code>react-markdown</code> + <code>remark-gfm</code>.
          Default sanitization is on, so HTML inside the source is escaped.
        </p>
      </main>
    </>
  )
}

function FeatureRow({ feature, last }: { feature: Feature; last: boolean }) {
  return (
    <section
      className="py-5"
      style={{
        borderBottom: last ? 'none' : '1px dashed var(--border-soft)',
      }}
    >
      <h3 className="font-serif-content text-lg mb-1">{feature.heading}</h3>
      <p className="text-sm text-ink-soft mb-3">{feature.blurb}</p>
      <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-faint mb-1.5">
            Source
          </div>
          <pre
            className="whitespace-pre-wrap break-words"
            style={{
              fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
              fontSize: '0.85rem',
              lineHeight: '1.55',
              background: 'var(--paper-warm)',
              color: 'var(--ink)',
              padding: '0.85rem 1rem',
              borderRadius: 6,
              border: '1px solid var(--border-soft)',
              margin: 0,
            }}
          >
            {feature.source}
          </pre>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-faint mb-1.5">
            Rendered
          </div>
          <NoteBody source={feature.source} />
        </div>
      </div>
    </section>
  )
}
