import React from 'react'
import './styles.css'

export const metadata = {
  description: 'Private archive for the Jang family letters and diaries.',
  title: 'Jang Heritage',
}

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
