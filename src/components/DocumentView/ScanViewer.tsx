'use client'

import { useState } from 'react'
import type { Media } from '@/payload-types'

type Props = {
  scans: Media[]
  title: string
}

// Featured image + thumbnail strip + pill buttons for full-size view and
// download. Clicking a thumbnail switches the featured image; the active
// thumbnail gets a seal-red border.
export function ScanViewer({ scans, title }: Props) {
  const [index, setIndex] = useState(0)
  const current = scans[index]

  if (!current) return null

  return (
    <section className="mb-10">
      <div className="rounded-lg border border-[color:var(--border-soft)] mb-3 bg-paper-warm flex justify-center p-4 min-h-[20rem]">
        <img
          src={current.url || ''}
          alt={current.alt || `${title}, scan ${index + 1} of ${scans.length}`}
          className="max-w-full max-h-[40rem] object-contain rounded shadow-sm"
        />
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        {scans.length > 1 ? (
          <div className="flex gap-2 items-center flex-wrap">
            {scans.map((scan, i) => {
              const active = i === index
              return (
                <button
                  key={scan.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`block w-20 h-24 rounded overflow-hidden transition ${
                    active
                      ? 'border-2 border-seal'
                      : 'border border-[color:var(--border-soft)] hover:border-seal/60'
                  }`}
                  title={scan.alt || `Scan ${i + 1}`}
                  aria-label={`Show scan ${i + 1}`}
                  aria-pressed={active}
                >
                  <img
                    src={scan.url || ''}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              )
            })}
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-3 text-xs text-ink-soft">
          {scans.length > 1 ? (
            <span>
              Scan{' '}
              <span className="text-ink font-medium">{index + 1}</span> of{' '}
              {scans.length}
            </span>
          ) : null}
          <a
            href={current.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="pill-btn"
            title="Open full size in a new tab"
          >
            ⛶ Full screen
          </a>
          <a
            href={current.url || '#'}
            download={current.filename || ''}
            className="pill-btn"
            title="Download original"
          >
            ⤓ Download original
          </a>
        </div>
      </div>
    </section>
  )
}
