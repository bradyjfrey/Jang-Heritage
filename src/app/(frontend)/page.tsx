import Link from 'next/link'

export default async function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="font-cjk text-5xl text-seal leading-none">陳</span>
          <span className="font-serif-content text-2xl tracking-tight">
            Jang Heritage
          </span>
        </div>
        <p className="text-ink-soft text-sm mb-8">
          Private archive of letters and diaries.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/admin"
            className="bg-seal text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-black transition-colors"
          >
            Open admin
          </Link>
        </div>
        <p className="mt-12 text-xs text-ink-faint">
          Frontend pages from <code>mockups/</code> are being ported in.
          The admin handles data entry until then.
        </p>
      </div>
    </div>
  )
}
