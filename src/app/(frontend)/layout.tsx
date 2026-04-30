import React from 'react'
import './styles.css'

export const metadata = {
  description: 'Private archive for the Jang family letters and diaries.',
  title: 'Jang Heritage',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
}

// Every page reads the request cookie via payload.auth() — they must run on
// each request, not be prerendered at build time. Without this Next tries
// to statically generate them and crashes connecting to a placeholder DB.
export const dynamic = 'force-dynamic'

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
